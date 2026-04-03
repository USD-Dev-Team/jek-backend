import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class BotService {
    private readonly logger = new Logger(BotService.name);
    constructor(private readonly prisma: PrismaService) { }

    async findOrCreateUser(telegramId: number) {
        const user: any = await this.prisma.users.findUnique({
            where: { telegram_id: BigInt(telegramId) } as any,
        });

        if (!user) {
            return this.prisma.users.create({
                data: {
                    telegram_id: BigInt(telegramId),
                    registration_step: 'FIRST_NAME',
                } as any,
            });
        }

        return user;
    }

    async setStep(telegramId: number, step: string) {
        return this.prisma.users.update({
            where: { telegram_id: BigInt(telegramId) } as any,
            data: { registration_step: step } as any,
        });
    }

    async updateUserData(telegramId: number, data: any) {
        if (data.phoneNumber) {
            // Tozalash
            data.phoneNumber = data.phoneNumber.replace(/\D/g, '');
            if (data.phoneNumber.length === 9) data.phoneNumber = `998${data.phoneNumber}`;
        }
        return this.prisma.users.update({
            where: { telegram_id: BigInt(telegramId) } as any,
            data: data as any,
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
                    status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.requests.count({
                where: {
                    user_id: user.id,
                    status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] }
                },
            }),
        ]);

        return { total, requests, page, totalPages: Math.ceil(total / limit) };
    }

    async getRequestById(requestId: string) {
        return this.prisma.requests.findUnique({
            where: { id: requestId },
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

        // Ariza yaratish
        const request = await this.prisma.requests.create({
            data: {
                request_number: requestNumber,
                user_id: user.id,
                district: user.temp_district,
                address: user.temp_address,
                description: user.temp_description,
                photo_url: user.temp_photo,
                status: 'PENDING',
            } as any,
        });

        // Vaqtinchalik maydonlarni tozalash va stepni COMPLETED ga qaytarish
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
                temp_photo: null,
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
