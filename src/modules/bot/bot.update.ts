import { Update, Start, On, Action } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { BotService } from './bot.service';
import { Logger } from '@nestjs/common';
import { BotFlowService } from './bot-flow.service';
import { RedisService } from '../redis/redis.service';

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(
    private readonly botService: BotService,
    private readonly botFlowService: BotFlowService,
    private readonly redisService: RedisService,
  ) {}

  @Start()
  async onStart(ctx: Context) {
    if (!ctx.from) return;
    const userId = BigInt(ctx.from.id);

    try {
      const userWithState = await this.botService.findOrCreateUser(userId);
      const { state } = userWithState;

      // 1. Agar foydalanuvchi REQUEST (ariza) jarayonida bo'lsa - Reset qilamiz
      if (state.type === 'REQUEST') {
        await this.botService.updateUserData(userId, {
          type: 'IDLE',
          step: 'NONE',
          data: {},
          metadata: { temp_view_message_ids: [] },
        });

        await ctx.reply(
          'Jarayon yangilandi. / Процесс обновлен.',
          this.botFlowService.mainMenu(),
        );
        return;
      }

      // 2. Registratsiyadan o'tmagan bo'lsa (Bazada yo'q)
      if (!('id' in userWithState)) {
        await ctx.reply('Xush kelibsiz! / Добро пожаловать!');
        // handleStep funksiyasiga Redis step'ni uzatamiz
        await this.handleStep(ctx, state.step);
        return;
      }

      // 3. To'liq ro'yxatdan o'tgan bo'lsa
      await ctx.reply(
        'Xush kelibsiz! Quyidagi menyudan birini tanlang:',
        this.botFlowService.mainMenu(),
      );
    } catch (error) {
      this.logger.error('Error in onStart:', error);
      await ctx.reply("Xatolik yuz berdi. /start buyrug'ini qayta bering.");
    }
  }
  @Action(/^dist_/)
  async onDistrictSelect(ctx: Context) {
    if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
    const userId = BigInt(ctx.from.id);

    try {
      const district = (ctx.callbackQuery as any).data.replace('dist_', '');

      await this.botService.updateUserData(userId, {
        type: 'REQUEST',
        step: 'REQ_MAHALLA',
        data: { district },
      });

      await ctx.answerCbQuery();

      // Inline menyuni tahrirlab qo'yamiz
      await ctx.editMessageText(
        `Tanlangan hudud / Выбранный район: ${district}`,
      );

      // Faqat mahallalar menyusini yuboramiz, boshqa ortiqcha gap-so'zsiz
      await ctx.reply(
        'Mahalla nomini tanlang: / Выберите махаллю:',
        this.botFlowService.mahallaMenu(district),
      );
    } catch (error) {
      this.logger.error('Error in onDistrictSelect:', error);
    }
  }

  @Action(/^mhl_/)
  async onMahallaSelect(ctx: Context) {
    if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
    const userId = BigInt(ctx.from.id);

    try {
      const mahalla = (ctx.callbackQuery as any).data.replace('mhl_', '');

      // Redis state'ni yangilaymiz
      await this.botService.updateUserData(userId, {
        type: 'REQUEST',
        step: 'REQ_BUILDING',
        data: { neighborhood: mahalla }, // neighborhood (mahalla) data ichiga
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
    } catch (error) {
      this.logger.error('Error in onMahallaSelect:', error);
    }
  }

  @Action(/^user_confirm_req_/)
  async onConfirmRequest(ctx: Context) {
    if (!ctx.from || !ctx.chat || !('data' in ctx.callbackQuery!)) return;
    const userId = BigInt(ctx.from.id);

    try {
      const requestId = (ctx.callbackQuery as any).data.split('_')[3];

      await ctx.answerCbQuery('Tasdiqlandi! / Подтверждено!').catch(() => {});

      // 1. Bazada arizani yopamiz
      await this.botService.confirmRequest(requestId);

      // 2. Redis'dan vaqtinchalik xabarlar ID-larini olib o'chirib chiqamiz
      const state = await this.redisService.getUserState(userId);
      if (state?.metadata?.temp_view_message_ids) {
        for (const msgId of state.metadata.temp_view_message_ids) {
          await ctx.telegram
            .deleteMessage(ctx.chat.id, parseInt(msgId))
            .catch(() => {});
        }
      }

      // 3. Redis holatini IDLE (bo'sh) holatiga o'tkazamiz va xabarlarni tozalaymiz
      await this.botService.updateUserData(userId, {
        type: 'IDLE',
        step: 'NONE',
        data: {},
        metadata: { temp_view_message_ids: [] },
      });

      await ctx.reply(
        '✅ Rahmat! Ariza muvaffaqiyatli yopildi. / Спасибо! Заявка успешно закрыта.',
        this.botFlowService.mainMenu(),
      );
    } catch (error) {
      this.logger.error('Error onConfirmRequest:', error);
      await ctx.reply('Xatolik yuz berdi. / Произошла ошибка.');
    }
  }

  @Action(/^requests_page_/)
  async onPageChange(ctx: Context) {
    if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
    const userId = BigInt(ctx.from.id);

    try {
      const state = await this.redisService.getUserState(userId);

      // Ko'rilgan ariza xabarlarini Redis metadata orqali tozalash
      if (state?.metadata?.temp_view_message_ids?.length > 0) {
        for (const msgId of state.metadata.temp_view_message_ids) {
          await ctx.deleteMessage(parseInt(msgId)).catch(() => {});
        }
        // Xabarlar ro'yxatini tozalaymiz
        await this.botService.updateUserData(userId, {
          metadata: { temp_view_message_ids: [] },
        });
      }

      const page =
        parseInt(
          (ctx.callbackQuery as any).data.replace('requests_page_', ''),
        ) || 1;

      // Sahifani listRequests orqali chiqaramiz
      await this.listRequests(ctx, page, false);
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('Error onPageChange:', error);
    }
  }

  @Action(/^view_req_/)
  async onViewRequest(ctx: Context) {
    if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
    const userId = BigInt(ctx.from.id);

    try {
      const data = (ctx.callbackQuery as any).data.split('_');
      const reqId = data[2];
      const page = data[4] || '1';

      const req = await this.botService.getRequestById(reqId);
      if (!req) {
        await ctx.answerCbQuery('Ariza topilmadi.');
        return;
      }

      // 1. Joriy bosilgan tugmali xabarni o'chirish
      await ctx.deleteMessage().catch(() => {});

      const addr = req.address;
      const fullAddr = `${addr.district}, ${addr.neighborhood} ${
        addr.building_number ? ', ' + addr.building_number + '-bino' : ''
      }${addr.apartment_number ? ', ' + addr.apartment_number + '-xonadon' : ''}`;

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
      buttons.push([
        Markup.button.callback("⬅️ Ro'yxatga qaytish", `back_to_list_${page}`),
      ]);

      const sentIds: string[] = [];
      const path = require('path');
      const photos = (req as any).requestPhotos || [];

      // 2. Rasmlarni yuborish
      if (photos.length > 0) {
        if (photos.length > 1) {
          const mediaGroup: any[] = photos.slice(0, 10).map((p) => {
            const absolutePath = path.join(
              process.cwd(),
              p.file_url.replace(/^\//, ''),
            );
            return { type: 'photo', media: { source: absolutePath } };
          });
          const msgs = await ctx.replyWithMediaGroup(mediaGroup);
          msgs.forEach((m) => sentIds.push(m.message_id.toString()));
        } else {
          const absolutePath = path.join(
            process.cwd(),
            photos[0].file_url.replace(/^\//, ''),
          );
          const msg = await ctx.replyWithPhoto({ source: absolutePath });
          sentIds.push(msg.message_id.toString());
        }
      }

      // 3. Ma'lumotlarni yuborish
      const infoMsg = await ctx.reply(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      });
      sentIds.push(infoMsg.message_id.toString());

      // 4. Barcha yuborilgan xabarlar ID-sini Redis metadata-ga yozish
      await this.botService.updateUserData(userId, {
        metadata: { temp_view_message_ids: sentIds },
      });

      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('Error onViewRequest:', error);
    }
  }

  @Action(/^user_reject_req_/)
  async onRejectRequest(ctx: Context) {
    if (!ctx.from || !ctx.chat || !('data' in ctx.callbackQuery!)) return;
    const userId = BigInt(ctx.from.id);

    try {
      // 1. Redis-dan xabarlar tarixini olib tozalaymiz
      const state = await this.redisService.getUserState(userId);
      if (state?.metadata?.temp_view_message_ids) {
        for (const msgId of state.metadata.temp_view_message_ids) {
          await ctx.telegram
            .deleteMessage(ctx.chat.id, parseInt(msgId))
            .catch(() => {});
        }
      }

      const reqId = (ctx.callbackQuery as any).data.split('_')[3];

      // 2. Redis holatini e'tiroz sababini kutish bosqichiga o'tkazamiz
      await this.botService.updateUserData(userId, {
        type: 'REQUEST',
        step: 'REQ_REJECT_REASON', // UserRedisState-dagi step nomi
        metadata: {
          temp_reject_request_id: reqId,
          temp_view_message_ids: [], // Tozalanganini qayd etamiz
        },
      });

      await ctx.reply("❌ Iltimos, e'tirozingiz sababini yozib yuboring:");
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('Error onRejectRequest:', error);
    }
  }

  @Action(/^back_to_list_/)
  async onBackToList(ctx: Context) {
    if (!ctx.from || !ctx.chat || !('data' in ctx.callbackQuery!)) return;
    const userId = BigInt(ctx.from.id);

    try {
      const data = (ctx.callbackQuery as any).data.split('_');
      const page = data[3] || '1';

      // 1. Redis-dan vaqtinchalik xabarlar ID-larini olib tozalaymiz
      const state = await this.redisService.getUserState(userId);
      if (state?.metadata?.temp_view_message_ids?.length > 0) {
        for (const msgId of state.metadata.temp_view_message_ids) {
          await ctx.telegram
            .deleteMessage(ctx.chat.id, parseInt(msgId))
            .catch(() => {});
        }

        // Redis-dagi ID-larni tozalaymiz
        await this.botService.updateUserData(userId, {
          metadata: { ...state.metadata, temp_view_message_ids: [] },
        });
      }

      // 2. Callback ma'lumotini o'zgartirib sahifaga yo'naltiramiz
      (ctx.update as any).callback_query.data = `requests_page_${page}`;
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
    const userId = BigInt(ctx.from.id);

    try {
      const reqId = (ctx.callbackQuery as any).data.replace('show_photos_', '');
      const req = await this.botService.getRequestById(reqId);

      if (!req || !req.requestPhotos || req.requestPhotos.length === 0) {
        await ctx.answerCbQuery('Rasmlar topilmadi / Фото не найдены.');
        return;
      }

      const path = require('path');
      const mediaGroup: any[] = req.requestPhotos.map((p: any) => ({
        type: 'photo',
        media: {
          source: path.join(process.cwd(), p.file_url.replace(/^\//, '')),
        },
      }));

      const msgs = await ctx.replyWithMediaGroup(mediaGroup);

      // 3. Yangi yuborilgan rasmlarni Redis metadata-ga qo'shish
      const state = await this.redisService.getUserState(userId);
      const currentIds = state?.metadata?.temp_view_message_ids || [];
      const newIds = [
        ...currentIds,
        ...msgs.map((m) => m.message_id.toString()),
      ];

      await this.botService.updateUserData(userId, {
        metadata: { ...state?.metadata, temp_view_message_ids: newIds },
      });

      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('Error onShowPhotos:', error);
    }
  }

  @On('message')
  async onMessage(ctx: Context) {
    if (!ctx.from) return;
    const userId = BigInt(ctx.from.id);
    const message = ctx.message as any;
    const text = message.text;

    try {
      // 1. Redis-dan holatni olamiz
      let state = await this.redisService.getUserState(userId);

      // 2. MUHIM: Agar Redis-da state bo'lmasa, bazani tekshiramiz
      if (!state) {
        const dbUser = await this.botService.findOrCreateUser(userId);

        if (dbUser && dbUser.registration_step === 'COMPLETED') {
          // Agar bazada bor bo'lsa, Redis state-ni IDLE qilib tiklaymiz
          state = { type: 'IDLE', step: 'NONE', data: {} };
          await this.redisService.setUserState(userId, state);
        } else {
          // Haqiqatdan ham yo'q bo'lsa, start so'raymiz
          if (text !== '/start') {
            await ctx.reply(
              "Botdan foydalanish uchun avval /start buyrug'ini bering.",
              Markup.removeKeyboard(), // Eski tugmalarni o'chirib tashlaymiz
            );
            return;
          }
          return; // /start bo'lsa onStart metodiga o'tib ketadi
        }
      }

      // 3. Foydalanuvchi ma'lumotlarini olamiz
      const userWithState = await this.botService.findOrCreateUser(userId);

      // 4. Bekor qilish mantiqi (Siz so'ragan asosiy qism)
      if (text === '❌ Bekor qilish / Отмена' || text === '❌ Bekor qilish') {
        // REQUEST yoki REGISTRATION jarayonini to'xtatib, IDLE holatga o'tkazamiz
        await this.redisService.setUserState(userId, {
          type: 'IDLE',
          step: 'NONE',
          data: {},
        });

        await ctx.reply(
          'Jarayon bekor qilindi. / Процесс отменен.',
          this.botFlowService.mainMenu(),
        );
        return;
      }

      // 5. E'tiroz sababini qabul qilish
      if (state.step === 'REQ_REJECT_REASON') {
        if (!text) {
          await ctx.reply(
            "Iltimos, e'tiroz sababini matn ko'rinishida yozing.",
          );
          return;
        }
        const requestId = state.metadata?.temp_reject_request_id;
        await this.botService.processUserRejection(requestId, text, userId);
        await ctx.reply(
          "E'tirozingiz qabul qilindi.",
          this.botFlowService.mainMenu(),
        );
        return;
      }

      // 6. Asosiy menyu amallari (IDLE holatda)
      if (state.type === 'IDLE') {
        // bot.update.ts ichida

        if (text?.includes('✍️ Ariza yaratish')) {
          await this.botService.updateUserData(userId, {
            type: 'REQUEST',
            step: 'REQ_DISTRICT',
            data: {},
          });

          // 1. Avval pastki (Reply) menyuda "Bekor qilish"ni chiqaramiz
          await ctx.reply(
            'Ariza yaratish jarayoni boshlandi. / Процесс создания заявки начат.',
            Markup.keyboard([['❌ Bekor qilish / Отмена']]).resize(),
          );

          // 2. Keyin hududlarni (Inline) tanlashni so'raymiz
          await ctx.reply(
            'Iltimos, hududni tanlang: / Пожалуйста, выберите район:',
            this.botFlowService.districtMenu(),
          );
          return;
        }

        if (text?.includes('📋 Mening arizalarim')) {
          await this.listRequests(ctx, 1);
          return;
        }
      }

      // 7. Oqimlarni boshqarish
      if (state.type === 'REGISTRATION') {
        await this.botFlowService.handleRegistration(
          ctx,
          userWithState,
          message,
        );
        return;
      }

      if (state.type === 'REQUEST') {
        await this.botFlowService.handleRequestFlow(
          ctx,
          userWithState,
          message,
        );
        return;
      }

      // Hech narsa tushmasa asosiy menyu
      await ctx.reply(
        'Quyidagi menyudan foydalaning:',
        this.botFlowService.mainMenu(),
      );
    } catch (error) {
      this.logger.error('Error in onMessage:', error);
      await ctx.reply('Texnik nosozlik yuz berdi.');
    }
  }
  async listRequests(ctx: Context, page: number, isEdit: boolean = false) {
    if (!ctx.from) return;
    const { requests, totalPages, total } =
      await this.botService.getUserRequests(BigInt(ctx.from.id), page);
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
    const userId = BigInt(ctx.from!.id);

    switch (step) {
      // 1. Registratsiya qismi (Nomlarni interfeysga mosladik)
      case 'WAITING_NAME': // FULL_NAME o'rniga
        await ctx.reply('Ism-sharifingizni kiriting: / Введите ваше ФИО:');
        break;

      case 'WAITING_PHONE': // PHONE_NUMBER o'rniga
        await ctx.reply(
          'Telefon raqamingizni yuboring: / Отправьте ваш номер телефона:',
          Markup.keyboard([
            [
              Markup.button.contactRequest(
                '📞 Kontakni yuborish / Отправить kontakt',
              ),
            ],
            ['❌ Bekor qilish / Отмена'],
          ])
            .oneTime()
            .resize(),
        );
        break;

      // 2. Ariza yaratish qismi
      case 'REQ_DISTRICT':
        // 1. Bekor qilishni tekshiramiz
        if (ctx.text === '❌ Bekor qilish / Отмена' || ctx.text === '❌ Bekor qilish') {
          await this.redisService.setUserState(userId, {
            type: 'IDLE',
            step: 'NONE',
            data: {},
          });
          return ctx.reply(
            'Jarayon bekor qilindi.',
            this.botFlowService.mainMenu(),
          );
        }

        // 2. Agar foydalanuvchi tugmani bosmasdan boshqa narsa yozsa
        await ctx.reply(
          'Iltimos, hududni tepadagi tugmalardan tanlang: / Пожалуйста, выберите район из кнопок выше:',
          this.botFlowService.districtMenu(),
        );
        break;

      case 'REQ_MAHALLA':
        // 1. Bekor qilishni tekshiramiz
        if (ctx.text === '❌ Bekor qilish / Отмена' || ctx.text === '❌ Bekor qilish') {
          await this.redisService.setUserState(userId, {
            type: 'IDLE',
            step: 'NONE',
            data: {},
          });
          return ctx.reply(
            'Jarayon bekor qilindi.',
            this.botFlowService.mainMenu(),
          );
        }

        // 2. Aks holda hududni Redis'dan olib, mahallalar menyusini qayta chiqaramiz
        const userState = await this.botService.findOrCreateUser(userId);
        const district = userState.state.data.district;

        await ctx.reply(
          'Iltimos, mahalla nomini yuqoridagi tugmalardan tanlang: / Пожалуйста, выберите махаллю из кнопок выше:',
          this.botFlowService.mahallaMenu(district),
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
        await this.botFlowService.showConfirmationSummary(ctx, userId);
        break;

      default:
        await ctx.reply(
          'Menyudan foydalaning: / Используйте меню:',
          this.botFlowService.mainMenu(),
        );
    }
  }
}
