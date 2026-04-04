import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class BotService {
    private readonly logger = new Logger(BotService.name);
    constructor(private readonly prisma: PrismaService) { }

    async findOrCreateUser(telegramId: number) {
        const user = await this.prisma.users.findUnique({
            where: { telegram_id: BigInt(telegramId) },
        });

        if (!user) {
            return this.prisma.users.create({
                data: {
                    telegram_id: BigInt(telegramId),
                    registration_step: 'FIRST_NAME',
                },
            });
        }

        return user;
    }

    async setStep(telegramId: number, step: string) {
        return this.prisma.users.update({
            where: { telegram_id: BigInt(telegramId) },
            data: { registration_step: step },
        });
    }

    async updateUserData(telegramId: number, data: any) {
        if (data.phoneNumber) {
            // Tozalash
            data.phoneNumber = data.phoneNumber.replace(/\D/g, '');
            if (data.phoneNumber.length === 9) data.phoneNumber = `998${data.phoneNumber}`;
        }
        return this.prisma.users.update({
            where: { telegram_id: BigInt(telegramId) },
            data,
        });
    }
}
