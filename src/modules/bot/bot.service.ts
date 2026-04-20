import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { MediaService } from '../media/media.service';
import { ConfigService } from '@nestjs/config';
import { RequestPhotosService } from '../request-photos/request-photos.service';
import { AddressesService } from '../addresses/addresses.service';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context, Markup } from 'telegraf';
import { jekRoles, Status_Flow } from '@prisma/client';
import { RedisService, UserRedisState } from '../redis/redis.service';
import { InputMediaPhoto } from 'telegraf/types'; // Типни импорт қилинг
import { join } from 'path';
import { existsSync } from 'fs';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly configService: ConfigService,
    private readonly requestPhotosService: RequestPhotosService,
    private readonly addressesService: AddressesService,
    private readonly redisService: RedisService,
    @InjectBot() private bot: Telegraf<Context>,
  ) {}

  /**
   * Foydalanuvchini bazadan qidirish (Faqat ma'lumot uchun)
   */
  async getUserById(telegramId: bigint) {
    return this.prisma.users.findUnique({
      where: { telegram_id: telegramId },
    });
  }

  /**
   * Foydalanuvchi e'tiroz bildirganda (Reject) uni kutish holatiga o'tkazish
   * Bu funksiya ACTION'dan chaqiriladi
   */
  async prepareForRejection(telegramId: bigint, requestId: string) {
    await this.updateUserData(telegramId, {
      type: 'REQUEST',
      step: 'REQ_REJECT_REASON', // E'tiroz sababini kutish bosqichi
      metadata: { temp_reject_request_id: requestId },
    });
  }

  /**
   * E'tiroz sababi yozilgandan keyin bazani yangilash
   */
  async processUserRejection(
    requestId: string,
    reason: string,
    telegramId: bigint,
  ) {
    const request = await this.prisma.requests.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new Error('Request not found');

    // 1. Bazani yangilash
    await this.prisma.requests.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED' as Status_Flow,
        rejection_reason: reason,
      } as any,
    });

    // 2. Log yaratish
    await this.prisma.requestStatusLog.create({
      data: {
        request_id: requestId,
        old_status: request.status,
        new_status: 'REJECTED',
        changed_by_role: 'USER',
        changed_by_id: String(telegramId),
        note: reason,
      },
    });

    // 3. Redis holatini tozalash (IDLE holatiga qaytarish)
    await this.redisService.deleteUserState(BigInt(telegramId));
  }

  /**
   * Bildirishnomalar yuborish (HTML va BigInt xatoliksiz)
   */
  async sendNotification(telegramId: bigint, message: string) {
    try {
      await this.bot.telegram.sendMessage(Number(telegramId), message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.error(`Error sending notification to ${telegramId}:`, error);
    }
  }

  async sendNotificationWithButtons(
    telegramId: bigint,
    message: string,
    buttons: any,
  ) {
    try {
      // reply_markup obyektini to'g'ri yuborish
      const markup = buttons.reply_markup ? buttons.reply_markup : buttons;
      await this.bot.telegram.sendMessage(Number(telegramId), message, {
        parse_mode: 'HTML',
        reply_markup: markup,
      });
    } catch (error) {
      this.logger.error(
        `Error sending button-notification to ${telegramId}:`,
        error,
      );
    }
  }

  
  async findOrCreateUser(telegramId: bigint) {
    const user = await this.prisma.users.findUnique({
      where: { telegram_id: telegramId },
    });

    let state = await this.redisService.getUserState(BigInt(telegramId));

    if (!state) {
      if (!user) {
        // YANGI USER UCHUN: Faqat /start dan keyin REGISTRATION boshlanadi
        state = {
          type: 'REGISTRATION',
          step: 'WAITING_NAME',
          data: {},
        };
      } else {
        // ESKI USER UCHUN: Shunchaki IDLE
        state = {
          type: 'IDLE',
          step: 'NONE',
          data: {},
        };
      }
      await this.redisService.setUserState(BigInt(telegramId), state);
    }

    return { ...user, state };
  }

  async updateUserData(
    telegramId: bigint,
    data: Partial<UserRedisState> | any,
  ) {
    // 1. Telefon raqamini formatlash
    if (data.phone) {
      data.phone = data.phone.replace(/\D/g, '');
      if (data.phone.length === 9) data.phone = `998${data.phone}`;
    }

    // 2. Redis-dagi holatni yangilash (Merge mantiqi)
    if (data.type || data.step || data.data || data.metadata) {
      const currentState = await this.redisService.getUserState(telegramId);

      const newState = {
        ...currentState,
        ...data,
        data: { ...(currentState?.data || {}), ...(data.data || {}) },
        metadata: {
          ...(currentState?.metadata || {}),
          ...(data.metadata || {}),
        },
      } as UserRedisState;

      await this.redisService.setUserState(telegramId, newState);
      this.logger.log(
        `User ${telegramId} Redis state updated: ${newState.step}`,
      );
    }

    // 3. Prisma uchun ma'lumotlarni tayyorlash
    const dbFields = ['full_name', 'phone', 'role', 'registration_step'];
    const hasDbFields = Object.keys(data).some((key) => dbFields.includes(key));

    if (hasDbFields) {
      const prismaUpdate: any = {};
      if (data.full_name) prismaUpdate.full_name = data.full_name;
      if (data.phone) prismaUpdate.phoneNumber = data.phone;
      if (data.role) prismaUpdate.role = data.role;
      if (data.registration_step)
        prismaUpdate.registration_step = data.registration_step;

      // MUHIM: .update o'rniga .upsert ishlatamiz!
      // Bu boyagi "Record not found" xatosini butunlay yo'qotadi.
      return this.prisma.users.upsert({
        where: { telegram_id: telegramId },
        update: prismaUpdate,
        create: {
          telegram_id: telegramId,
          full_name: data.full_name || null,
          phoneNumber: data.phone || null,
          role: data.role || jekRoles.User,
          registration_step: data.registration_step || 'COMPLETED',
        },
      });
    }

    return { success: true };
  }

  /**
   * Ariza raqamini generatsiya qilish (O'zgarmaydi, bazadagi songa tayanadi)
   */
  private async generateRequestNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.requests.count({
      where: { request_number: { startsWith: `JEK-${year}` } },
    });
    const sequence = String(count + 1).padStart(6, '0');
    return `JEK-${year}-${sequence}`;
  }

  /**
   * Redis-dagi vaqtinchalik ma'lumotlardan foydalanib bazada real ariza yaratish
   */
  async createRequestFromTemp(telegramId: bigint) {
    // 1. Redis-dan barcha yig'ilgan ma'lumotlarni olamiz
    const state = await this.redisService.getUserState(telegramId);

    if (
      !state ||
      state.type !== 'REQUEST' ||
      !state.data.district ||
      !state.data.description
    ) {
      throw new Error('Ariza ma’lumotlari to‘liq emas (Redis)');
    }

    const { data } = state;

    // 2. Bazadan foydalanuvchini topamiz
    const user = await this.prisma.users.findUnique({
      where: { telegram_id: BigInt(telegramId) },
    });
    if (!user) throw new Error('Foydalanuvchi bazadan topilmadi');

    // 3. Manzilni tekshirish va bazadan ID olish
    const addr = await this.addressesService.validateAndGetAddress({
      district: data.district,
      neighborhood: data.neighborhood,
      building_number: data.building_number,
      apartment_number: data.apartment_number
        ? String(data.apartment_number)
        : undefined,
    });

    const requestNumber = await this.generateRequestNumber();
    const botToken = this.configService.get<string>('BOT_TOKEN');

    // 4. Bazada ariza yaratish
    const request = await this.prisma.requests.create({
      data: {
        request_number: requestNumber,
        user_id: user.id,
        address_id: addr.id,
        description: data.description,
        status: 'PENDING' as Status_Flow,
      },
    });

    // 5. Rasmlarni yuklash (Redis-dagi file_id'lar orqali)
    if (Array.isArray(data.photos) && data.photos.length > 0 && botToken) {
      const photosToCreate: any[] = [];
      for (const fileId of data.photos) {
        try {
          const localUrl = await this.mediaService.downloadFromTelegram(
            fileId,
            botToken,
          );
          photosToCreate.push({
            file_url: localUrl,
            telegram_file_id: fileId,
          });
        } catch (e) {
          this.logger.error(`Error downloading photo ${fileId}:`, e);
        }
      }

      if (photosToCreate.length > 0) {
        await this.requestPhotosService.createMany(request.id, photosToCreate);
      }
    }

    // 6. MUHIM: Bazada null qilib yurish shart emas!
    // Shunchaki Redis-ni o'chiramiz.
    // Keyingi safar foydalanuvchi ariza ochsa, Redis-da bo'sh ob'ekt yaratiladi.
    await this.redisService.deleteUserState(telegramId);

    // Agar foydalanuvchi IDLE holatiga o'tishi kerak bo'lsa:
    await this.redisService.setUserState(telegramId, {
      type: 'IDLE',
      step: 'NONE',
      data: {},
    });

    return request;
  }

  async confirmRequest(requestId: string) {
    return this.prisma.requests.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED' as Status_Flow,
        completedAt: new Date(),
      },
    });
  }

  async getRequestById(requestId: string) {
    return this.prisma.requests.findUnique({
      where: { id: requestId },
      include: {
        requestPhotos: true, // Arizaga biriktirilgan rasmlar
        address: true, // Tuman, mahalla, bino raqamlari
        user: {
          // Ariza egasining ma'lumotlari
          select: {
            full_name: true,
            phoneNumber: true,
            telegram_id: true,
          },
        },
      },
    });
  }

  async getUserRequests(
    telegramId: bigint, // BigInt emas, number qabul qilamiz
    page: number = 1,
    limit: number = 5,
  ) {
    // 1. Avval foydalanuvchini bazadan topamiz (uning UUID id-si kerak)
    const user = await this.prisma.users.findUnique({
      where: { telegram_id: telegramId },
    });

    if (!user) return { total: 0, requests: [], page: 1, totalPages: 0 };

    const skip = (page - 1) * limit;

    // 2. Statuslarni massivga olamiz (faqat foydalanuvchi ko'rishi kerak bo'lganlari)
    const activeStatuses: Status_Flow[] = [
      'PENDING',
      'IN_PROGRESS',
      'JEK_COMPLETED',
      'JEK_REJECTED',
      'COMPLETED',
    ];

    // 3. Bir vaqtning o'zida ham ma'lumotlarni, ham umumiy sonini olamiz
    const [requests, total] = await Promise.all([
      this.prisma.requests.findMany({
        where: {
          user_id: user.id,
          status: { in: activeStatuses },
        },
        select: {
          id: true,
          request_number: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.requests.count({
        where: {
          user_id: user.id,
          status: { in: activeStatuses },
        },
      }),
    ]);

    return {
      total,
      requests,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Foydalanuvchi yuborgan rasmlarni Redis-dagi vaqtinchalik massivga yig'ish
   */
  async addTempPhoto(telegramId: bigint, fileId: string) {
    // 1. Redis-dan joriy holatni olamiz
    const state = await this.redisService.getUserState(telegramId);

    // 2. Faqat ariza yaratish (REQUEST) jarayonida bo'lsa rasm qo'shamiz
    if (state && state.type === 'REQUEST') {
      // Agar massiv hali mavjud bo'lmasa, bo'sh massiv yaratamiz
      const currentPhotos = state.data.photos || [];

      // Yangi rasm ID-sini qo'shamiz
      currentPhotos.push(fileId);

      // 3. Yangilangan holatni Redis-ga qayta yozamiz
      await this.redisService.setUserState(telegramId, {
        ...state,
        data: {
          ...state.data,
          photos: currentPhotos,
        },
      });

      this.logger.log(
        `Photo added to Redis for user ${telegramId}. Total: ${currentPhotos.length}`,
      );
    }
  }

  async sendAlbum(chatId: bigint, photoPaths: string[]) {
    try {
      const mediaGroup = photoPaths
        .filter((p) => p && !p.includes('undefined')) // Undefined'larni chiqarib tashlaymiz
        .map((p) => {
          // Agar p '/uploads/...' bilan boshlansa, uni to'liq yo'lga aylantiramiz
          const absolutePath = join(process.cwd(), p);

          if (existsSync(absolutePath)) {
            return {
              type: 'photo',
              media: { source: absolutePath }, // URL emas, faylning o'zi!
            };
          }
          return null;
        })
        .filter((item) => item !== null);

      if (mediaGroup.length > 0) {
        await this.bot.telegram.sendMediaGroup(`${chatId}`, mediaGroup as any);
      }
    } catch (error) {
      this.logger.error('Album yuborishda xato:', error);
    }
  }
}
