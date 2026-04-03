import { Update, Start, On, Action, Message } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { BotService } from './bot.service';
import { Logger } from '@nestjs/common';
import { District } from '@prisma/client';

@Update()
export class BotUpdate {
    private readonly logger = new Logger(BotUpdate.name);

    constructor(private readonly botService: BotService) { }

    private mainMenu() {
        return Markup.keyboard([
            ['✍️ Ariza yaratish', '📋 Mening arizalarim'],
            ['👤 Profilim', 'ℹ️ Ma\'lumot']
        ]).resize();
    }

    private districtMenu() {
        const districts = Object.values(District);
        const buttons = districts.map(d => Markup.button.callback(d.replace('_', ' '), `district_${d}`));
        // Tugmalarni 2 qatordan qilib taxlaymiz
        return Markup.inlineKeyboard(buttons, { columns: 2 });
    }

    @Start()
    async onStart(ctx: Context) {
        if (!ctx.from) return;
        try {
            const user: any = await this.botService.findOrCreateUser(ctx.from.id);
            this.logger.log(`User ${ctx.from.id} started bot. Step: ${user.registration_step}`);

            if (user.registration_step === 'COMPLETED') {
                await ctx.reply('Xush kelibsiz! Har qanday murojaat uchun quyidagi menyudan foydalaning:', this.mainMenu());
                return;
            }

            const step = String(user.registration_step || 'FIRST_NAME');
            await this.handleStep(ctx, step);
        } catch (error) {
            this.logger.error('Error in onStart Bot:', error);
            await ctx.reply('Xatolik yuz berdi. Qaytadan /start buyrug\'ini bering.');
        }
    }

    @Action(/^district_/)
    async onDistrictSelect(ctx: Context) {
        if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
        try {
            const district = ctx.callbackQuery.data.replace('district_', '') as District;
            await this.botService.updateUserData(ctx.from.id, {
                temp_district: district,
                registration_step: 'REQ_MAHALLA'
            });
            await ctx.answerCbQuery();
            await ctx.editMessageText(`Tanlangan hudud: ${district.replace('_', ' ')}`);
            await ctx.reply('Mahalla nomini kiriting:', Markup.keyboard([['❌ Bekor qilish']]).oneTime().resize());
        } catch (error) {
            this.logger.error('Error in onDistrictSelect:', error);
        }
    }

    @Action(/^requests_page_/)
    async onPageChange(ctx: Context) {
        if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
        try {
            const page = parseInt(ctx.callbackQuery.data.split('_')[2]);
            await this.listRequests(ctx, page, true);
            await ctx.answerCbQuery();
        } catch (error) {
            this.logger.error('Error onPageChange:', error);
        }
    }

