import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateRequestDto, UniversalFilterDto } from './dto/create-request.dto';
import { Status_Flow } from '@prisma/client';
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
    const { startDate, endDate, district, neighborhood, status, search } =
      filter;

    const where: any = {};

    // 1. Vaqt bo'yicha filtr
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

    // 2. Oddiy string maydonlar
    if (status) where.status = status;

    // 3. Address jadvali bo'yicha ichki filtr (Relation)
    // Query-da kelgan stringlarni kerakli turga o'giramiz
    if (district || neighborhood) {
      where.address = {
        ...(district && { district: district }),
        ...(neighborhood && { neighborhood: neighborhood }),
      };
    }

    // 3. Global Search mantiqi
    if (search) {
      const searchCondition = { contains: search, mode: 'insensitive' as any };

      where.OR = [
        // 1. Ariza raqami bo'yicha (masalan: REQ-1001)
        { request_number: searchCondition },

        // 2. Tuman nomi bo'yicha (Address bog'liqligi orqali)
        {
          user: {
            full_name: searchCondition,
          },
        },

        // 3. Mahalla nomi bo'yicha (Address bog'liqligi orqali)
        {
          user: {
            phoneNumber: searchCondition,
          },
        },
      ];
    }

    const skip =
      (filter.page ? filter.page : 1 - 1) * (filter.limit ? filter.limit : 5);
    return this.prisma.requests.findMany({
      where,
      include: {
        address: true,
        user: {
          select: {
            full_name: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: filter.limit ? filter.limit : 5,
    });
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

    return {
      data: requests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async assign(requestId: string, jekId: string) {
    const request = await this.prisma.requests.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) throw new ConflictException('Ariza topilmadi');

    // 1. Shartni o'zgartiramiz: Faqat PENDING yoki JEK_REJECTED bo'lsagina ruxsat beramiz
    const allowedStatuses = ['PENDING', 'JEK_REJECTED'];
    if (!allowedStatuses.includes(request.status)) {
      throw new ConflictException(
        'Ushbu ariza allaqachon biriktirilgan yoki yopilgan',
      );
    }

    // 2. Arizani yangilash
    const updated = await this.prisma.requests.update({
      where: { id: requestId },
      data: {
        assigned_jek_id: jekId,
        status: 'IN_PROGRESS' as Status_Flow,
      },
    });

    // 3. Xabar yuborish
    if (request.user?.telegram_id) {
      let msg = `⏳ <b>Arizangiz qabul qilindi!</b>\n\nSizning #${request.request_number} raqamli murojaatingiz JEK xodimi tomonidan o'rganish uchun qabul qilindi.`;

      // Agar oldingi holat rad etilgan bo'lsa, xabarni biroz o'zgartirish mumkin
      if (request.status === 'JEK_REJECTED') {
        msg = `⏳ <b>Arizangiz qayta ko'rib chiqilmoqda!</b>\n\nSizning #${request.request_number} raqamli murojaatingiz e'tirozdan so'ng JEK xodimi tomonidan qayta ishga tushirildi.`;
      }

      await this.botService.sendNotification(request.user.telegram_id, msg);
    }

    // 4. Log yaratish (old_status endi dinamik: PENDING yoki JEK_REJECTED bo'ladi)
    await this.prisma.requestStatusLog.create({
      data: {
        request_id: requestId,
        old_status: request.status as Status_Flow,
        new_status: 'IN_PROGRESS' as Status_Flow,
        changed_by_role: 'JEK',
        changed_by_id: jekId,
        note:
          request.status === 'JEK_REJECTED'
            ? "E'tirozdan so'ng ariza qayta biriktirildi"
            : "Ariza xodim tomonidan ko'rib chiqish uchun qabul qilindi",
      },
    });

    return { success: true, message: 'Ariza biriktirildi' };
  }

  async complete(requestId: string, jekId: string, note: string) {
    const request = await this.prisma.requests.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) throw new ConflictException('Ariza topilmadi');

    // Tekshiruv: Faqat IN_PROGRESS holatidagi arizani yopish mumkin
    if (request.status !== 'IN_PROGRESS') {
      throw new ConflictException(
        'Faqat jarayondagi arizalarni yakunlash mumkin',
      );
    }

    if (request.assigned_jek_id !== jekId)
      throw new ConflictException('Sizga biriktirilmagan arizani yopolmaysiz');

    const updated = await this.prisma.requests.update({
      where: { id: requestId },
      data: {
        status: 'JEK_COMPLETED' as Status_Flow,
        note: note,
        completedAt: new Date(),
      },
    });

    // Xabar yuborish (Tugmalar bilan)
    if (request.user?.telegram_id) {
      const buttons = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ Tasdiqlash',
            `user_confirm_req_${request.id}`,
          ),
        ],
        [
          Markup.button.callback(
            "❌ E'tiroz bildirish",
            `user_reject_req_${request.id}`,
          ),
        ],
      ]);

      // MUHIM: Foydalanuvchi javob yozishi uchun uning stepini yangilab qo'yamiz
      // Bu foydalanuvchi bemalol e'tiroz yozishi yoki tasdiqlashi uchun kerak
      await this.botService.updateUserData(request.user.telegram_id, {
        registration_step: 'COMPLETED', // Asosiy holatda tursin
      });

      await this.botService.sendNotificationWithButtons(
        request.user.telegram_id,
        `✅ <b>Murojaat JEK tomonidan yakunlandi!</b>\n\nSizning #${request.request_number} raqamli arizangiz xodim tomonidan bajarildi deb belgilandi.\n\n📝 <b>Xodim izohi:</b> ${note || "Ko'rsatilmagan"}\n\n<i>Iltimos, ish sifatini tasdiqlang yoki e'tiroz bildiring:</i>`,
        buttons,
      );
    }

    // Log yaratish
    await this.prisma.requestStatusLog.create({
      data: {
        request_id: requestId,
        old_status: request.status as Status_Flow, // Dinamik qildik (oldin IN_PROGRESS edi)
        new_status: 'JEK_COMPLETED' as Status_Flow,
        changed_by_role: 'JEK',
        changed_by_id: jekId,
        note,
      },
    });

    return { success: true, message: 'Ariza yakunlandi' };
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
            '✅ Tasdiqlash (Yopish)',
            `user_confirm_req_${request.id}`,
          ),
        ],
        [
          Markup.button.callback(
            "❌ E'tiroz bildirish",
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
}
