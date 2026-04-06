import { Controller, Get, Post, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { RequestPhotosService } from './request-photos.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { TokenGuard } from 'src/common/guards/token.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/role';
import { jekRoles } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from '../media/media.service';

@ApiTags('Request Photos')
@ApiBearerAuth('token')
@UseGuards(TokenGuard, RoleGuard)
@Controller('request-photos')
export class RequestPhotosController {
    constructor(
        private readonly requestPhotosService: RequestPhotosService,
        private readonly mediaService: MediaService
    ) { }

    @Get(':requestId')
    @Roles(jekRoles.JEK, jekRoles.INSPECTION)
    @ApiOperation({ summary: 'Arizaga tegishli barcha rasmlarni olish (Xodimlar uchun)' })
    async getPhotosByRequestId(@Param('requestId') requestId: string) {
        return this.requestPhotosService.findByRequestId(requestId);
    }

    @Post('upload/:requestId')
    @Roles(jekRoles.JEK, jekRoles.INSPECTION)
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' }
            }
        }
    })
    @ApiOperation({ summary: 'Arizaga rasm qo\'shish (Manual upload)' })
    async uploadPhoto(
        @Param('requestId') requestId: string,
        @UploadedFile() file: Express.Multer.File
    ) {
        if (!file) throw new BadRequestException('Fayl topilmadi');

        const fileUrl = await this.mediaService.saveManual(file);

        // Bazaga bitta massiv ko'rinishida jo'natamiz
        return this.requestPhotosService.createMany(requestId, [{
            file_url: fileUrl,
            telegram_file_id: null
        }]);
    }
}