    @Action(/^view_req_/)
    async onViewRequest(ctx: Context) {
        if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
        try {
            const data = ctx.callbackQuery.data.split('_');
            const reqId = data[2];
            const page = data[4] || '1';

            const req: any = await this.botService.getRequestById(reqId);

            if (!req) {
                return ctx.answerCbQuery('Ariza topilmadi.');
            }

            // Eski ro'yxatni o'chirib tashlaymiz
            await ctx.deleteMessage().catch(() => { });

            let message = `📄 *Ariza tafsilotlari:* #${req.request_number}\n\n`;
            message += `📍 Hudud: ${req.district.replace('_', ' ')}\n`;
            message += `🏠 Manzil: ${req.address}\n`;
            message += `📝 Muammo: ${req.description}\n`;
            message += `⏳ Holat: ${req.status}\n`;
            message += `📅 Sana: ${req.createdAt.toLocaleDateString()}\n`;

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('⬅️ Ro\'yxatga qaytish', `requests_page_${page}`)]
            ]);

            if (req.photo_url) {
                await ctx.replyWithPhoto(req.photo_url, { caption: message, parse_mode: 'Markdown', ...keyboard });
            } else {
                await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
            }

            await ctx.answerCbQuery();
        } catch (error) {
            this.logger.error('Error onViewRequest:', error);
        }
    }

    async listRequests(ctx: Context, page: number, isEdit: boolean = false) {
        if (!ctx.from) return;
        const { requests, totalPages, total } = await this.botService.getUserRequests(ctx.from.id, page);

        if (total === 0) {
            const msg = 'Sizda hozircha faol arizalar mavjud emas.';
            if (isEdit) await ctx.editMessageText(msg);
            else await ctx.reply(msg);
            return;
        }

        let message = `📋 *Sizning faol arizalaringiz* (Jami: ${total})\n\n`;
        const buttons: any[] = [];

        requests.forEach((req: any, index: number) => {
            const statusEmoji = req.status === 'COMPLETED' ? '✅' : (req.status === 'REJECTED' ? '❌' : '⏳');
            const rowNum = (page - 1) * 5 + index + 1;
            message += `${rowNum}. *#${req.request_number}* - ${statusEmoji} ${req.status}\n`;

            // Ko'rish tugmasiga sahifa raqamini ham qo'shamiz: view_req_${req.id}_p_${page}
            buttons.push([Markup.button.callback(`${rowNum}. 👀 Ko'rish`, `view_req_${req.id}_p_${page}`)]);
        });

        // Pagination tugmalari
        const navButtons: any[] = [];
        const currentPage = Number(page);
        if (currentPage > 1) navButtons.push(Markup.button.callback('⬅️ Oldingi', `requests_page_${currentPage - 1}`));
        if (totalPages && currentPage < totalPages) navButtons.push(Markup.button.callback('Keyingi ➡️', `requests_page_${currentPage + 1}`));

        if (navButtons.length > 0) {
            buttons.push(navButtons);
        }

        const keyboard = Markup.inlineKeyboard(buttons);

        if (isEdit) {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
        } else {
            await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
        }
    }

    @On('message')
    async onMessage(ctx: Context) {
        if (!ctx.from) return;
        try {
            const user: any = await this.botService.findOrCreateUser(ctx.from.id);
            const message = ctx.message as any;
            const text = message.text;

            // Bekor qilish har qanday bosqichda ishlashi uchun
            if (text === '❌ Bekor qilish') {
                await this.botService.updateUserData(ctx.from.id, {
                    registration_step: 'COMPLETED',
                    temp_district: null, temp_mahalla: null, temp_street: null,
                    temp_house: null, temp_address: null, temp_description: null, temp_photo: null
                });
                await ctx.reply('Jarayon bekor qilindi.', this.mainMenu());
                return;
            }

            // Ariza yaratishni boshlash
            if (user.registration_step === 'COMPLETED' && text === '✍️ Ariza yaratish') {
                await this.botService.updateUserData(ctx.from.id, { registration_step: 'REQ_DISTRICT' });
                await ctx.reply('Iltimos, hududni tanlang:', this.districtMenu());
                return;
            }

            // Ro'yxatdan o'tgan bo'lsa va menyu tugmalari bosilsa
            if (user.registration_step === 'COMPLETED') {
                if (text === '📋 Mening arizalarim') {
                    await this.listRequests(ctx, 1);
                } else if (text === '👤 Profilim') {
                    await ctx.reply(`Sizning ma'lumotlaringiz:\nIsm: ${user.first_name}\nFamiliya: ${user.last_name}\nTel: ${user.phoneNumber}`);
                } else {
                    await ctx.reply('Iltimos, har qanday amalni bajarish uchun quyidagi menyudan foydalaning:', this.mainMenu());
                }
                return;
            }

            // Muloqot bosqichlari
            switch (user.registration_step) {
                // RO'YXATDAN O'TISH
                case 'FIRST_NAME':
                    if (!text) return ctx.reply('Iltimos, ismingizni matn ko\'rinishida yuboring.');
                    await this.botService.updateUserData(ctx.from.id, { first_name: text, registration_step: 'LAST_NAME' });
                    await ctx.reply('Rahmat! Endi familiyangizni kiriting:');
                    break;
                case 'LAST_NAME':
                    if (!text) return ctx.reply('Iltimos, familiyangizni matn ko\'rinishida yuboring.');
                    await this.botService.updateUserData(ctx.from.id, { last_name: text, registration_step: 'PHONE_NUMBER' });
                    await ctx.reply('Oxirgi bosqich: telefon raqamingizni yuboring:', Markup.keyboard([Markup.button.contactRequest('📞 Kontakni yuborish')]).oneTime().resize());
                    break;
                case 'PHONE_NUMBER':
                    let phone = message.contact ? message.contact.phone_number : (text && /^\+?998\d{9}$/.test(text.replace(/\s/g, '')) ? text.replace(/\s/g, '') : null);
                    if (!phone) return ctx.reply('Iltimos, telefon raqamingizni yuboring yoki tugmani bosing.');
                    await this.botService.updateUserData(ctx.from.id, { phoneNumber: phone, registration_step: 'COMPLETED' });
                    await ctx.reply('Muvaffaqiyatli ro\'yxatdan o\'tdingiz! ✅', this.mainMenu());
                    break;

                // ARIZA YARATISH (Manzil bosqichlari)
                case 'REQ_DISTRICT':
                    await ctx.reply('Iltimos, tepadagi tugmalardan hududni tanlang:', this.districtMenu());
                    break;
                case 'REQ_MAHALLA':
                    if (!text) return ctx.reply('Iltimos, mahalla nomini kiriting:');
                    await this.botService.updateUserData(ctx.from.id, { temp_mahalla: text, registration_step: 'REQ_STREET' });
                    await ctx.reply('Ko\'cha nomini kiriting:');
                    break;
                case 'REQ_STREET':
                    if (!text) return ctx.reply('Iltimos, ko\'cha nomini kiriting:');
                    await this.botService.updateUserData(ctx.from.id, { temp_street: text, registration_step: 'REQ_HOUSE' });
                    await ctx.reply('Uy raqami / Xonadon raqamini kiriting:');
                    break;
                case 'REQ_HOUSE':
                    if (!text) return ctx.reply('Iltimos, uy raqamini kiriting:');
                    // Manzilni birlashtiramiz
                    const fullAddress = `${user.temp_mahalla} m., ${user.temp_street} ko'chasi, ${text}-uy`;
                    await this.botService.updateUserData(ctx.from.id, {
                        temp_house: text,
                        temp_address: fullAddress,
                        registration_step: 'REQ_DESCRIPTION'
                    });
                    await ctx.reply('Muammoni qisqacha tavsiflab bering (matn ko\'rinishida):');
                    break;

                case 'REQ_DESCRIPTION':
                    if (!text) {
                        await ctx.reply('Iltimos, muammo tavsifini yozib yuboring.');
                        return;
                    }
                    await this.botService.updateUserData(ctx.from.id, { temp_description: text, registration_step: 'REQ_PHOTO' });
                    await ctx.reply(
                        'Muammoni tasdiqlovchi rasm yuborishingiz mumkin (yoki tugmani bosing):',
                        Markup.keyboard([['📸 Rasmsiz davom etish'], ['❌ Bekor qilish']]).oneTime().resize()
                    );
                    break;
                case 'REQ_PHOTO':
                    let photoId = message.photo ? message.photo[message.photo.length - 1].file_id : null;

                    if (text === '📸 Rasmsiz davom etish') {
                        photoId = null;
                    } else if (text === '❌ Bekor qilish') {
                        await this.botService.updateUserData(ctx.from.id, {
                            registration_step: 'COMPLETED',
                            temp_district: null,
                            temp_address: null,
                            temp_description: null,
                            temp_photo: null
                        });
                        await ctx.reply('Jarayon bekor qilindi.', this.mainMenu());
                        return;
                    } else if (!photoId) {
                        await ctx.reply('Iltimos, rasm yuboring yoki "📸 Rasmsiz davom etish" tugmasini bosing:', Markup.keyboard([['📸 Rasmsiz davom etish'], ['❌ Bekor qilish']]).oneTime().resize());
                        return;
                    }

                    await this.botService.updateUserData(ctx.from.id, { temp_photo: photoId, registration_step: 'REQ_CONFIRM' });
                    const summary = `Murojaatni tasdiqlaysizmi?\n\nHudud: ${user.temp_district?.replace('_', ' ')}\nManzil: ${user.temp_address}\nMuammo: ${user.temp_description}\nRasm: ${photoId ? '✅ Yuborilgan' : '❌ Yo\'q'}`;
                    await ctx.reply(summary, Markup.keyboard([['✅ Tasdiqlash', '❌ Bekor qilish']]).oneTime().resize());
                    break;
                case 'REQ_CONFIRM':
                    if (text === '✅ Tasdiqlash') {
                        await this.botService.createRequestFromTemp(ctx.from.id);
                        await ctx.reply('Arizangiz muvaffaqiyatli yuborildi! JEK xodimlari tez orada ko\'rib chiqishadi.', this.mainMenu());
                    } else {
                        await this.botService.updateUserData(ctx.from.id, {
                            registration_step: 'COMPLETED',
                            temp_district: null,
                            temp_address: null,
                            temp_description: null,
                            temp_photo: null
                        });
                        await ctx.reply('Jarayon bekor qilindi.', this.mainMenu());
                    }
                    break;
                default:
                    await ctx.reply('Tushunarsiz buyruq. /start bosing.');
            }
        } catch (error) {
            this.logger.error('Error in onMessage:', error);
            await ctx.reply('Texnik nosozlik. Iltimos, kuting...');
        }
    }

    async handleStep(ctx: Context, step: string) {
        switch (step) {
            case 'FIRST_NAME': await ctx.reply('Ismingizni kiriting:'); break;
            case 'LAST_NAME': await ctx.reply('Familiyangizni kiriting:'); break;
            case 'PHONE_NUMBER': await ctx.reply('Telefon raqamingizni yuboring:', Markup.keyboard([Markup.button.contactRequest('📞 Kontakni yuborish')]).oneTime().resize()); break;
            case 'REQ_DISTRICT': await ctx.reply('Hududni tanlang:', this.districtMenu()); break;
            case 'REQ_MAHALLA': await ctx.reply('Mahalla nomini kiriting:', Markup.keyboard([['❌ Bekor qilish']]).oneTime().resize()); break;
            case 'REQ_STREET': await ctx.reply('Ko\'cha nomini kiriting:', Markup.keyboard([['❌ Bekor qilish']]).oneTime().resize()); break;
            case 'REQ_HOUSE': await ctx.reply('Uy raqamini kiriting:', Markup.keyboard([['❌ Bekor qilish']]).oneTime().resize()); break;
            case 'REQ_DESCRIPTION': await ctx.reply('Muammo tavsifini yozing:', Markup.keyboard([['❌ Bekor qilish']]).oneTime().resize()); break;
            case 'REQ_PHOTO': await ctx.reply('Muammoni tasdiqlovchi rasm yuboring:', Markup.keyboard([['📸 Rasmsiz davom etish'], ['❌ Bekor qilish']]).oneTime().resize()); break;
            case 'REQ_CONFIRM': await ctx.reply('Tasdiqlaysizmi?', Markup.keyboard([['✅ Tasdiqlash', '❌ Bekor qilish']]).oneTime().resize()); break;
            default: await ctx.reply('Menyudan foydalaning:', this.mainMenu());
        }
    }
}
