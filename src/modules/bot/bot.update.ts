import { Update, Start, On, Action } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { BotService } from './bot.service';
import { Logger } from '@nestjs/common';
import { District } from '@prisma/client';
import { BotFlowService } from './bot-flow.service';

@Update()
export class BotUpdate {
    private readonly logger = new Logger(BotUpdate.name);

    constructor(
        private readonly botService: BotService,
        private readonly botFlowService: BotFlowService
    ) { }

    @Start()
    async onStart(ctx: Context) {
        if (!ctx.from) return;
        try {
            const user: any = await this.botService.findOrCreateUser(ctx.from.id);
            if (user.registration_step === 'COMPLETED') {
                await ctx.reply('Xush kelibsiz! Har qanday murojaat uchun quyidagi menyudan foydalaning:', this.botFlowService.mainMenu());
                return;
            }
            await this.handleStep(ctx, String(user.registration_step || 'FIRST_NAME'));
            return;
        } catch (error) {
            this.logger.error('Error in onStart:', error);
            await ctx.reply('Xatolik yuz berdi. /start buyrug\'ini bering.');
            return;
        }
    }

    @Action(/^district_/)
    async onDistrictSelect(ctx: Context) {
        if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
        try {
            const district = (ctx.callbackQuery as any).data.replace('district_', '') as District;
            await this.botService.updateUserData(ctx.from.id, { temp_district: district, registration_step: 'REQ_MAHALLA' });
            await ctx.answerCbQuery();
            await ctx.editMessageText(`Tanlangan hudud: ${district.replace('_', ' ')}`);
            await ctx.reply('Mahalla nomini kiriting:', Markup.keyboard([['❌ Bekor qilish']]).oneTime().resize());
            return;
        } catch (error) {
            this.logger.error('Error in onDistrictSelect:', error);
            return;
        }
    }

    @Action(/^requests_page_/)
    async onPageChange(ctx: Context) {
        if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
        try {
            const pageSelect = (ctx.callbackQuery as any).data.split('_');
            const page = parseInt(pageSelect[pageSelect.length - 1]);

            // Avval tahrirlashni ko'ramiz
            try {
                await this.listRequests(ctx, page, true);
            } catch (e) {
                // Agar tahrirlash xato bersa (masalan rasm bo'lsa), xabarni o'chirib yangi yuboramiz
                await ctx.deleteMessage().catch(() => { });
                await this.listRequests(ctx, page, false);
            }

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

            await ctx.deleteMessage().catch(() => { });
            let message = `📄 <b>Ariza tafsilotlari:</b> #${req.request_number}\n\n📍 Hudud: ${req.district.replace('_', ' ')}\n🏠 Manzil: ${req.address}\n📝 Muammo: ${req.description}\n⏳ Holat: ${req.status}\n`;
            if (req.note) message += `💬 Izoh: ${req.note}\n`;
            if (req.rejection_reason) message += `⚠️ Rad etish sababi: ${req.rejection_reason}\n`;
            message += `📅 Sana: ${req.createdAt.toLocaleDateString()}\n`;

            const buttons: any[] = [];

            // Agar ariza JEK tomonidan ko'rib chiqilgan bo'lsa, tugmalarni qo'shish
            if (req.status === 'JEK_COMPLETED' || req.status === 'JEK_REJECTED') {
                buttons.push([Markup.button.callback('✅ Tasdiqlash', `user_confirm_req_${req.id}`)]);
                buttons.push([Markup.button.callback('❌ E\'tiroz bildirish', `user_reject_req_${req.id}`)]);
            }

            buttons.push([Markup.button.callback('⬅️ Ro\'yxatga qaytish', `requests_page_${page}`)]);
            const keyboard = Markup.inlineKeyboard(buttons);

            const firstPhoto = req.requestPhotos?.[0];
            if (firstPhoto) {
                const photoPath = require('path').join(process.cwd(), firstPhoto.file_url.startsWith('/') ? firstPhoto.file_url.substring(1) : firstPhoto.file_url);
                await ctx.replyWithPhoto({ source: photoPath }, { caption: message, parse_mode: 'HTML', ...keyboard });
            } else {
                await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
            }
            await ctx.answerCbQuery();
            return;
        } catch (error) {
            this.logger.error('Error onViewRequest:', error);
            return;
        }
    }

