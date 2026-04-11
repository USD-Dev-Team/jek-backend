import { Update, Start, On, Action } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { BotService } from './bot.service';
import { Logger } from '@nestjs/common';
import { BotFlowService } from './bot-flow.service';

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(
    private readonly botService: BotService,
    private readonly botFlowService: BotFlowService,
  ) {}

  @Start()
  async onStart(ctx: Context) {
    if (!ctx.from) return;
    try {
      let user: any = await this.botService.findOrCreateUser(ctx.from.id);

      // Agar foydalanuvchi ariza yaratish bosqichida bo'lsa, barchasini reset qilish va menyuni ko'rsatish
      if (user.registration_step && user.registration_step.startsWith('REQ_')) {
        user = await this.botService.updateUserData(ctx.from.id, {
          registration_step: 'COMPLETED',
          temp_district: null,
          temp_mahalla: null,
          temp_building_number: null,
          temp_apartment_number: null,
          temp_address: null,
          temp_description: null,
          temp_photos: [],
          temp_reject_request_id: null,
        });
        await ctx.reply(
          'Saytga xush kelibsiz! Jarayon yangilandi. / Добро пожаловать! Процесс обновлен.',
        );
        await ctx.reply(
          'Quyidagi menyudan birini tanlang: / Выберите один из пунктов меню:',
          this.botFlowService.mainMenu(),
        );
        return;
      }

      if (user.registration_step !== 'COMPLETED') {
        await ctx.reply('Saytga xush kelibsiz! / Добро пожаловать!');
        await this.handleStep(ctx, String(user.registration_step));
      } else {
        await ctx.reply(
          'Saytga xush kelibsiz! Quyidagi menyudan birini tanlang: / Добро пожаловать! Выберите один из пунктов меню:',
          this.botFlowService.mainMenu(),
        );
      }
      return;
    } catch (error) {
      this.logger.error('Error in onStart:', error);
      await ctx.reply(
        "Xatolik yuz berdi. /start buyrug'ini bering. / Произошла ошибка. Введите команду /start.",
      );
      return;
    }
  }

  @Action(/^dist_/)
  async onDistrictSelect(ctx: Context) {
    if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
    try {
      const district = (ctx.callbackQuery as any).data.replace('dist_', '');
      await this.botService.updateUserData(ctx.from.id, {
        temp_district: district,
        registration_step: 'REQ_MAHALLA',
      });
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `Tanlangan hudud / Выбранный район: ${district}\n\nEndi mahalla nomini tanlang: / Теперь выберите махаллю:`,
        this.botFlowService.mahallaMenu(district),
      );
      return;
    } catch (error) {
      this.logger.error('Error in onDistrictSelect:', error);
      return;
    }
  }

  @Action(/^mhl_/)
  async onMahallaSelect(ctx: Context) {
    if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
    try {
      const mahalla = (ctx.callbackQuery as any).data.replace('mhl_', '');
      await this.botService.updateUserData(ctx.from.id, {
        temp_mahalla: mahalla,
        registration_step: 'REQ_BUILDING',
      });
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `Tanlangan mahalla / Выбранная махалля: ${mahalla}`,
      );
      await ctx.reply(
        'Bino raqamini (uy raqami) kiriting: / Введите номер дома:',
        Markup.keyboard([['❌ Bekor qilish / Отмена']])
          .oneTime()
          .resize(),
      );
      return;
    } catch (error) {
      this.logger.error('Error in onMahallaSelect:', error);
      return;
    }
  }

  @Action(/^requests_page_/)
  async onPageChange(ctx: Context) {
    if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
    try {
      const user: any = await this.botService.findOrCreateUser(ctx.from.id);
      // Ko'rilgan ariza xabarlarini tozalash (agar bo'lsa)
      if (user.temp_view_message_ids && user.temp_view_message_ids.length > 0) {
        for (const msgId of user.temp_view_message_ids) {
          await ctx.deleteMessage(parseInt(msgId)).catch(() => {});
        }
        await this.botService.updateUserData(ctx.from.id, {
          temp_view_message_ids: [],
        });
      }

      const page =
        parseInt(
          (ctx.callbackQuery as any).data.replace('requests_page_', ''),
        ) || 1;
      await this.listRequests(ctx, page, false); // isEdit=false chunki hamma narsani o'chirdik
      await ctx.answerCbQuery();
      return;
    } catch (error) {
      this.logger.error('Error onPageChange:', error);
      return;
    }
  }

  @Action(/^view_req_/)
  async onViewRequest(ctx: Context) {
    if (!ctx.from || !('data' in ctx.callbackQuery!)) return;

    try {
      const data = (ctx.callbackQuery as any).data.split('_');
      const reqId = data[2];
      const page = data[4] || '1';

      const req: any = await this.botService.getRequestById(reqId);
      if (!req) {
        await ctx.answerCbQuery('Ariza topilmadi.');
        return;
      }

      // 1. Avvalgi xabarlarni tozalash (agar bo'lsa)
      await ctx.deleteMessage().catch(() => {});

      const addr = req.address;
      const fullAddr = `${addr.district}, ${addr.neighborhood} ${addr.building_number ? ', ' + addr.building_number + '-bino' : ''}${addr.apartment_number ? ', ' + addr.apartment_number + '-xonadon' : ''}`;

      let message = `📄 <b>Ariza #${req.request_number}</b>\n\n`;
      message += `📍 Hudud: ${addr.district}\n`;
      message += `🏠 Manzil: ${fullAddr}\n`;
      message += `📝 Muammo: ${req.description}\n`;
      message += `⏳ Holat: ${req.status}\n`;
      if (req.note) message += `💬 Izoh: ${req.note}\n`;
      message += `📅 Sana: ${req.createdAt.toLocaleDateString()}`;

      const buttons: any[] = [];
      if (req.status === 'JEK_COMPLETED' || req.status === 'JEK_REJECTED') {
        buttons.push([
          Markup.button.callback('✅ Tasdiqlash', `user_confirm_req_${req.id}`),
        ]);
        buttons.push([
          Markup.button.callback(
            "❌ E'tiroz bildirish",
            `user_reject_req_${req.id}`,
          ),
        ]);
      }
      // Muhim: Ortga qaytish tugmasi endi maxsus action'ga boradi
      buttons.push([
        Markup.button.callback("⬅️ Ro'yxatga qaytish", `back_to_list_${page}`),
      ]);

      const keyboard = Markup.inlineKeyboard(buttons);
      const sentIds: string[] = [];
      const path = require('path');
      const photos = req.requestPhotos || [];

      // 2. AVVAL RASMLARNI YUBORISH
      if (photos.length > 0) {
        if (photos.length > 1) {
          const mediaGroup: any[] = photos.slice(0, 10).map((p) => {
            const absolutePath = path.join(
              process.cwd(),
              p.file_url.startsWith('/') ? p.file_url.substring(1) : p.file_url,
            );
            return { type: 'photo', media: { source: absolutePath } };
          });
          const msgs = await ctx.replyWithMediaGroup(mediaGroup);
          msgs.forEach((m) => sentIds.push(m.message_id.toString()));
        } else {
          const absolutePath = path.join(
            process.cwd(),
            photos[0].file_url.startsWith('/')
              ? photos[0].file_url.substring(1)
              : photos[0].file_url,
          );
          const msg = await ctx.replyWithPhoto({ source: absolutePath });
          sentIds.push(msg.message_id.toString());
        }
      }

      // 3. KEYIN MA'LUMOTLARNI YUBORISH
      const infoMsg = await ctx.reply(message, {
        parse_mode: 'HTML',
        ...keyboard,
      });
      sentIds.push(infoMsg.message_id.toString());

      // 4. Barcha yuborilgan xabarlar ID-sini saqlash
      await this.botService.updateUserData(ctx.from.id, {
        temp_view_message_ids: sentIds,
      });

      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('Error onViewRequest:', error);
    }
  }

  @Action(/^back_to_list_/)
  async onBackToList(ctx: Context) {
    // Chat va User borligini tekshiramiz
    if (!ctx.from || !ctx.chat || !('data' in ctx.callbackQuery!)) return;

    try {
      const data = (ctx.callbackQuery as any).data.split('_');
      const page = data[3] || '1';

      // 1. Foydalanuvchini olamiz (IDlarni bilish uchun)
      const user = await this.botService.getUserById(ctx.from.id);

      // 2. Ko'rilgan ariza xabarlarini va rasmlarni tozalaymiz
      if (
        user &&
        user.temp_view_message_ids &&
        user.temp_view_message_ids.length > 0
      ) {
        for (const msgId of user.temp_view_message_ids as string[]) {
          // ctx.chat.id dan foydalanamiz, chunki bu xavfsizroq
          await ctx.telegram
            .deleteMessage(ctx.chat.id, parseInt(msgId))
            .catch(() => {});
        }

        // Bazadagi IDlarni tozalaymiz
        await this.botService.updateUserData(ctx.from.id, {
          temp_view_message_ids: [],
        });
      }

      // 3. Callback ma'lumotini "aldab" o'zgartiramiz
      // Bu orqali onPageChange funksiyasi qaysi sahifaga qaytishni bilib oladi
      (ctx.update as any).callback_query.data = `requests_page_${page}`;

      // 4. Sening ro'yxat chiqaruvchi funksiyangni chaqiramiz
      await this.onPageChange(ctx);

      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('Error onBackToList:', error);
      await ctx.answerCbQuery('Xatolik yuz berdi.');
    }
  }
  @Action(/^show_photos_/)
  async onShowPhotos(ctx: Context) {
    if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
    try {
      const reqId = (ctx.callbackQuery as any).data.replace('show_photos_', '');
      const req: any = await this.botService.getRequestById(reqId);
      if (!req || !req.requestPhotos || req.requestPhotos.length === 0) {
        await ctx.answerCbQuery('Rasmlar topilmadi / Фото не найдены.');
        return;
      }

      const mediaGroup: any[] = req.requestPhotos.map((p: any) => ({
        type: 'photo',
        media: {
          source: require('path').join(
            process.cwd(),
            p.file_url.startsWith('/') ? p.file_url.substring(1) : p.file_url,
          ),
        },
      }));

      const msgs = await ctx.replyWithMediaGroup(mediaGroup);

      // Yuborilgan rasmlarni ham o'chiriladiganlar ro'yxatiga qo'shish
      const user: any = await this.botService.findOrCreateUser(ctx.from.id);
      const currentIds = user.temp_view_message_ids || [];
      const newIds = [
        ...currentIds,
        ...msgs.map((m) => m.message_id.toString()),
      ];
      await this.botService.updateUserData(ctx.from.id, {
        temp_view_message_ids: newIds,
      });

      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('Error onShowPhotos:', error);
    }
  }

  @On('message')
  async onMessage(ctx: Context) {
    if (!ctx.from) return;
    try {
      const user: any = await this.botService.findOrCreateUser(ctx.from.id);
      const message = ctx.message as any;
      const text = message.text;

      if (text === '❌ Bekor qilish / Отмена' || text === '❌ Bekor qilish') {
        await this.botService.updateUserData(ctx.from.id, {
          registration_step: 'COMPLETED',
          temp_district: null,
          temp_mahalla: null,
          temp_building_number: null,
          temp_apartment_number: null,
          temp_address: null,
          temp_description: null,
          temp_photos: [],
          temp_reject_request_id: null,
        });
        await ctx.reply(
          'Jarayon bekor qilindi. / Процесс отменен.',
          this.botFlowService.mainMenu(),
        );
        return;
      }

      // E'tiroz sababini qabul qilish
      if (user.registration_step === 'REQ_USER_REJECTION_REASON') {
        if (!text) {
          await ctx.reply(
            "Iltimos, e'tiroz sababini matn ko'rinishida yozing. / Пожалуйста, напишите причину спора текстом:",
          );
          return;
        }
        const requestId = user.temp_reject_request_id;
        await this.botService.processUserRejection(
          requestId,
          text,
          ctx.from.id,
        );
        await this.botService.updateUserData(ctx.from.id, {
          registration_step: 'COMPLETED',
          temp_reject_request_id: null,
        });
        await ctx.reply(
          "E'tirozingiz qabul qilindi. / Ваш спор принят.",
          this.botFlowService.mainMenu(),
        );
        return;
      }

      // Asosiy menyu amallari
      if (user.registration_step === 'COMPLETED') {
        if (
          text === '✍️ Ariza yaratish / Создать заявку' ||
          text === '✍️ Ariza yaratish'
        ) {
          await this.botService.updateUserData(ctx.from.id, {
            registration_step: 'REQ_DISTRICT',
          });
          await ctx.reply(
            'Iltimos, hududni tanlang: / Пожалуйста, выберите район:',
            this.botFlowService.districtMenu(),
          );
          return;
        } else if (
          text === '📋 Mening arizalarim / Мои заявки' ||
          text === '📋 Mening arizalarim'
        ) {
          await this.listRequests(ctx, 1);
          return;
        } else {
          await ctx.reply(
            'Iltimos, quyidagi menyudan foydalaning: / Пожалуйста, используйте меню ниже:',
            this.botFlowService.mainMenu(),
          );
          return;
        }
      }

      // O'tish bosqichlari
      if (
        ['FULL_NAME', 'FIRST_NAME', 'LAST_NAME', 'PHONE_NUMBER'].includes(
          user.registration_step,
        )
      ) {
        await this.botFlowService.handleRegistration(ctx, user, message);
        return;
      }

      if (user.registration_step && user.registration_step.startsWith('REQ_')) {
        await this.botFlowService.handleRequestFlow(ctx, user, message);
        return;
      }
      return;
    } catch (error) {
      this.logger.error('Error in onMessage:', error);
      await ctx.reply(
        'Texnik nosozlik. Iltimos, kuting... / Техническая ошибка. Пожалуйста, подождите...',
      );
      return;
    }
  }

  async listRequests(ctx: Context, page: number, isEdit: boolean = false) {
    if (!ctx.from) return;
    const { requests, totalPages, total } =
      await this.botService.getUserRequests(ctx.from.id, page);
    if (total === 0) {
      const msg =
        'Sizda hozircha faol arizalaringiz mavjud emas. / У вас пока нет активных заявок.';
      if (isEdit) {
        await ctx.editMessageText(msg);
      } else {
        await ctx.reply(msg);
      }
      return;
    }

    let message = `📋 <b>Sizning faol arizalaringiz / Ваши активные заявки</b> (Jami: ${total})\n\n`;
    const actionRow: any[] = [];
    requests.forEach((req: any, index: number) => {
      const statusEmoji =
        req.status === 'COMPLETED' || req.status === 'JEK_COMPLETED'
          ? '✅'
          : req.status === 'REJECTED' || req.status === 'JEK_REJECTED'
            ? '❌'
            : '⏳';
      const rowNum = (page - 1) * 5 + index + 1;
      message += `${rowNum}. <b>#${req.request_number}</b>\n📝 Holat / Статус: ${statusEmoji} ${req.status}\n📅 Sana / Дата: ${req.createdAt.toLocaleDateString()}\n\n`;
      actionRow.push(
        Markup.button.callback(`${rowNum}`, `view_req_${req.id}_p_${page}`),
      );
    });

    const buttons: any[] = [actionRow];
    const navButtons: any[] = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback(
          '⬅️ Oldingi / Пред',
          `requests_page_${page - 1}`,
        ),
      );
    if (totalPages && page < totalPages)
      navButtons.push(
        Markup.button.callback(
          'Keyingi / След ➡️',
          `requests_page_${page + 1}`,
        ),
      );
    if (navButtons.length > 0) buttons.push(navButtons);

    const keyboard = Markup.inlineKeyboard(buttons);
    if (isEdit) {
      try {
        await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
      } catch (e) {
        // Agar tahrirlash imkonsiz bo'lsa (masalan, rasm xabar bo'lsa), yangi xabar yuboramiz
        await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
        await ctx.deleteMessage().catch(() => {}); // Eski xabarni o'chirib tashlaymiz
      }
    } else {
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    }
  }

  async handleStep(ctx: Context, step: string) {
    switch (step) {
      case 'FULL_NAME':
      case 'FIRST_NAME':
        await ctx.reply('Ism-sharifingizni kiriting: / Введите ваше ФИО:');
        break;
      case 'PHONE_NUMBER':
        await ctx.reply(
          'Telefon raqamingizni yuboring: / Отправьте ваш номер телефона:',
          Markup.keyboard([
            [
              Markup.button.contactRequest(
                '📞 Kontakni yuborish / Отправить контакт',
              ),
            ],
          ])
            .oneTime()
            .resize(),
        );
        break;
      case 'REQ_DISTRICT':
        await ctx.reply(
          'Hududni tanlang: / Выберите район:',
          this.botFlowService.districtMenu(),
        );
        break;
      case 'REQ_MAHALLA':
        const u: any = await this.botService.findOrCreateUser(ctx.from!.id);
        await ctx.reply(
          'Mahalla nomini tanlang: / Выберите махаллю:',
          this.botFlowService.mahallaMenu(u.temp_district),
        );
        break;
      case 'REQ_BUILDING':
        await ctx.reply(
          'Bino raqamini (uy raqami) kiriting: / Введите номер дома:',
          Markup.keyboard([['❌ Bekor qilish / Отмена']])
            .oneTime()
            .resize(),
        );
        break;
      case 'REQ_APARTMENT':
        await ctx.reply(
          'Xonadon raqamini kiriting: / Введите номер квартиры:',
          Markup.keyboard([['❌ Bekor qilish / Отмена']])
            .oneTime()
            .resize(),
        );
        break;
      case 'REQ_DESCRIPTION':
        await ctx.reply(
          'Muammo tavsifini yozing: / Опишите проблему:',
          Markup.keyboard([['❌ Bekor qilish / Отмена']])
            .oneTime()
            .resize(),
        );
        break;
      case 'REQ_PHOTO':
        await ctx.reply(
          'Muammoni tasdiqlovchi rasm(lar) yuboring: / Отправьте фото:',
          Markup.keyboard([
            ['📸 Rasmsiz davom etish / Без фото'],
            ['❌ Bekor qilish / Отмена'],
          ])
            .oneTime()
            .resize(),
        );
        break;
      case 'REQ_CONFIRM':
        await this.botFlowService.showConfirmationSummary(ctx);
        break;
      default:
        await ctx.reply(
          'Menyudan foydalaning: / Используйте меню:',
          this.botFlowService.mainMenu(),
        );
    }
  }
}
