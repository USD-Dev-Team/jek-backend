import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { MediaService } from '../media/media.service';
import { ConfigService } from '@nestjs/config';
import { RequestPhotosService } from '../request-photos/request-photos.service';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context, Markup } from 'telegraf';
import { Status_Flow } from '@prisma/client';

@Injectable()
export class BotService {
    private readonly logger = new Logger(BotService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mediaService: MediaService,
        private readonly configService: ConfigService,
        private readonly requestPhotosService: RequestPhotosService,
        @InjectBot() private bot: Telegraf<Context>
    ) { }

    /**
     * Foydalanuvchiga Telegram orqali xabar yuboradi
     */
    async sendNotification(telegramId: bigint, message: string) {
        try {
            await this.bot.telegram.sendMessage(Number(telegramId), message, { parse_mode: 'HTML' });
            this.logger.log(`Notification sent to user ${telegramId}`);
        } catch (error) {
            this.logger.error(`Error sending notification to user ${telegramId}:`, error);
        }
    }

    /**
     * Foydalanuvchiga tugmalar bilan bildirishnoma yuboradi
     */
    async sendNotificationWithButtons(telegramId: bigint, message: string, buttons: any) {
        try {
            await this.bot.telegram.sendMessage(Number(telegramId), message, {
                parse_mode: 'HTML',
                reply_markup: buttons.reply_markup || buttons
            });
            this.logger.log(`Notification with buttons sent to user ${telegramId}`);
        } catch (error) {
            this.logger.error(`Error sending button-notification to user ${telegramId}:`, error);
        }
    }

    /**
     * Ariza statusini o'zgartiradi
     */
    async updateRequestStatus(requestId: string, status: Status_Flow) {
        return this.prisma.requests.update({
            where: { id: requestId },
            data: { status }
        });
    }

    /**
     * Foydalanuvchi e'tirozini qayta ishlaydi va arizani PENDING holatiga qaytaradi
     */
    async processUserRejection(requestId: string, reason: string, telegramId: number) {
        const request = await this.prisma.requests.findUnique({ where: { id: requestId } });
        if (!request) throw new Error('Request not found');

        // Arizani PENDING holatiga qaytarish va e'tiroz sababini note-ga yozish
        await this.prisma.requests.update({
            where: { id: requestId },
            data: {
                status: 'PENDING' as Status_Flow,
                note: reason, // Foydalanuvchi e'tirozini note sifatida saqlash
                rejection_reason: null // Eski rad etish sababini o'chirib tashlash
            } as any
        });

        // Log yaratish
        await this.prisma.requestStatusLog.create({
            data: {
                request_id: requestId,
                old_status: request.status,
                new_status: 'PENDING',
                changed_by_role: 'USER',
                changed_by_id: String(telegramId),
                note: reason,
            },
        });
    }

    async findOrCreateUser(telegramId: number) {
        let user: any = await this.prisma.users.findUnique({
            where: { telegram_id: BigInt(telegramId) } as any,
        });

        if (!user) {
            user = await this.prisma.users.create({
                data: {
                    telegram_id: BigInt(telegramId),
                    registration_step: 'FIRST_NAME',
                } as any,
            });
        }

        if (!user.registration_step) {
            user = await this.prisma.users.update({
                where: { id: user.id },
                data: { registration_step: 'FIRST_NAME' } as any
            });
        }

        return user;
    }

    async updateUserData(telegramId: number, data: any) {
        if (data.phoneNumber) {
            data.phoneNumber = data.phoneNumber.replace(/\D/g, '');
            if (data.phoneNumber.length === 9) data.phoneNumber = `998${data.phoneNumber}`;
        }

        const updated = await this.prisma.users.update({
            where: { telegram_id: BigInt(telegramId) } as any,
            data: data as any,
        });

        this.logger.log(`User ${telegramId} data updated: registration_step -> ${updated.registration_step}`);
        return updated;
    }

    async addTempPhoto(telegramId: number, fileId: string) {
        const user: any = await this.prisma.users.findUnique({
            where: { telegram_id: BigInt(telegramId) } as any,
        });

        const currentPhotos = Array.isArray(user.temp_photos) ? user.temp_photos : [];
        const updatedPhotos = [...currentPhotos, fileId];

        return this.prisma.users.update({
            where: { telegram_id: BigInt(telegramId) } as any,
            data: { temp_photos: updatedPhotos as any } as any,
        });
    }

    async getUserRequests(telegramId: number, page: number = 1, limit: number = 5) {
        const user = await this.prisma.users.findUnique({
            where: { telegram_id: BigInt(telegramId) } as any,
        });

        if (!user) return { total: 0, requests: [], page: 1, totalPages: 0 };

        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            this.prisma.requests.findMany({
                where: {
                    user_id: user.id,
                    status: { in: ['PENDING', 'IN_PROGRESS', 'JEK_COMPLETED', 'JEK_REJECTED', 'COMPLETED'] as Status_Flow[] }
                },
                select: {
                    id: true,
                    request_number: true,
                    status: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.requests.count({
                where: {
                    user_id: user.id,
                    status: { in: ['PENDING', 'IN_PROGRESS', 'JEK_COMPLETED', 'JEK_REJECTED', 'COMPLETED'] as Status_Flow[] }
                },
            }),
        ]);

        return { total, requests, page, totalPages: Math.ceil(total / limit) };
    }

    async getRequestById(requestId: string) {
        return this.prisma.requests.findUnique({
            where: { id: requestId },
            include: {
                requestPhotos: true
            }
        });
    }

    async createRequestFromTemp(telegramId: number) {
        const user: any = await this.prisma.users.findUnique({
            where: { telegram_id: BigInt(telegramId) } as any,
        });

        if (!user || !user.temp_district || !user.temp_address || !user.temp_description) {
            throw new Error('Incomplete data for request');
        }

        const requestNumber = await this.generateRequestNumber();
        const botToken = this.configService.get<string>('BOT_TOKEN');

        const request = await this.prisma.requests.create({
            data: {
                request_number: requestNumber,
                user_id: user.id,
                district: user.temp_district,
                address: user.temp_address,
                description: user.temp_description,
                status: 'PENDING' as Status_Flow,
            } as any,
        });

        if (Array.isArray(user.temp_photos) && botToken) {
            const photosToCreate: any[] = [];
            for (const fileId of user.temp_photos) {
                try {
                    const localUrl = await this.mediaService.downloadFromTelegram(fileId, botToken);
                    photosToCreate.push({ file_url: localUrl, telegram_file_id: fileId });
                } catch (e) {
                    this.logger.error(`Error downloading photo ${fileId}:`, e);
                }
            }
            if (photosToCreate.length > 0) {
                await this.requestPhotosService.createMany(request.id, photosToCreate);
            }
        }

        await this.prisma.users.update({
            where: { telegram_id: BigInt(telegramId) } as any,
            data: {
                registration_step: 'COMPLETED',
                temp_district: null,
                temp_mahalla: null,
                temp_street: null,
                temp_house: null,
                temp_address: null,
                temp_description: null,
                temp_photos: null,
            } as any,
        });

        return request;
    }

    private async generateRequestNumber(): Promise<string> {
        const year = new Date().getFullYear();
        const count = await this.prisma.requests.count({
            where: { request_number: { startsWith: `JEK-${year}` } },
        });
        const sequence = String(count + 1).padStart(6, '0');
        return `JEK-${year}-${sequence}`;
    }
}