    @Action(/^user_confirm_req_/)
    async onUserConfirm(ctx: Context) {
        if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
        try {
            const requestId = (ctx.callbackQuery as any).data.replace('user_confirm_req_', '');
            await this.botService.updateRequestStatus(requestId, 'COMPLETED');
            await ctx.answerCbQuery('Murojaat yakunlandi. Rahmat!');
            await ctx.editMessageText('✅ Siz ushbu murojaat yopilishini tasdiqladingiz. Rahmat!');
            return;
        } catch (error) {
            this.logger.error('Error onUserConfirm:', error);
            return;
        }
    }

    @Action(/^user_reject_req_/)
    async onUserReject(ctx: Context) {
        if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
        try {
            const requestId = (ctx.callbackQuery as any).data.replace('user_reject_req_', '');
            await this.botService.updateUserData(ctx.from.id, {
                registration_step: 'REQ_USER_REJECTION_REASON',
                temp_reject_request_id: requestId
            });
            await ctx.answerCbQuery();
            await ctx.reply('Iltimos, e\'tirozingiz sababini yozib qoldiring:');
            return;
        } catch (error) {
            this.logger.error('Error onUserReject:', error);
            return;
        }
    }

    @On('message')
    async onMessage(ctx: Context) {
        if (!ctx.from) return;
        try {
            const user: any = await this.botService.findOrCreateUser(ctx.from.id);
            const message = ctx.message as any;
            const text = message.text;

            if (text === '❌ Bekor qilish') {
                await this.botService.updateUserData(ctx.from.id, {
                    registration_step: 'COMPLETED',
                    temp_district: null, temp_mahalla: null, temp_street: null,
                    temp_house: null, temp_address: null, temp_description: null, temp_photos: null,
                    temp_reject_request_id: null
                });
                await ctx.reply('Jarayon bekor qilindi.', this.botFlowService.mainMenu());
                return;
            }

            // E'tiroz sababini qabul qilish
            if (user.registration_step === 'REQ_USER_REJECTION_REASON') {
                if (!text) {
                    await ctx.reply('Iltimos, e\'tiroz sababini matn ko\'rinishida yozing:');
                    return;
                }
                const requestId = user.temp_reject_request_id;
                await this.botService.processUserRejection(requestId, text, ctx.from.id);
                await this.botService.updateUserData(ctx.from.id, {
                    registration_step: 'COMPLETED',
                    temp_reject_request_id: null
                });
                await ctx.reply('E\'tirozingiz qabul qilindi. Ariza qayta ko\'rib chiqish uchun PENDING holatiga o\'tkazildi.', this.botFlowService.mainMenu());
                return;
            }

            // Asosiy menyu amallari
            if (user.registration_step === 'COMPLETED') {
                if (text === '✍️ Ariza yaratish') {
                    await this.botService.updateUserData(ctx.from.id, { registration_step: 'REQ_DISTRICT' });
                    await ctx.reply('Iltimos, hududni tanlang:', this.botFlowService.districtMenu());
                    return;
                } else if (text === '📋 Mening arizalarim') {
                    await this.listRequests(ctx, 1);
                    return;
                } else if (text === '👤 Profilim') {
                    await ctx.reply(`Sizning ma'lumotlaringiz:\nIsm: ${user.first_name}\nFamiliya: ${user.last_name}\nTel: ${user.phoneNumber}`);
                    return;
                } else if (text === 'ℹ️ Ma\'bot') {
                    await ctx.reply('Ushbu bot orqali JEK xizmatlariga ariza yuborishingiz mumkin.');
                    return;
                } else {
                    await ctx.reply('Iltimos, har qanday amalni bajarish uchun quyidagi menyudan foydalaning:', this.botFlowService.mainMenu());
                    return;
                }
            }

            // O'tish bosqichlari (Registration vs Request)
            if (['FIRST_NAME', 'LAST_NAME', 'PHONE_NUMBER'].includes(user.registration_step)) {
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
            await ctx.reply('Texnik nosozlik. Iltimos, kuting...');
            return;
        }
    }

    async listRequests(ctx: Context, page: number, isEdit: boolean = false) {
        if (!ctx.from) return;
        const { requests, totalPages, total } = await this.botService.getUserRequests(ctx.from.id, page);
        if (total === 0) {
            const msg = 'Sizda hozircha faol arizalaringiz mavjud emas.';
            if (isEdit) {
                await ctx.editMessageText(msg);
            } else {
                await ctx.reply(msg);
            }
            return;
        }

        let message = `📋 <b>Sizning faol arizalaringiz</b> (Jami: ${total})\n\n`;
        const actionRow: any[] = [];
        requests.forEach((req: any, index: number) => {
            const statusEmoji = req.status === 'COMPLETED' || req.status === 'JEK_COMPLETED' ? '✅' : (req.status === 'REJECTED' || req.status === 'JEK_REJECTED' ? '❌' : '⏳');
            const rowNum = (page - 1) * 5 + index + 1;
            message += `${rowNum}. <b>#${req.request_number}</b>\n📝 Holat: ${statusEmoji} ${req.status}\n📅 Sana: ${req.createdAt.toLocaleDateString()}\n\n`;
            actionRow.push(Markup.button.callback(`${rowNum}`, `view_req_${req.id}_p_${page}`));
        });

        const buttons: any[] = [actionRow];
        const navButtons: any[] = [];
        if (page > 1) navButtons.push(Markup.button.callback('⬅️ Oldingi', `requests_page_${page - 1}`));
        if (totalPages && page < totalPages) navButtons.push(Markup.button.callback('Keyingi ➡️', `requests_page_${page + 1}`));
        if (navButtons.length > 0) buttons.push(navButtons);

        const keyboard = Markup.inlineKeyboard(buttons);
        if (isEdit) {
            await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
        } else {
            await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
        }
        return;
    }

    async handleStep(ctx: Context, step: string) {
        switch (step) {
            case 'FIRST_NAME': await ctx.reply('Ismingizni kiriting:'); break;
            case 'LAST_NAME': await ctx.reply('Familiyangizni kiriting:'); break;
            case 'PHONE_NUMBER': await ctx.reply('Telefon raqamingizni yuboring:', Markup.keyboard([Markup.button.contactRequest('📞 Kontakni yuborish')]).oneTime().resize()); break;
            case 'REQ_DISTRICT': await ctx.reply('Hududni tanlang:', this.botFlowService.districtMenu()); break;
            case 'REQ_MAHALLA': await ctx.reply('Mahalla nomini kiriting:', Markup.keyboard([['❌ Bekor qilish']]).oneTime().resize()); break;
            case 'REQ_STREET': await ctx.reply('Ko\'cha nomini kiriting:', Markup.keyboard([['❌ Bekor qilish']]).oneTime().resize()); break;
            case 'REQ_HOUSE': await ctx.reply('Uy raqamini kiriting:', Markup.keyboard([['❌ Bekor qilish']]).oneTime().resize()); break;
            case 'REQ_DESCRIPTION': await ctx.reply('Muammo tavsifini yozing:', Markup.keyboard([['❌ Bekor qilish']]).oneTime().resize()); break;
            case 'REQ_PHOTO': await ctx.reply('Muammoni tasdiqlovchi rasm(lar) yuboring:', Markup.keyboard([['📸 Rasmsiz davom etish'], ['❌ Bekor qilish']]).oneTime().resize()); break;
            case 'REQ_CONFIRM': await this.botFlowService.showConfirmationSummary(ctx); break;
            default: await ctx.reply('Menyudan foydalaning:', this.botFlowService.mainMenu());
        }
    }
}
