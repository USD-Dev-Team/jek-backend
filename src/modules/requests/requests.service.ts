import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateRequestDto, UniversalFilterDto } from './dto/create-request.dto';
import { jekRoles, Status_Flow } from '@prisma/client';
import { BotService } from '../bot/bot.service';
import { AddressesService } from '../addresses/addresses.service';
import { Markup } from 'telegraf';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly botService: BotService,
    private readonly addressesService: AddressesService,
  ) {}

  async create(createRequestDto: CreateRequestDto) {
    const {
      telegram_id,
      address,
      latitude,
      longitude,
      description,
      district,
      mahalla,
      building_number,
      apartment_number,
    } = createRequestDto;

    const user = await this.prisma.users.findFirst({
      where: { telegram_id: BigInt(telegram_id) },
    });

    if (!user) {
      throw new ConflictException(
        "Foydalanuvchi topilmadi. Avval ro'yxatdan o'ting.",
      );
    }

    const addr = await this.addressesService.validateAndGetAddress({
      district,
      neighborhood: mahalla,
      building_number,
      apartment_number,
    });

    const requestNumber = await this.generateRequestNumber();

    const request = await this.prisma.requests.create({
      data: {
        request_number: requestNumber,
        user_id: user.id,
        address_id: addr.id,
        latitude,
        longitude,
        description,
        status: 'PENDING',
      } as any,
    } as any);

    return {
      success: true,
      message: 'Ariza muvaffaqiyatli qabul qilindi',
      data: request,
    };
  }

  async getUniversalRequests(filter: UniversalFilterDto) {
    // 1. Default қийматларни бериш ва рақамга ўтказиш
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 10;
    const skip = (page - 1) * limit;

    const { startDate, endDate, district, neighborhood, status, search } =
      filter;

    const where: any = {};

    // Vaqt bo'yicha filtr
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(
          new Date(startDate).setUTCHours(0, 0, 0, 0),
        );
      }
      if (endDate) {
        where.createdAt.lte = new Date(
          new Date(endDate).setUTCHours(23, 59, 59, 999),
        );
      }
    }

    if (status) where.status = status;

    if (district || neighborhood) {
      where.address = {
        ...(district && {
          district: { contains: district, mode: 'insensitive' },
        }),
        ...(neighborhood && {
          neighborhood: { contains: neighborhood, mode: 'insensitive' },
        }),
      };
    }

    // Global Search mantiqi
    if (search) {
      const searchCondition = { contains: search, mode: 'insensitive' as any };
      where.OR = [
        { request_number: searchCondition },
        { assigned_jek_id: searchCondition },
        { user: { full_name: searchCondition } },
        { user: { phoneNumber: searchCondition } },
      ];
    }

    const [requests, total] = await Promise.all([
      this.prisma.requests.findMany({
        where,
        select: {
          id: true,
          request_number: true,
          description: true,
          note: true,
          rejection_reason: true,
          completedAt: true,
          assigned_jek: {
            select: { id: true, first_name: true, last_name: true },
          },
          status: true,
          createdAt: true,
          address: {
            select: {
              district: true,
              neighborhood: true,
              building_number: true,
              apartment_number: true,
            },
          },
          requestPhotos: {
            select: {
              id: true,
              file_url: true,
            },
          },
          user: {
            select: {
              full_name: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: skip,
        take: limit,
      }),
      this.prisma.requests.count({ where }),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      data: requests,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findJekRequests(
    jekId: string,
    status?: Status_Flow,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    // 1. Xodimga biriktirilgan mahallalarni olish (PENDING filteri uchun)
    const admin = await (this.prisma.admins as any).findUnique({
      where: { id: jekId },
      include: {
        addresses: {
          include: { address: true },
        },
      },
    });
    if (!admin) throw new ConflictException('Xodim topilmadi');
    const neighborhoodNames = admin.addresses.map(
      (a) => a.address.neighborhood,
    );

    // 2. Query filtri yaratish
    let where: any = {};

    if (status === Status_Flow.PENDING) {
      where = {
        status: Status_Flow.PENDING,
        address: { neighborhood: { in: neighborhoodNames } },
      };
    } else if (status === Status_Flow.IN_PROGRESS) {
      where = {
        status: Status_Flow.IN_PROGRESS,
        assigned_jek_id: jekId,
      };
    } else if (status === Status_Flow.COMPLETED) {
      where = {
        status: Status_Flow.COMPLETED,
        assigned_jek_id: jekId,
      };
    } else if (status === Status_Flow.REJECTED) {
      where = {
        status: Status_Flow.REJECTED,
        assigned_jek_id: jekId,
      };
    } else {
      // Status kelmasa (yoki boshqa bo'lsa), PENDING (hududidagilar) VA IN_PROGRESS (o'zidagilar)
      where = {
        OR: [
          {
            status: 'PENDING',
            address: { neighborhood: { in: neighborhoodNames } },
          },
          { status: 'IN_PROGRESS', assigned_jek_id: jekId },
        ],
      };
    }

    const [requests, total] = await Promise.all([
      this.prisma.requests.findMany({
        where,
        select: {
          id: true,
          request_number: true,
          description: true,
          status: true,
          createdAt: true,
          address: {
            select: {
              district: true,
              neighborhood: true,
              building_number: true,
              apartment_number: true,
            },
          },
          requestPhotos: {
            select: {
              id: true,
              file_url: true,
            },
          },
          user: {
            select: {
              full_name: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      } as any),
      this.prisma.requests.count({ where } as any),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      data: requests,
      meta: {
        total, // Jami arizalar soni
        page: Number(page), // Joriy sahifa
        limit: Number(limit), // Bir sahifadagi limit
        totalPages, // Jami sahifalar soni (Frontend uchun asosiysi)
        hasNextPage: page < totalPages, // Keyingi sahifa bormi?
        hasPreviousPage: page > 1, // Oldingi sahifa bormi?
      },
    };
  }

  async assign(requestId: string, jekId: string) {
    const request = await this.prisma.requests.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) throw new ConflictException('Ariza topilmadi');

    // 1. Агар ариза PENDING бўлса - исталган ходим ўзига бириктириши мумкин
    if (request.status === 'PENDING') {
      return this.processAssignment(requestId, jekId, request, 'PENDING');
    }

    // 2. Агар ариза RAD этилган бўлса (хоҳ JEK, хоҳ USER томонидан)
    const isRejected = ['REJECTED'].includes(request.status);

    if (isRejected) {
      // Агар бу ариза аввал айнан шу ходимга бириктирилган бўлса
      if (request.assigned_jek_id === jekId) {
        return this.processAssignment(
          requestId,
          jekId,
          request,
          request.status,
        );
      } else {
        // Агар бошқа ходимники бўлса ва у ҳали PENDING эмас бўлса
        throw new ConflictException(
          'Ushbu rad etilgan ariza boshqa xodimga tegishli',
        );
      }
    }

    // 3. Бошқа ҳамма ҳолатларда (масалан, аллақачон IN_PROGRESS ёки COMPLETED бўлса)
    throw new ConflictException('Ushbu arizani qabul qilib bo‘lmaydi');
  }

  private async processAssignment(
    requestId: string,
    jekId: string,
    request: any,
    oldStatus: string,
  ) {
    const updated = await this.prisma.requests.update({
      where: { id: requestId },
      data: {
        assigned_jek_id: jekId,
        status: 'IN_PROGRESS',
      },
    });

    // Хабар юбориш
    if (request.user?.telegram_id) {
      const msg =
        oldStatus === 'PENDING'
          ? `⏳ <b>Arizangiz qabul qilindi!</b>\n\n#${request.request_number} raqamli murojaatingiz mutaxassis tomonidan o'rganilmoqda.`
          : `⏳ <b>Arizangiz qayta ishga tushirildi!</b>\n\n#${request.request_number} raqamli murojaatingiz e'tirozdan so'ng qayta ko'rib chiqishga olindi.`;

      await this.botService.sendNotification(request.user.telegram_id, msg);
    }

    // Log
    await this.prisma.requestStatusLog.create({
      data: {
        request_id: requestId,
        old_status: oldStatus as any,
        new_status: 'IN_PROGRESS',
        changed_by_role: 'JEK',
        changed_by_id: jekId,
        note:
          oldStatus === 'PENDING'
            ? 'Qabul qilindi'
            : "E'tirozdan so'ng qayta tiklandi",
      },
    });

    return { success: true, message: 'Ariza jarayonga o‘tkazildi' };
  }

  async complete(
    requestId: string,
    jekId: string,
    note: string,
    photo_urls: string[], // Бу ерда [/uploads/requests/uuid.jpg] кўринишидаги массив келади
  ) {
    // 1. Аризани текшириш
    const request = await this.prisma.requests.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) throw new ConflictException('Ariza topilmadi');

    // 2. Базани янгилаш
    const updatedRequest = await this.prisma.requests.update({
      where: { id: requestId },
      data: {
        status: 'JEK_COMPLETED',
        note: note,
        completedAt: new Date(),
        requestPhotos: {
          create: photo_urls.map((path) => ({
            file_url: path,
          })),
        },
      },
    });

    if (photo_urls && photo_urls.length > 0) {
      // КУТИБ ТУРИНГ: Расмларни алоҳида альбом қилиб юборамиз
      // Бизга тўлиқ дискдаги йўл керак, шунинг учун photo_urls-ни ўзини юборамиз
      await this.botService.sendAlbum(request.user.telegram_id, photo_urls);
    }
    // 3. БОТ ОРҚАЛИ ЮБОРИШ (ЭНГ МУҲИМ ЖОЙИ)
    if (request.user?.telegram_id) {
      // А) Аввал тугмали хабарни юборамиз
      const buttons = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ Tasdiqlash / Подтвердить',
            `user_confirm_req_${request.id}`,
          ),
        ],
        [
          Markup.button.callback(
            "❌ E'tiroz / Возражение",
            `user_reject_req_${request.id}`,
          ),
        ],
      ]);

      await this.botService.sendNotificationWithButtons(
        request.user.telegram_id,
        `✅ <b>Murojaat yakunlandi!</b>\n\n#${request.request_number}-sonli arizangiz bajarildi.\n📝 <b>Izoh:</b> ${note}`,
        buttons,
      );

      // Б) Расмларни юбориш (URL эмас, локал йўл орқали)
    }

    return { success: true, data: updatedRequest };
  }

  async reject(requestId: string, jekId: string, reason: string) {
    const request = await this.prisma.requests.findUnique({
      where: { id: requestId },
      include: { user: true },
    });
    if (!request) throw new ConflictException('Ariza topilmadi');
    if (request.assigned_jek_id !== jekId)
      throw new ConflictException(
        'Sizga biriktirilmagan arizani rad etolmaysiz',
      );

    const updated = await this.prisma.requests.update({
      where: { id: requestId },
      data: {
        status: 'JEK_REJECTED' as Status_Flow,
        rejection_reason: reason,
        note: reason, // Izohni ham yangilash
      },
    });

    // Xabar yuborish (Tugmalar bilan)
    if (request.user?.telegram_id) {
      const buttons = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ Tasdiqlash (Yopish)/Подтвердить (Закрыть)',
            `user_confirm_req_${request.id}`,
          ),
        ],
        [
          Markup.button.callback(
            "❌ E'tiroz bildirish/Возражение",
            `user_reject_req_${request.id}`,
          ),
        ],
      ]);

      await this.botService.sendNotificationWithButtons(
        request.user.telegram_id,
        `❌ <b>Arizangiz JEK tomonidan rad etildi!</b>\n\nSizning #${request.request_number} raqamli murojaatingiz rad etildi.\n\n⚠️ <b>Rad etish sababi:</b> ${reason || "Ko'rsatilmagan"}\n\n<i>Siz ushbu qarorni tasdiqlashingiz yoki e'tiroz bildirishingiz mumkin:</i>`,
        buttons,
      );
    }

    await this.prisma.requestStatusLog.create({
      data: {
        request_id: requestId,
        old_status: 'IN_PROGRESS' as Status_Flow,
        new_status: 'JEK_REJECTED' as Status_Flow,
        changed_by_role: 'JEK',
        changed_by_id: jekId,
        note: reason,
      },
    });

    return { success: true, message: 'Ariza rad etildi' };
  }

  private async generateRequestNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();

    const count = await this.prisma.requests.count({
      where: {
        request_number: {
          startsWith: `REQ-${year}`,
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `REQ-${year}-${sequence}`;
  }

  async getRequestById(requestId: string) {
    return {
      success: true,
      data: await this.prisma.requests.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          request_number: true,
          description: true,
          note: true,
          rejection_reason: true,
          completedAt: true,
          assigned_jek: {
            select: { id: true, first_name: true, last_name: true },
          },
          status: true,
          createdAt: true,
          address: {
            select: {
              district: true,
              neighborhood: true,
              building_number: true,
              apartment_number: true,
            },
          },
          requestPhotos: {
            select: {
              id: true,
              file_url: true,
            },
          },
          user: {
            select: {
              full_name: true,
              phoneNumber: true,
            },
          },
        },
      }),
    };
  }
}
