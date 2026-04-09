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
     * Foydalanuvchini ro'yxatdan o'tkazish (FIRST_NAME, LAST_NAME, PHONE_NUMBER)
     */
    async handleRegistration(ctx: Context, user: any, message: any) {
        const text = message.text;
        const userId = ctx.from!.id;
        const currentStep = user.registration_step;

        this.logger.log(`User ${userId} registration step: ${currentStep}, text: ${text}`);

        if (currentStep === 'FIRST_NAME') {
            if (!text) {
                await ctx.reply('Iltimos, ismingizni matn ko\'rinishida yuboring.');
                return;
            }
            await this.botService.updateUserData(userId, { first_name: text, registration_step: 'LAST_NAME' });
            await ctx.reply('Rahmat! Endi familiyangizni kiriting:');
            return;
        }

        if (currentStep === 'LAST_NAME') {
            if (!text) {
                await ctx.reply('Iltimos, familiyangizni matn ko\'rinishida yuboring.');
                return;
            }
            await this.botService.updateUserData(userId, { last_name: text, registration_step: 'PHONE_NUMBER' });
            await ctx.reply('Oxirgi bosqich: telefon raqamingizni yuboring:', Markup.keyboard([
                [Markup.button.contactRequest('📞 Kontakni yuborish')],
                ['❌ Bekor qilish']
            ]).oneTime().resize());
            return;
        }

        if (currentStep === 'PHONE_NUMBER') {
            let phone = message.contact ? message.contact.phone_number : (text && /^(?:\+?998)?\d{9}$/.test(text.replace(/\s/g, '')) ? text.replace(/\s/g, '') : null);
            if (!phone) {
                await ctx.reply('Iltimos, telefon raqamingizni yuboring yoki "📞 Kontakni yuborish" tugmasini bosing.');
                return;
            }
            await this.botService.updateUserData(userId, { phoneNumber: phone, registration_step: 'COMPLETED' });
            await ctx.reply('Muvaffaqiyatli ro\'yxatdan o\'tdingiz! ✅', this.mainMenu());
            return;
        }
    }

    /**
     * Ariza yaratish jarayoni
     */
    async handleRequestFlow(ctx: Context, user: any, message: any) {
        const text = message.text;
        const userId = ctx.from!.id;

        switch (user.registration_step) {
            case 'REQ_DISTRICT':
                await ctx.reply('Iltimos, tepadagi tugmalardan hududni tanlang:', this.districtMenu());
                return;

            case 'REQ_MAHALLA':
                if (text === '❌ Bekor qilish') return;
                const userData: any = await this.botService.findOrCreateUser(userId);
                await ctx.reply('Iltimos, yuqoridagi tugmalardan mahallani tanlang:', this.mahallaMenu(userData.temp_district));
                return;

            case 'REQ_STREET':
                if (text === '❌ Bekor qilish') return;
                if (!text) {
                    await ctx.reply('Iltimos, ko\'cha nomini kiriting:');
                    return;
                }
                await this.botService.updateUserData(userId, { temp_street: text, registration_step: 'REQ_HOUSE' });
                await ctx.reply('Uy raqami / Xonadon raqamini kiriting:');
                return;

            case 'REQ_HOUSE':
                if (text === '❌ Bekor qilish') return;
                if (!text) {
                    await ctx.reply('Iltimos, uy raqamini kiriting:');
                    return;
                }
                const fullAddress = `${user.temp_mahalla} m., ${user.temp_street} ko'chasi, ${text}-uy`;
                await this.botService.updateUserData(userId, { temp_house: text, temp_address: fullAddress, registration_step: 'REQ_DESCRIPTION' });
                await ctx.reply('Muammoni qisqacha tavsiflab bering (matn ko\'rinishida):');
                return;

            case 'REQ_DESCRIPTION':
                if (text === '❌ Bekor qilish') return;
                if (!text) {
                    await ctx.reply('Iltimos, muammo tavsifini yozib yuboring.');
                    return;
                }
                await this.botService.updateUserData(userId, { temp_description: text, registration_step: 'REQ_PHOTO' });
                await ctx.reply('Muammoni tasdiqlovchi rasm(lar) yuboring:', Markup.keyboard([['📸 Rasmsiz davom etish'], ['❌ Bekor qilish']]).oneTime().resize());
                return;

            case 'REQ_PHOTO':
                if (text === '📸 Rasmsiz davom etish') {
                    await this.botService.updateUserData(userId, { registration_step: 'REQ_CONFIRM' });
                    await this.showConfirmationSummary(ctx);
                    return;
                }

                if (text === '✅ Tayyor') {
                    if (!user.temp_photos || (user.temp_photos as any[]).length === 0) {
                        await ctx.reply('Iltimos, kamida bitta rasm yuboring yoki "📸 Rasmsiz davom etish" tugmasini bosing.');
                        return;
                    }
                    await this.botService.updateUserData(userId, { registration_step: 'REQ_CONFIRM' });
                    await this.showConfirmationSummary(ctx);
                    return;
                }

                if (message.photo) {
                    const photos = message.photo;
                    const fileId = photos[photos.length - 1].file_id;
                    await this.botService.addTempPhoto(userId, fileId);

                    if (!message.media_group_id || (user.temp_photos as any[] || []).length % 5 === 0) {
                        await ctx.reply(`📸 Rasm qo'shildi. Yana rasm yuboring yoki quyidagilardan birini tanlang:`, Markup.keyboard([['✅ Tayyor'], ['❌ Bekor qilish']]).oneTime().resize());
                    }
                    return;
                }
                if (text !== '❌ Bekor qilish') {
                    await ctx.reply('Iltimos, rasm yuboring yoki "✅ Tayyor" tugmasini bosing.');
                }
                return;

            case 'REQ_CONFIRM':
                if (text === '✅ Tasdiqlash' || text === '✅ Tayyor') {
                    await this.botService.createRequestFromTemp(userId);
                    await ctx.reply('Arizangiz muvaffaqiyatli yuborildi! JEK xodimlari tez orada ko\'rib chiqishadi.', this.mainMenu());
                    return;
                } else if (text === '❌ Bekor qilish') {
                    await this.botService.updateUserData(userId, {
                        registration_step: 'COMPLETED',
                        temp_district: null, temp_mahalla: null, temp_street: null,
                        temp_house: null, temp_address: null, temp_description: null, temp_photos: null
                    });
                    await ctx.reply('Jarayon bekor qilindi.', this.mainMenu());
                    return;
                }
                return;
        }
    }

    async showConfirmationSummary(ctx: Context) {
        const latestUser: any = await this.botService.findOrCreateUser(ctx.from!.id);
        const photoCount = Array.isArray(latestUser.temp_photos) ? latestUser.temp_photos.length : 0;
        const summary = `📄 <b>Murojaatni tasdiqlaysizmi?</b>\n\n📍 Hudud: ${latestUser.temp_district?.replace('_', ' ')}\n🏠 Manzil: ${latestUser.temp_address}\n📝 Muammo: ${latestUser.temp_description}\n📸 Rasmlar soni: ${photoCount} ta`;
        await ctx.reply(summary, {
            parse_mode: 'HTML',
            ...Markup.keyboard([['✅ Tasdiqlash', '❌ Bekor qilish']]).oneTime().resize()
        });
    }

    mainMenu() {
        return Markup.keyboard([
            ['✍️ Ariza yaratish', '📋 Mening arizalarim'],
            ['👤 Profilim', 'ℹ️ Ma\'lumot']
        ]).resize();
    }

    districtMenu() {
        const districts = this.mahallaData.addresses;
        const buttons = districts.map(d => Markup.button.callback(d, `dist_${d}`));
        return Markup.inlineKeyboard(buttons, { columns: 2 });
    }

    mahallaMenu(districtName: string) {
        const mahallas = this.mahallaData.mahallas[districtName] || [];
        // Callback data limit is 64 bytes. Mahalla names are usually short enough.
        const buttons = mahallas.map((m: string) => Markup.button.callback(m, `mhl_${m}`));
        return Markup.inlineKeyboard(buttons, { columns: 2 });
    }
}
