import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Query } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { TokenGuard } from '../../common/guards/token.guard';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/role';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

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
    @Get('pending')
    @ApiOperation({ summary: 'O\'z hududidagi kutilayotgan arizalarni ko\'rish' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    getPendingForJek(
        @Request() req,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10'
    ) {
        return this.requestsService.findPendingForJek(
            req.user.id,
            parseInt(page),
            parseInt(limit)
        );
    }

    @UseGuards(TokenGuard, RoleGuard)
    @Roles('JEK')
    @ApiBearerAuth()
    @Get('my-active')
    @ApiOperation({ summary: 'O\'ziga biriktirilgan faol arizalarni ko\'rish' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    getMyActive(
        @Request() req,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10'
    ) {
        return this.requestsService.findMyActive(
            req.user.id,
            parseInt(page),
            parseInt(limit)
        );
    }

    @UseGuards(TokenGuard, RoleGuard)
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
