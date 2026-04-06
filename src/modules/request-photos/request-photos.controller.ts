import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RequestPhotosService } from './request-photos.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TokenGuard } from 'src/common/guards/token.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/role';
import { jekRoles } from '@prisma/client';

@ApiTags('Request Photos')
@ApiBearerAuth('token')
@UseGuards(TokenGuard, RoleGuard)
@Controller('request-photos')
export class RequestPhotosController {
    constructor(private readonly requestPhotosService: RequestPhotosService) { }

    @Get(':requestId')
    @Roles(jekRoles.JEK, jekRoles.INSPECTION)
    @ApiOperation({ summary: 'Arizaga tegishli barcha rasmlarni olish (Xodimlar uchun)' })
    async getPhotosByRequestId(@Param('requestId') requestId: string) {
        return this.requestPhotosService.findByRequestId(requestId);
    }
}
