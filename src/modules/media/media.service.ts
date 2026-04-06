import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class MediaService {
    private readonly uploadPath = join(process.cwd(), 'uploads', 'requests');

    constructor() {
        this.ensureDirectoryExists();
    }

    private ensureDirectoryExists() {
        if (!existsSync(this.uploadPath)) {
            mkdirSync(this.uploadPath, { recursive: true });
        }
    }

    /**
     * Telegram file_id orqali rasmni yuklab oladi va lokal saqlaydi
     */
    async downloadFromTelegram(fileId: string, botToken: string): Promise<string> {
        try {
            const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
            const response = await fetch(getFileUrl);
            const data = await response.json();

            if (!data.ok) {
                throw new Error('Telegram getFile failed');
            }

            const telegramFilePath = data.result.file_path;
            const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${telegramFilePath}`;

            const fileResponse = await fetch(downloadUrl);
            const buffer = await fileResponse.arrayBuffer();

            const fileName = `${randomUUID()}_${Date.now()}.jpg`;
            const fullPath = join(this.uploadPath, fileName);

            writeFileSync(fullPath, Buffer.from(buffer));
            return `/uploads/requests/${fileName}`;
        } catch (error) {
            console.error('Error downloading from Telegram:', error);
            throw new InternalServerErrorException('Rasmni yuklab olishda xatolik');
        }
    }

    /**
     * Express'dan kelgan fileni lokal papkaga saqlaydi
     */
    async saveManual(file: Express.Multer.File): Promise<string> {
        try {
            const fileExt = file.originalname.split('.').pop() || 'jpg';
            const fileName = `${randomUUID()}_${Date.now()}.${fileExt}`;
            const fullPath = join(this.uploadPath, fileName);

            writeFileSync(fullPath, file.buffer);
            return `/uploads/requests/${fileName}`;
        } catch (error) {
            console.error('Error saving manual file:', error);
            throw new InternalServerErrorException('Faylni saqlashda xatolik');
        }
    }
}
