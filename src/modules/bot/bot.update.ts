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
        private readonly botFlowService: BotFlowService
    ) { }

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
                    temp_photos: null,
                    temp_reject_request_id: null
                });
                await ctx.reply('Saytga xush kelibsiz! Jarayon yangilandi. / Добро пожаловать! Процесс обновлен.');
                await ctx.reply('Quyidagi menyudan birini tanlang: / Выберите один из пунктов меню:', this.botFlowService.mainMenu());
                return;
            }

            if (user.registration_step !== 'COMPLETED') {
                await ctx.reply('Saytga xush kelibsiz! / Добро пожаловать!');
                await this.handleStep(ctx, String(user.registration_step));
            } else {
                await ctx.reply('Saytga xush kelibsiz! Quyidagi menyudan birini tanlang: / Добро пожаловать! Выберите один из пунктов меню:', this.botFlowService.mainMenu());
            }
            return;
        } catch (error) {
            this.logger.error('Error in onStart:', error);
            await ctx.reply('Xatolik yuz berdi. /start buyrug\'ini bering. / Произошла ошибка. Введите команду /start.');
            return;
        }
    }

    @Action(/^dist_/)
    async onDistrictSelect(ctx: Context) {
        if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
        try {
            const district = (ctx.callbackQuery as any).data.replace('dist_', '');
            await this.botService.updateUserData(ctx.from.id, { temp_district: district, registration_step: 'REQ_MAHALLA' });
            await ctx.answerCbQuery();
            await ctx.editMessageText(`Tanlangan hudud / Выбранный район: ${district}\n\nEndi mahalla nomini tanlang: / Теперь выберите махаллю:`, this.botFlowService.mahallaMenu(district));
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
            await this.botService.updateUserData(ctx.from.id, { temp_mahalla: mahalla, registration_step: 'REQ_BUILDING' });
            await ctx.answerCbQuery();
            await ctx.editMessageText(`Tanlangan mahalla / Выбранная махалля: ${mahalla}`);
            await ctx.reply('Bino raqamini (uy raqami) kiriting: / Введите номер дома:', Markup.keyboard([['❌ Bekor qilish / Отмена']]).oneTime().resize());
            return;
        } catch (error) {
            this.logger.error('Error in onMahallaSelect:', error);
            return;
        }
    }

    // ... (onPageChange o'zgarishsiz qoladi)

    @Action(/^view_req_/)
    async onViewRequest(ctx: Context) {
        if (!ctx.from || !('data' in ctx.callbackQuery!)) return;
        try {
            const data = (ctx.callbackQuery as any).data.split('_');
            const reqId = data[2];
            const page = data[4] || '1';
            const req: any = await this.botService.getRequestById(reqId);
            if (!req) {
                await ctx.answerCbQuery('Ariza topilmadi / Заявка не найдена.');
                return;
            }

            await ctx.deleteMessage().catch(() => { });
            const fullAddr = `${req.address.district}, ${req.address.neighborhood} m. ${req.address.building_number ? ', ' + req.address.building_number + '-bino / дом' : ''}${req.address.apartment_number ? ', ' + req.address.apartment_number + '-xonadon / кв' : ''}`;

            let message = `📄 <b>Ariza tafsilotlari / Детали заявки:</b> #${req.request_number}\n\n📍 Hudud / Район: ${req.address.district}\n🏠 Manzil / Адрес: ${fullAddr}\n📝 Muammo / Проблема: ${req.description}\n⏳ Holat / Статус: ${req.status}\n`;
            if (req.note) message += `💬 Izoh / Примечание: ${req.note}\n`;
            if (req.rejection_reason) message += `⚠️ Rad etish sababi / Причина отказа: ${req.rejection_reason}\n`;
            message += `📅 Sana / Дата: ${req.createdAt.toLocaleDateString()}\n`;

            const buttons: any[] = [];

            if (req.status === 'JEK_COMPLETED' || req.status === 'JEK_REJECTED') {
                buttons.push([Markup.button.callback('✅ Tasdiqlash / Подтвердить', `user_confirm_req_${req.id}`)]);
                buttons.push([Markup.button.callback('❌ E\'tiroz bildirish / Оспорить', `user_reject_req_${req.id}`)]);
            }

            buttons.push([Markup.button.callback('⬅️ Ro\'yxatga qaytish / К списку', `requests_page_${page}`)]);
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
                    temp_district: null, temp_mahalla: null, temp_building_number: null,
                    temp_apartment_number: null, temp_address: null, temp_description: null, temp_photos: null,
                    temp_reject_request_id: null
                });
                await ctx.reply('Jarayon bekor qilindi. / Процесс отменен.', this.botFlowService.mainMenu());
                return;
            }

            // E'tiroz sababini qabul qilish
            if (user.registration_step === 'REQ_USER_REJECTION_REASON') {
                if (!text) {
                    await ctx.reply('Iltimos, e\'tiroz sababini matn ko\'rinishida yozing. / Пожалуйста, напишите причину спора текстом:');
                    return;
                }
                const requestId = user.temp_reject_request_id;
                await this.botService.processUserRejection(requestId, text, ctx.from.id);
                await this.botService.updateUserData(ctx.from.id, {
                    registration_step: 'COMPLETED',
                    temp_reject_request_id: null
                });
                await ctx.reply('E\'tirozingiz qabul qilindi. / Ваш спор принят.', this.botFlowService.mainMenu());
                return;
            }

            // Asosiy menyu amallari
            if (user.registration_step === 'COMPLETED') {
                if (text === '✍️ Ariza yaratish / Создать заявку' || text === '✍️ Ariza yaratish') {
                    await this.botService.updateUserData(ctx.from.id, { registration_step: 'REQ_DISTRICT' });
                    await ctx.reply('Iltimos, hududni tanlang: / Пожалуйста, выберите район:', this.botFlowService.districtMenu());
                    return;
                } else if (text === '📋 Mening arizalarim / Мои заявки' || text === '📋 Mening arizalarim') {
                    await this.listRequests(ctx, 1);
                    return;
                } else {
                    await ctx.reply('Iltimos, quyidagi menyudan foydalaning: / Пожалуйста, используйте меню ниже:', this.botFlowService.mainMenu());
                    return;
                }
            }

            // O'tish bosqichlari
            if (['FULL_NAME', 'FIRST_NAME', 'LAST_NAME', 'PHONE_NUMBER'].includes(user.registration_step)) {
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
            await ctx.reply('Texnik nosozlik. Iltimos, kuting... / Техническая ошибка. Пожалуйста, подождите...');
            return;
        }
    }

    async listRequests(ctx: Context, page: number, isEdit: boolean = false) {
        if (!ctx.from) return;
        const { requests, totalPages, total } = await this.botService.getUserRequests(ctx.from.id, page);
        if (total === 0) {
            const msg = 'Sizda hozircha faol arizalaringiz mavjud emas. / У вас пока нет активных заявок.';
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
            const statusEmoji = req.status === 'COMPLETED' || req.status === 'JEK_COMPLETED' ? '✅' : (req.status === 'REJECTED' || req.status === 'JEK_REJECTED' ? '❌' : '⏳');
            const rowNum = (page - 1) * 5 + index + 1;
            message += `${rowNum}. <b>#${req.request_number}</b>\n📝 Holat / Статус: ${statusEmoji} ${req.status}\n📅 Sana / Дата: ${req.createdAt.toLocaleDateString()}\n\n`;
            actionRow.push(Markup.button.callback(`${rowNum}`, `view_req_${req.id}_p_${page}`));
        });

        const buttons: any[] = [actionRow];
        const navButtons: any[] = [];
        if (page > 1) navButtons.push(Markup.button.callback('⬅️ Oldingi / Пред', `requests_page_${page - 1}`));
        if (totalPages && page < totalPages) navButtons.push(Markup.button.callback('Keyingi / След ➡️', `requests_page_${page + 1}`));
        if (navButtons.length > 0) buttons.push(navButtons);

        const keyboard = Markup.inlineKeyboard(buttons);
        if (isEdit) {
            await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
        } else {
            await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
        }
    }

    async handleStep(ctx: Context, step: string) {
        switch (step) {
            case 'FULL_NAME':
            case 'FIRST_NAME': await ctx.reply('Ism-sharifingizni kiriting: / Введите ваше ФИО:'); break;
            case 'PHONE_NUMBER': await ctx.reply('Telefon raqamingizni yuboring: / Отправьте ваш номер телефона:', Markup.keyboard([[Markup.button.contactRequest('📞 Kontakni yuborish / Отправить контакт')]]).oneTime().resize()); break;
            case 'REQ_DISTRICT': await ctx.reply('Hududni tanlang: / Выберите район:', this.botFlowService.districtMenu()); break;
            case 'REQ_MAHALLA':
                const u: any = await this.botService.findOrCreateUser(ctx.from!.id);
                await ctx.reply('Mahalla nomini tanlang: / Выберите махаллю:', this.botFlowService.mahallaMenu(u.temp_district));
                break;
            case 'REQ_BUILDING': await ctx.reply('Bino raqamini (uy raqami) kiriting: / Введите номер дома:', Markup.keyboard([['❌ Bekor qilish / Отмена']]).oneTime().resize()); break;
            case 'REQ_APARTMENT': await ctx.reply('Xonadon raqamini kiriting: / Введите номер квартиры:', Markup.keyboard([['❌ Bekor qilish / Отмена']]).oneTime().resize()); break;
            case 'REQ_DESCRIPTION': await ctx.reply('Muammo tavsifini yozing: / Опишите проблему:', Markup.keyboard([['❌ Bekor qilish / Отмена']]).oneTime().resize()); break;
            case 'REQ_PHOTO': await ctx.reply('Muammoni tasdiqlovchi rasm(lar) yuboring: / Отправьте фото:', Markup.keyboard([['📸 Rasmsiz davom etish / Без фото'], ['❌ Bekor qilish / Отмена']]).oneTime().resize()); break;
            case 'REQ_CONFIRM': await this.botFlowService.showConfirmationSummary(ctx); break;
            default: await ctx.reply('Menyudan foydalaning: / Используйте меню:', this.botFlowService.mainMenu());
        }
    }
}
