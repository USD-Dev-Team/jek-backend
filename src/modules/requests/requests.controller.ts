import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    UseGuards,
    Req,
    Param,
    InternalServerErrorException,
    HttpException,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { CompleteRequestDto, RejectRequestDto } from './dto/update-request-status.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TokenGuard } from 'src/common/guards/token.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/role';
import { jekRoles } from '@prisma/client';

@ApiTags('Requests')
@Controller('requests')
export class RequestsController {
    constructor(private readonly requestsService: RequestsService) { }

    @ApiOperation({
        summary: 'Yangi ariza yaratish (Telegram orqali)',
        description: 'Bot tomonidan yuborilgan foydalanuvchi arizasini saqlash. Ruxsat: Hamma (Hozircha).',
    })
    @Post()
    async create(@Body() createRequestDto: CreateRequestDto) {
        try {
            return await this.requestsService.create(createRequestDto);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new InternalServerErrorException('Serverda xatolik yuz berdi');
        }
    }

    @ApiOperation({
        summary: "O'z hududidagi pending arizalarni olish",
        description: "JEK xodimi o'ziga biriktirilgan hududdagi barcha yangi (PENDING) arizalarni ko'radi. Ruxsat: JEK.",
    })
    @ApiBearerAuth('token')
    @UseGuards(TokenGuard, RoleGuard)
    @Roles(jekRoles.JEK)
    @Get('pending')
    async findPending(@Req() req: any) {
        try {
            return await this.requestsService.findPendingByDistrict(req.user.address);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new InternalServerErrorException('Serverda xatolik yuz berdi');
        }
    }

    @ApiOperation({
        summary: "O'ziga biriktirilgan faol arizalarni olish",
        description: "JEK xodimi o'zi qabul qilgan (IN_PROGRESS) arizalarni ko'radi. Ruxsat: JEK.",
    })
    @ApiBearerAuth('token')
    @UseGuards(TokenGuard, RoleGuard)
    @Roles(jekRoles.JEK)
    @Get('my-active')
    async findMyActive(@Req() req: any) {
        try {
            return await this.requestsService.findMyActive(req.user.id);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new InternalServerErrorException('Serverda xatolik yuz berdi');
        }
    }

    @ApiOperation({
        summary: "Arizani o'ziga biriktirish",
        description: "Yangi arizani xodim o'ziga ishga biriktiradi (IN_PROGRESS). Ruxsat: JEK.",
    })
    @ApiBearerAuth('token')
    @UseGuards(TokenGuard, RoleGuard)
    @Roles(jekRoles.JEK)
    @Patch('assign/:id')
    async assign(@Param('id') id: string, @Req() req: any) {
        try {
            return await this.requestsService.assign(id, req.user.id);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new InternalServerErrorException('Serverda xatolik yuz berdi');
        }
    }

    @ApiOperation({
        summary: "Arizani yakunlash (Complete)",
        description: "Biriktirilgan arizani muvaffaqiyatli yakunlash. Izoh majburiy. Ruxsat: JEK.",
    })
    @ApiBearerAuth('token')
    @UseGuards(TokenGuard, RoleGuard)
    @Roles(jekRoles.JEK)
    @Patch('complete/:id')
    async complete(
        @Param('id') id: string,
        @Req() req: any,
        @Body() body: CompleteRequestDto,
    ) {
        try {
            return await this.requestsService.complete(id, req.user.id, body.note);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new InternalServerErrorException('Serverda xatolik yuz berdi');
        }
    }

    @ApiOperation({
        summary: "Arizani rad etish (Reject)",
        description: "Biriktirilgan arizani sabab ko'rsatgan holda rad etish. Sabab majburiy. Ruxsat: JEK.",
    })
    @ApiBearerAuth('token')
    @UseGuards(TokenGuard, RoleGuard)
    @Roles(jekRoles.JEK)
    @Patch('reject/:id')
    async reject(
        @Param('id') id: string,
        @Req() req: any,
        @Body() body: RejectRequestDto,
    ) {
        try {
            return await this.requestsService.reject(id, req.user.id, body.reason);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new InternalServerErrorException('Serverda xatolik yuz berdi');
        }
    }
}
