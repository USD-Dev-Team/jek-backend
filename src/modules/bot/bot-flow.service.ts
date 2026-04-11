import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { BotService } from './bot.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BotFlowService {
  private readonly logger = new Logger(BotFlowService.name);
  private mahallaData: any;

  constructor(private readonly botService: BotService) {
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
  async handleRegistration(ctx: Context, user: any, message: any) {
    const text = message.text;
    const userId = BigInt(ctx.from!.id);
    const currentStep = user.registration_step;

    this.logger.log(
      `User ${userId} registration step: ${currentStep}, text: ${text}`,
    );

    if (currentStep === 'FULL_NAME' || currentStep === 'FIRST_NAME') {
      if (!text) {
        await ctx.reply(
          "Iltimos, ism-sharifingizni matn ko'rinishida yuboring. / Пожалуйста, введите ваше ФИО.",
        );
        return;
      }
      await this.botService.updateUserData(userId, {
        full_name: text,
        registration_step: 'PHONE_NUMBER',
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

    if (currentStep === 'PHONE_NUMBER') {
      let phone = message.contact
        ? message.contact.phone_number
        : text && /^(?:\+?998)?\d{9}$/.test(text.replace(/\s/g, ''))
          ? text.replace(/\s/g, '')
          : null;
      if (!phone) {
        await ctx.reply(
          'Iltimos, telefon raqamingizni yuboring yoki "📞 Kontakni yuborish" tugmasini bosing. / Пожалуйста, отправьте номер телефона или нажмите кнопку "Отправить контакт".',
        );
        return;
      }
      await this.botService.updateUserData(userId, {
        phoneNumber: phone,
        registration_step: 'COMPLETED',
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
  async handleRequestFlow(ctx: Context, user: any, message: any) {
    const text = message.text;
    const userId = BigInt(ctx.from!.id);

    switch (user.registration_step) {
      case 'REQ_DISTRICT':
        await ctx.reply(
          'Iltimos, tepadagi tugmalardan hududni tanlang: / Пожалуйста, выберите район из кнопок выше:',
          this.districtMenu(),
        );
        return;

      case 'REQ_MAHALLA':
        if (text === '❌ Bekor qilish / Отмена') return;
        const userData: any = await this.botService.findOrCreateUser(userId);
        await ctx.reply(
          'Iltimos, yuqoridagi tugmalardan mahallani tanlang: / Пожалуйста, выберите махаллю из кнопок выше:',
          this.mahallaMenu(userData.temp_district),
        );
        return;

      case 'REQ_BUILDING':
        if (text === '❌ Bekor qilish / Отмена') return;
        if (!text) {
          await ctx.reply(
            'Iltimos, bino raqamini kiriting: / Пожалуйста, введите номер дома:',
          );
          return;
        }
        await this.botService.updateUserData(userId, {
          temp_building_number: text,
          registration_step: 'REQ_APARTMENT',
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
        const fullAddress = `${user.temp_mahalla} m., ${user.temp_building_number}-bino / дом, ${text}-xonadon / кв`;
        await this.botService.updateUserData(userId, {
          temp_apartment_number: text,
          temp_address: fullAddress,
          registration_step: 'REQ_DESCRIPTION',
        });
        await ctx.reply(
          "Muammoni qisqacha tavsiflab bering (matn ko'rinishida): / Кратко опишите проблему (текстом):",
        );
        return;

      case 'REQ_DESCRIPTION':
        if (text === '❌ Bekor qilish / Отмена') return;
        if (!text) {
          await ctx.reply(
            'Iltimos, muammo tavsifini yozib yuboring. / Пожалуйста, отправьте описание проблемы.',
          );
          return;
        }
        await this.botService.updateUserData(userId, {
          temp_description: text,
          registration_step: 'REQ_PHOTO',
        });
        await ctx.reply(
          'Muammoni tasdiqlovchi rasm(lar) yuboring: / Отправьте фото, подтверждающие проблему:',
          Markup.keyboard([
            ['📸 Rasmsiz davom etish / Продолжить без фото'],
            ['❌ Bekor qilish / Отмена'],
          ])
            .oneTime()
            .resize(),
        );
        return;

      case 'REQ_PHOTO':
        if (
          text &&
          (text.includes('Rasmsiz davom etish') ||
            text.includes('Продолжить без фото'))
        ) {
          await this.botService.updateUserData(userId, {
            registration_step: 'REQ_CONFIRM',
          });
          await this.showConfirmationSummary(ctx);
          return;
        }

        if (text === '✅ Tayyor / Готово') {
          if (!user.temp_photos || (user.temp_photos as any[]).length === 0) {
            await ctx.reply(
              'Iltimos, kamida bitta rasm yuboring yoki "📸 Rasmsiz davom etish" tugmasini bosing. / Пожалуйста, отправьте хотя бы одно фото или нажмите кнопку "Продолжить без фото".',
            );
            return;
          }
          await this.botService.updateUserData(userId, {
            registration_step: 'REQ_CONFIRM',
          });
          await this.showConfirmationSummary(ctx);
          return;
        }

        if (message.photo) {
          const photos = message.photo;
          const fileId = photos[photos.length - 1].file_id;
          await this.botService.addTempPhoto(userId, fileId);

          if (
            !message.media_group_id ||
            ((user.temp_photos as any[]) || []).length % 5 === 0
          ) {
            await ctx.reply(
              `📸 Rasm qo'shildi. Yana rasm yuboring yoki quyidagilardan birini tanlang: / Фото добавлено. Отправьте еще фото или выберите один из вариантов:`,
              Markup.keyboard([
                ['✅ Tayyor / Готово'],
                ['❌ Bekor qilish / Отмена'],
              ])
                .oneTime()
                .resize(),
            );
          }
          return;
        }
        if (text !== '❌ Bekor qilish / Отмена') {
          await ctx.reply(
            'Iltimos, rasm yuboring yoki "✅ Tayyor" tugmasini bosing. / Пожалуйста, отправьте фото или нажмите кнопку "Готово".',
          );
        }
        return;

      case 'REQ_CONFIRM':
        if (
          text === '✅ Tasdiqlash / Подтвердить' ||
          text === '✅ Tayyor / Готово' ||
          text === '✅ Tasdiqlash'
        ) {
          await this.botService.createRequestFromTemp(userId);
          await ctx.reply(
            "Arizangiz muvaffaqiyatli yuborildi! JEK xodimlari tez orada ko'rib chiqishadi. / Ваша заявка успешно отправлена! Сотрудники ЖЭК рассмотрят ее в ближайшее время.",
            this.mainMenu(),
          );
          return;
        } else if (
          text === '❌ Bekor qilish / Отмена' ||
          text === '❌ Bekor qilish'
        ) {
          await this.botService.updateUserData(userId, {
            registration_step: 'COMPLETED',
            temp_district: null,
            temp_mahalla: null,
            temp_building_number: null,
            temp_apartment_number: null,
            temp_address: null,
            temp_description: null,
            temp_photos: null,
          });
          await ctx.reply(
            'Jarayon bekor qildi. / Процесс отменен.',
            this.mainMenu(),
          );
          return;
        }
        return;
    }
  }

  async showConfirmationSummary(ctx: Context) {
    const latestUser: any = await this.botService.findOrCreateUser(
      BigInt(ctx.from!.id),
    );
    const photoCount = Array.isArray(latestUser.temp_photos)
      ? latestUser.temp_photos.length
      : 0;
    const summary = `📄 <b>Murojaatni tasdiqlaysizmi? / Подтверждаете ли вы обращение?</b>\n\n📍 Hudud / Район: ${latestUser.temp_district}\n🏠 Manzil / Адрес: ${latestUser.temp_address}\n📝 Muammo / Проблема: ${latestUser.temp_description}\n📸 Rasmlar soni / Кол-во фото: ${photoCount} ta / шт`;
    await ctx.reply(summary, {
      parse_mode: 'HTML',
      ...Markup.keyboard([
        ['✅ Tasdiqlash / Подтвердить', '❌ Bekor qilish / Отмена'],
      ])
        .oneTime()
        .resize(),
    });
  }

  mainMenu() {
    return Markup.keyboard([
      ['✍️ Ariza yaratish / Создать заявку'],
      ['📋 Mening arizalarim / Мои заявки'],
    ]).resize();
  }

  districtMenu() {
    const districts = this.mahallaData.addresses;
    const buttons = districts.map((d) =>
      Markup.button.callback(d, `dist_${d}`),
    );
    return Markup.inlineKeyboard(buttons, { columns: 2 });
  }

  mahallaMenu(districtName: string) {
    const mahallas = this.mahallaData.mahallas[districtName] || [];
    const buttons = mahallas.map((m: string) =>
      Markup.button.callback(m, `mhl_${m}`),
    );
    return Markup.inlineKeyboard(buttons, { columns: 2 });
  }
}
