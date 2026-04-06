import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { District } from '@prisma/client';

@Injectable()
export class RequestsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createRequestDto: CreateRequestDto) {
        const { telegram_id, address, latitude, longitude, description, district } = createRequestDto;

        const user = await this.prisma.users.findFirst({
            where: { telegram_id: BigInt(telegram_id) },
        });

        if (!user) {
            throw new ConflictException('Foydalanuvchi topilmadi. Avval ro\'yxatdan o\'ting.');
        }

        const requestNumber = await this.generateRequestNumber();

        const request = await this.prisma.requests.create({
            data: {
                request_number: requestNumber,
                user_id: user.id,
                address,
                district,
                latitude,
                longitude,
                description,
                status: 'PENDING',
            } as any,
        });

        return {
            success: true,
            message: "Ariza muvaffaqiyatli qabul qilindi",
            data: request,
        };
    }

    async findPendingByDistrict(district: District) {
        return this.prisma.requests.findMany({
            where: {
                district,
                status: 'PENDING',
            },
            select: {
                id: true,
                createdAt: true,
                address: true,
                requestPhotos: true,
                description: true,
                status: true,
                request_number: true
            },
        });
    }

    async findMyActive(jekId: string) {
        return this.prisma.requests.findMany({
            where: {
                assigned_jek_id: jekId,
                status: 'IN_PROGRESS',
            },
            select: {
                id: true,
                createdAt: true,
                address: true,
                requestPhotos: true,
                description: true,
                status: true,
                request_number: true
            },
        });
    }

    async assign(requestId: string, jekId: string) {
        const request = await this.prisma.requests.findUnique({ where: { id: requestId } });
        if (!request) throw new ConflictException('Ariza topilmadi');
        if (request.status !== 'PENDING') throw new ConflictException('Ushbu ariza allaqachon biriktirilgan yoki yopilgan');

        const updated = await this.prisma.requests.update({
            where: { id: requestId },
            data: {
                assigned_jek_id: jekId,
                status: 'IN_PROGRESS',
            },
        });

        // Log yaratish
        await this.prisma.requestStatusLog.create({
            data: {
                request_id: requestId,
                old_status: 'PENDING',
                new_status: 'IN_PROGRESS',
                changed_by_role: 'JEK',
                changed_by_id: jekId,
                note: 'Ariza xodim tomonidan qabul qilindi',
            },
        });

        return updated;
    }

    async complete(requestId: string, jekId: string, note: string) {
        const request = await this.prisma.requests.findUnique({ where: { id: requestId } });
        if (!request) throw new ConflictException('Ariza topilmadi');
        if (request.assigned_jek_id !== jekId) throw new ConflictException('Sizga biriktirilmagan arizani yopolmaysiz');

        const updated = await this.prisma.requests.update({
            where: { id: requestId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
            },
        });

        await this.prisma.requestStatusLog.create({
            data: {
                request_id: requestId,
                old_status: 'IN_PROGRESS',
                new_status: 'COMPLETED',
                changed_by_role: 'JEK',
                changed_by_id: jekId,
                note,
            },
        });

        return updated;
    }

    async reject(requestId: string, jekId: string, reason: string) {
        const request = await this.prisma.requests.findUnique({ where: { id: requestId } });
        if (!request) throw new ConflictException('Ariza topilmadi');
        if (request.assigned_jek_id !== jekId) throw new ConflictException('Sizga biriktirilmagan arizani rad etolmaysiz');

        const updated = await this.prisma.requests.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                rejection_reason: reason,
            },
        });

        await this.prisma.requestStatusLog.create({
            data: {
                request_id: requestId,
                old_status: 'IN_PROGRESS',
                new_status: 'REJECTED',
                changed_by_role: 'JEK',
                changed_by_id: jekId,
                note: reason,
            },
        });

        return updated;
    }

    private async generateRequestNumber(): Promise<string> {
        const date = new Date();
        const year = date.getFullYear();

        const count = await this.prisma.requests.count({
            where: {
                request_number: {
                    startsWith: `REQ-${year}`,
                },
            },
        });

        const sequence = String(count + 1).padStart(4, '0');
        return `REQ-${year}-${sequence}`;
    }
}
