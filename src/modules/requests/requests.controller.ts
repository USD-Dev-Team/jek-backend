import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    UseGuards,
    Req,
    Param,
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
    create(@Body() createRequestDto: CreateRequestDto) {
        return this.requestsService.create(createRequestDto);
    }

    @ApiOperation({
        summary: "O'z hududidagi pending arizalarni olish",
        description: "JEK xodimi o'ziga biriktirilgan hududdagi barcha yangi (PENDING) arizalarni ko'radi. Ruxsat: JEK.",
    })
    @ApiBearerAuth('token')
    @UseGuards(TokenGuard, RoleGuard)
    @Roles(jekRoles.JEK)
    @Get('pending')
    findPending(@Req() req: any) {
        return this.requestsService.findPendingByDistrict(req.user.address);
    }

    @ApiOperation({
        summary: "O'ziga biriktirilgan faol arizalarni olish",
        description: "JEK xodimi o'zi qabul qilgan (IN_PROGRESS) arizalarni ko'radi. Ruxsat: JEK.",
    })
    @ApiBearerAuth('token')
    @UseGuards(TokenGuard, RoleGuard)
    @Roles(jekRoles.JEK)
    @Get('my-active')
    findMyActive(@Req() req: any) {
        return this.requestsService.findMyActive(req.user.id);
    }

    @ApiOperation({
        summary: "Arizani o'ziga biriktirish",
        description: "Yangi arizani xodim o'ziga ishga biriktiradi (IN_PROGRESS). Ruxsat: JEK.",
    })
    @ApiBearerAuth('token')
    @UseGuards(TokenGuard, RoleGuard)
    @Roles(jekRoles.JEK)
    @Patch('assign/:id')
    assign(@Param('id') id: string, @Req() req: any) {
        return this.requestsService.assign(id, req.user.id);
    }

    @ApiOperation({
        summary: "Arizani yakunlash (Complete)",
        description: "Biriktirilgan arizani muvaffaqiyatli yakunlash. Izoh majburiy. Ruxsat: JEK.",
    })
    @ApiBearerAuth('token')
    @UseGuards(TokenGuard, RoleGuard)
    @Roles(jekRoles.JEK)
    @Patch('complete/:id')
    complete(
        @Param('id') id: string,
        @Req() req: any,
        @Body() body: CompleteRequestDto,
    ) {
        return this.requestsService.complete(id, req.user.id, body.note);
    }

    @ApiOperation({
        summary: "Arizani rad etish (Reject)",
        description: "Biriktirilgan arizani sabab ko'rsatgan holda rad etish. Sabab majburiy. Ruxsat: JEK.",
    })
    @ApiBearerAuth('token')
    @UseGuards(TokenGuard, RoleGuard)
    @Roles(jekRoles.JEK)
    @Patch('reject/:id')
    reject(
        @Param('id') id: string,
        @Req() req: any,
        @Body() body: RejectRequestDto,
    ) {
        return this.requestsService.reject(id, req.user.id, body.reason);
    }
}
