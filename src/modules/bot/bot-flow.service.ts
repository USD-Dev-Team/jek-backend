import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { BotService } from './bot.service';
import * as fs from 'fs';
import * as path from 'path';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class BotFlowService {
  private readonly logger = new Logger(BotFlowService.name);
  private mahallaData: any;

  constructor(
    private readonly botService: BotService,
    private readonly redisService: RedisService,
  ) {
    this.loadMahallaData();
  }

  private loadMahallaData() {
    try {
      const filePath = path.join(process.cwd(), 'mahallas.json');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      this.mahallaData = JSON.parse(fileContent);
    } catch (error) {
      this.logger.error('Error loading mahallas.json:', error);
      this.mahallaData = { addresses: [], mahallas: {} };
    }
  }

  /**
   * Foydalanuvchini ro'yxatdan o'tkazish (FULL_NAME, PHONE_NUMBER)
   */
  /**
   * Foydalanuvchini ro'yxatdan o'tkazish (WAITING_NAME, WAITING_PHONE)
   * user: { state: UserRedisState, id?: string, ... } ko'rinishida keladi
   */
  async handleRegistration(ctx: Context, userWithState: any, message: any) {
    const text = message.text;
    const userId = BigInt(ctx.from!.id);
    const { state } = userWithState;

    this.logger.log(
      `User ${userId} registration step: ${state.step}, text: ${text}`,
    );

    // 1. Ism sharifni qabul qilish
    if (state.step === 'WAITING_NAME') {
      if (!text) {
        await ctx.reply(
          "Iltimos, ism-sharifingizni matn ko'rinishida yuboring. / Пожалуйста, введите ваше ФИО.",
        );
        return;
      }

      // Redis-da ismni saqlaymiz va stepni o'zgartiramiz
      await this.botService.updateUserData(userId, {
        type: 'REGISTRATION',
        step: 'WAITING_PHONE',
        data: { full_name: text },
      });

      await ctx.reply(
        'Rahmat! Endi telefon raqamingizni yuboring: / Спасибо! Теперь отправьте ваш номер телефона:',
        Markup.keyboard([
          [
            Markup.button.contactRequest(
              '📞 Kontakni yuborish / Отправить контакт',
            ),
          ],
          ['❌ Bekor qilish / Отмена'],
        ])
          .oneTime()
          .resize(),
      );
      return;
    }

    // 2. Telefon raqamini qabul qilish va yakunlash
    if (state.step === 'WAITING_PHONE') {
      let phone = message.contact
        ? message.contact.phone_number
        : text && /^(?:\+?998)?\d{9}$/.test(text.replace(/\s/g, ''))
          ? text.replace(/\s/g, '')
          : null;

      if (!phone) {
        await ctx.reply(
          'Iltimos, telefon raqamingizni to‘g‘ri formatda yuboring yoki tugmani bosing.',
        );
        return;
      }

      // FINAL: Bazaga (PostgreSQL) hamma ma'lumotni bir yo'la saqlaymiz
      await this.botService.updateUserData(userId, {
        full_name: state.data.full_name, // Redis-dan olingan ism
        phone: phone, // Hozir kelgan telefon
        // Baza yangilangach, updateUserData ichida Redis-ni tozalash mantiqi bo'lishi kerak
        // yoki bu yerda qo'lda IDLE ga o'tkazamiz:
        type: 'IDLE',
        step: 'NONE',
        data: {},
      });

      await ctx.reply(
        "Muvaffaqiyatli ro'yxatdan o'tdingiz! ✅ / Вы успешно зарегистрировались! ✅",
        this.mainMenu(),
      );
      return;
    }
  }

  /**
   * Ariza yaratish jarayoni
   */
  async handleRequestFlow(ctx: Context, userWithState: any, message: any) {
    const text = message.text;
    const userId = BigInt(ctx.from!.id);
    const { state } = userWithState;

    // В Redis мы храним данные в state.data (тип RequestData)

    if (text === '❌ Bekor qilish / Отмена') {
      // Redis'dagi vaqtinchalik ma'lumotlarni o'chiramiz
      await this.redisService.deleteUserState(userId);

      // Asosiy menyuga qaytaramiz
      await ctx.reply(
        'Jarayon bekor qilindi. / Процесс отменен.',
        this.mainMenu(), // Bu funksiya asosiy menyu tugmalarini chiqaradi
      );
      return; // Funksiyadan chiqib ketamiz
    }

    const currentData = state.data;

    switch (state.step) {
      // bot-flow.service.ts ichida

      case 'REQ_DISTRICT':
        // Agar foydalanuvchi pastdagi "Bekor qilish" tugmasini bossa:
        if (text === '❌ Bekor qilish / Отмена' || text === '❌ Bekor qilish') {
          await this.redisService.setUserState(userId, {
            type: 'IDLE',
            step: 'NONE',
            data: {},
          });
          return ctx.reply('Jarayon bekor qilindi.', this.mainMenu());
        }

        // Agar user tugmani bosmay boshqa gap yozsa:
        await ctx.reply(
          'Iltimos, tepadagi tugmalardan hududni tanlang: / Пожалуйста, выберите район из кнопок выше:',
          this.districtMenu(),
        );
        break;
      case 'REQ_BUILDING':
        if (!text) {
          await ctx.reply(
            'Iltimos, bino raqamini kiriting: / Пожалуйста, введите номер дома:',
          );
          return;
        }
        await this.botService.updateUserData(userId, {
          type: 'REQUEST',
          step: 'REQ_APARTMENT',
          data: { ...currentData, building_number: text },
        });
        await ctx.reply('Xonadon raqamini kiriting: / Введите номер квартиры:');
        return;
      case 'REQ_APARTMENT':
        if (text === '❌ Bekor qilish / Отмена') return;
        if (!text) {
          await ctx.reply(
            'Iltimos, xonadon raqamini kiriting: / Пожалуйста, введите номер квартиры:',
          );
          return;
        }
        // Сохраняем номер квартиры в Redis
        await this.botService.updateUserData(userId, {
          type: 'REQUEST',
          step: 'REQ_DESCRIPTION',
          data: { ...currentData, apartment_number: text },
        });
        await ctx.reply(
          "Muammoni qisqacha tavsiflab bering (matn ko'rinishida): / Кратко опишите проблему (текстом):",
        );
        return;

      case 'REQ_DESCRIPTION':
        if (text === '❌ Bekor qilish / Отмена') return;
        if (!text) {
          await ctx.reply('Iltimos, muammo tavsifini yozib yuboring.');
          return;
        }
        // Сохраняем описание в Redis
        await this.botService.updateUserData(userId, {
          type: 'REQUEST',
          step: 'REQ_PHOTO',
          data: { ...currentData, description: text },
        });
        await ctx.reply(
          'Muammoni tasdiqlovchi rasm(lar) yuboring(Rasmlar alohida yuborilishi kerak): / Отправьте фото, подтверждающие проблему(Фотографии необходимо отправить отдельно.):',
          Markup.keyboard([
            ['📸 Rasmsiz davom etish / Продолжить без фото'],
            ['❌ Bekor qilish / Отмена'],
          ])
            .oneTime()
            .resize(),
        );
        return;

      case 'REQ_PHOTO':
        // Логика пропуска фото или завершения загрузки
        if (
          text &&
          (text.includes('Rasmsiz davom etish') ||
            text.includes('Tayyor / Готово'))
        ) {
          await this.botService.updateUserData(userId, {
            type: 'REQUEST',
            step: 'REQ_CONFIRM',
            data: currentData,
          });
          await this.showConfirmationSummary(ctx, userId); // Передаем userId для получения данных из Redis
          return;
        }

        // Обработка фото (метод addTempPhoto мы уже адаптировали под Redis)
        if (message.photo) {
          const fileId = message.photo[message.photo.length - 1].file_id;
          await this.botService.addTempPhoto(userId, fileId);

          // Показываем кнопку "Готово" после первого фото
          if (
            !message.media_group_id ||
            (currentData.photos?.length || 0) % 3 === 0
          ) {
            await ctx.reply(
              `📸 Rasm qo'shildi. Yana yuborasizmi?`,
              Markup.keyboard([
                ['✅ Tayyor / Готово'],
                ['❌ Bekor qilish / Отмена'],
              ]).resize(),
            );
          }
          return;
        }
        return;

      case 'REQ_CONFIRM':
        if (text?.includes('Tasdiqlash') || text?.includes('Подтвердить')) {
          // Вызываем метод, который возьмет ВСЁ из Redis и создаст одну запись в PostgreSQL
          await this.botService.createRequestFromTemp(userId);

          await ctx.reply(
            'Arizangiz muvaffaqiyatli yuborildi! / Ваша заявка успешно отправлена!',
            this.mainMenu(),
          );
          return;
        }
        return;
    }
  }
  /**
   * Ariza yakunida barcha ma'lumotlarni ko'rsatish
   */
  async showConfirmationSummary(ctx: Context, userId: bigint) {
    // Redis-dan joriy holatni olamiz
    const userWithState = await this.botService.findOrCreateUser(userId);
    const { state } = userWithState;

    if (state.type !== 'REQUEST') return;

    const data = state.data;
    const photoCount = Array.isArray(data.photos) ? data.photos.length : 0;

    // Manzilni chiroyli ko'rinishga keltiramiz
    const fullAddress = `${data.neighborhood} m., ${data.building_number}-bino${
      data.apartment_number ? ', ' + data.apartment_number + '-xonadon' : ''
    }`;

    const summary =
      `📄 <b>Murojaatni tasdiqlaysizmi? / Подтверждаете ли вы обращение?</b>\n\n` +
      `📍 Hudud / Район: ${data.district}\n` +
      `🏠 Manzil / Адрес: ${fullAddress}\n` +
      `📝 Muammo / Проблема: ${data.description}\n` +
      `📸 Rasmlar soni / Кол-во фото: ${photoCount} ta / шт`;

    await ctx.reply(summary, {
      parse_mode: 'HTML',
      ...Markup.keyboard([
        ['✅ Tasdiqlash / Подтвердить'],
        ['❌ Bekor qilish / Отмена'],
      ])
        .oneTime()
        .resize(),
    });
  }

  /**
   * Asosiy menyu (O'zgarmadi, lekin scannable qilindi)
   */
  mainMenu() {
    return Markup.keyboard([
      ['✍️ Ariza yaratish / Создать заявку'],
      ['📋 Mening arizalarim / Мои заявки'],
    ]).resize();
  }

  /**
   * Tumanlar menyusi
   */
  districtMenu() {
    const districts = this.mahallaData.addresses || [];
    const buttons = districts.map((d) =>
      Markup.button.callback(d, `dist_${d}`),
    );
    return Markup.inlineKeyboard(buttons, { columns: 2 });
  }

  /**
   * Mahallalar menyusi
   */
  mahallaMenu(districtName: string) {
    const mahallas = this.mahallaData.mahallas[districtName] || [];
    const buttons = mahallas.map((m: string) =>
      Markup.button.callback(m, `mhl_${m}`),
    );
    return Markup.inlineKeyboard(buttons, { columns: 2 });
  }
}
