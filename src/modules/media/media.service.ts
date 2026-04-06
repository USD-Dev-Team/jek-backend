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
            // 1. Get file path from Telegram
            const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
            const response = await fetch(getFileUrl);
            const data = await response.json();

            if (!data.ok) {
                throw new Error('Telegram getFile failed');
            }

            const telegramFilePath = data.result.file_path;
            const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${telegramFilePath}`;

            // 2. Download actual file
            const fileResponse = await fetch(downloadUrl);
            const buffer = await fileResponse.arrayBuffer();

            // 3. Save locally
            const fileName = `${randomUUID()}_${Date.now()}.jpg`;
            const fullPath = join(this.uploadPath, fileName);

            writeFileSync(fullPath, Buffer.from(buffer));

            // Public URL qaytaramiz (hozircha shunchaki fayl nomi, keyinroq to'liq URL qilinadi)
            return `/uploads/requests/${fileName}`;
        } catch (error) {
            console.error('Error downloading from Telegram:', error);
            throw new InternalServerErrorException('Rasmni yuklab olishda xatolik');
        }
    }
}
