import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Request,
  Query,
  Req,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto, UniversalFilterDto } from './dto/create-request.dto';
import { TokenGuard } from '../../common/guards/token.guard';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/role';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';

import { jekRoles, Status_Flow } from '@prisma/client';
import { RejectRequestDto } from './dto/update-request-status.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MediaService } from '../media/media.service';

@ApiTags('Requests (Arizalar)')
@ApiBearerAuth('token')
@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly mediaService: MediaService,
  ) {}
  @Post()
  @ApiOperation({ summary: 'Yangi ariza yaratish (Bot orqali)' })
  create(@Body() createRequestDto: CreateRequestDto) {
    return this.requestsService.create(createRequestDto);
  }

  @UseGuards(TokenGuard, RoleGuard)
  @Roles('JEK')
  @Get('jek/list')
  @ApiOperation({
    summary: "Xodim uchun arizalar ro'yxati (Barcha statuslar bo'yicha )",
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'],
    description: 'Kelmasa har ikkala statusdagilar chiqadi',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getJekRequests(
    @Request() req,
    @Query('status') status?: Status_Flow,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.requestsService.findJekRequests(
      req.user.id,
      status,
      parseInt(page),
      parseInt(limit),
    );
  }

  @UseGuards(TokenGuard, RoleGuard)
  @Roles('JEK', jekRoles.INSPECTION)
  @ApiOperation({
    summary: "Xodim uchun arizalar ro'yxatini filterli get qilish",
  })
  @Get('universal-search')
  @ApiOperation({ summary: "Barcha filtrlar bo'yicha arizalarni qidirish" })
  async searchRequests(@Query() filterDto: UniversalFilterDto) {
    return await this.requestsService.getUniversalRequests(filterDto);
  }

  @UseGuards(TokenGuard, RoleGuard)
  @ApiParam({ name: 'id', description: 'Ariza ID (UUID)' })
  @Roles('JEK')
  @Patch('assign/:id')
  @ApiOperation({ summary: "Arizani o'ziga biriktirish (IN_PROGRESS)" })
  assign(@Param('id') id: string, @Request() req) {
    return this.requestsService.assign(id, req.user.id);
  }

  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK)
  @Patch('complete/:id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        note: { type: 'string', description: 'Bajarilgan ish haqida izox' },
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Ish jarayonidan suratlar(max 10 ta)',
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('photos', 10))
  async completeRequest(
    @Param('id') requestId: string,
    @Body('note') note: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    const jekId = req.user.id;
    const filePaths: string[] = [];

    if (files?.length) {
      for (const file of files) {
        const path = await this.mediaService.saveManual(file);
        filePaths.push(path);
      }
    }

    return this.requestsService.complete(requestId, jekId, note, filePaths);
  }

  @UseGuards(TokenGuard, RoleGuard)
  @Roles('JEK')
  @Patch('reject/:id')
  @ApiOperation({ summary: 'Arizani rad etish (JEK_REJECTED)' })
  reject(
    @Param('id') id: string,
    @Body() reason: RejectRequestDto,
    @Request() req,
  ) {
    return this.requestsService.reject(id, req.user.id, reason.reason);
  }

  @UseGuards(TokenGuard)
  @Get('request/:id')
  @ApiOperation({ summary: "Arizani Id si bo'yicha get qilish" })
  async getById(@Param('id') id: string) {
    return this.requestsService.getRequestDetailsWithLogs(id);
  }

}
