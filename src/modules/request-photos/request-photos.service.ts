import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class RequestPhotosService {
    constructor(private readonly prisma: PrismaService) { }

    async createMany(requestId: string, photos: { file_url: string; telegram_file_id: string }[]) {
        return this.prisma.requestPhoto.createMany({
            data: photos.map(p => ({
                request_id: requestId,
                file_url: p.file_url,
                telegram_file_id: p.telegram_file_id,
            })) as any,
        });
    }

    async findByRequestId(requestId: string) {
        return this.prisma.requestPhoto.findMany({
            where: { request_id: requestId },
        });
    }
}
