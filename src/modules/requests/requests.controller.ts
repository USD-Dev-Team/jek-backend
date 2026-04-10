import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Query } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { TokenGuard } from '../../common/guards/token.guard';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/role';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';

import { Status_Flow } from '@prisma/client';

@ApiTags('Requests (Arizalar)')
@ApiBearerAuth('token')
@Controller('requests')
export class RequestsController {
    constructor(private readonly requestsService: RequestsService) { }

    @Post()
    @ApiOperation({ summary: 'Yangi ariza yaratish (Bot orqali)' })
    create(@Body() createRequestDto: CreateRequestDto) {
        return this.requestsService.create(createRequestDto);
    }

    @UseGuards(TokenGuard, RoleGuard)
    @Roles('JEK')
    @ApiBearerAuth()
    @Get('jek/list')
    @ApiOperation({ summary: 'Xodim uchun arizalar ro\'yxati (Pending va Progress)' })
    @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'IN_PROGRESS'], description: 'Kelmasa har ikkala statusdagilar chiqadi' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    getJekRequests(
        @Request() req,
        @Query('status') status?: Status_Flow,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10'
    ) {
        return this.requestsService.findJekRequests(
            req.user.id,
            status,
            parseInt(page),
            parseInt(limit)
        );
    }

    @UseGuards(TokenGuard, RoleGuard)
    @ApiParam({ name: 'id', description: 'Ariza ID (UUID)' })
    @Roles('JEK')
    @ApiBearerAuth()
    @Patch('assign/:id')
    @ApiOperation({ summary: 'Arizani o\'ziga biriktirish (IN_PROGRESS)' })
    assign(@Param('id') id: string, @Request() req) {
        return this.requestsService.assign(id, req.user.id);
    }

    @UseGuards(TokenGuard, RoleGuard)
    @Roles('JEK')
    @ApiBearerAuth()
    @Patch('complete/:id')
    @ApiOperation({ summary: 'Arizani bajarilgan deb belgilash (JEK_COMPLETED)' })
    complete(@Param('id') id: string, @Body('note') note: string, @Request() req) {
        return this.requestsService.complete(id, req.user.id, note);
    }

    @UseGuards(TokenGuard, RoleGuard)
    @Roles('JEK')
    @ApiBearerAuth()
    @Patch('reject/:id')
    @ApiOperation({ summary: 'Arizani rad etish (JEK_REJECTED)' })
    reject(@Param('id') id: string, @Body('reason') reason: string, @Request() req) {
        return this.requestsService.reject(id, req.user.id, reason);
    }
}
