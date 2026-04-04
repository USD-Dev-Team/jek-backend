import { Update, Start, On, Message } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { BotService } from './bot.service';
import { Logger } from '@nestjs/common';

@Update()
export class BotUpdate {
    private readonly logger = new Logger(BotUpdate.name);

    constructor(private readonly botService: BotService) { }

    @Start()
    async onStart(ctx: Context) {
        if (!ctx.from) return;
        try {
            const user: any = await this.botService.findOrCreateUser(ctx.from.id);
            this.logger.log(`User ${ctx.from.id} started bot. Step: ${user.registration_step}`);

            if (user.registration_step === 'COMPLETED') {
                await ctx.reply('Siz allaqachon ro\'yxatdan o\'tgansiz. Tez orada ariza yuborish bo\'limi ochiladi.');
                return;
            }

            const step = String(user.registration_step || 'FIRST_NAME');
            await this.handleStep(ctx, step);
            return;
        } catch (error) {
            this.logger.error('Error in onStart Bot:', error);
            await ctx.reply('Xatolik yuz berdi. Qaytadan /start buyrug\'ini bering.');
        }
    }

    @On('message')
    async onMessage(ctx: Context) {
        if (!ctx.from) return;
        try {
            const user: any = await this.botService.findOrCreateUser(ctx.from.id);
            const text = (ctx.message as any).text;

            if (user.registration_step === 'COMPLETED') return;

            switch (user.registration_step) {
                case 'FIRST_NAME':
                    if (!text) {
                        await ctx.reply('Iltimos, ismingizni matn ko\'rinishida yuboring.');
                        return;
                    }
                    await this.botService.updateUserData(ctx.from.id, { first_name: text, registration_step: 'LAST_NAME' });
                    await ctx.reply('Rahmat! Endi familiyangizni kiriting:');
                    break;

                case 'LAST_NAME':
                    if (!text) {
                        await ctx.reply('Iltimos, familiyangizni matn ko\'rinishida yuboring.');
                        return;
                    }
                    await this.botService.updateUserData(ctx.from.id, { last_name: text, registration_step: 'PHONE_NUMBER' });
                    await ctx.reply(
                        'Ajoyib! Oxirgi bosqich: telefon raqamingizni yuboring.',
                        Markup.keyboard([
                            Markup.button.contactRequest('📞 Kontakni yuborish'),
                        ]).oneTime().resize(),
                    );
                    break;

                case 'PHONE_NUMBER':
                    let phone = '';
                    if ((ctx.message as any).contact) {
                        phone = (ctx.message as any).contact.phone_number;
                    } else if (text && /^\+?998\d{9}$/.test(text.replace(/\s/g, ''))) {
                        phone = text.replace(/\s/g, '');
                    } else {
                        await ctx.reply('Iltimos, telefon raqamingizni +998XXXXXXXXX formatida yuboring yoki tugmani bosing.');
                        return;
                    }

                    await this.botService.updateUserData(ctx.from.id, { phoneNumber: phone, registration_step: 'COMPLETED' });
                    await ctx.reply('Muvaffaqiyatli ro\'yxatdan o\'tdingiz! ✅', Markup.removeKeyboard());
                    break;

                default:
                    await ctx.reply('Noma\'lum holat. Qaytadan boshlash uchun /start bosing.');
            }
        } catch (error) {
            this.logger.error('Error in onMessage Bot:', error);
            await ctx.reply('Texnik nosozlik. Iltimos, kuting...');
        }
    }

    async handleStep(ctx: Context, step: string) {
        switch (step) {
            case 'FIRST_NAME':
                await ctx.reply('Assalomu alaykum! JEK botiga xush kelibsiz. Ro\'yxatdan o\'tishni boshlaymiz.\nIsmingizni kiriting:');
                break;
            case 'LAST_NAME':
                await ctx.reply('Familiyangizni kiriting:');
                break;
            case 'PHONE_NUMBER':
                await ctx.reply(
                    'Telefon raqamingizni yuboring:',
                    Markup.keyboard([
                        Markup.button.contactRequest('📞 Kontakni yuborish'),
                    ]).oneTime().resize(),
                );
                break;
            default:
                await ctx.reply('Xatolik yuz berdi. Qaytadan /start buyrug\'ini bering.');
        }
    }
}
