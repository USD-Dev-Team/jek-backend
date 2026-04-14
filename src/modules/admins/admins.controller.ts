import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Req,
  ParseUUIDPipe,
  UseGuards,
  Post,
  Delete,
  InternalServerErrorException,
  HttpException,
  Query,
} from '@nestjs/common';
import { AdminsService } from './admins.service';
import {
  ChangePasswordDto,
  UniversalStaffSearch,
  UpdateAdminDto,
  updateStatusDto,
} from './dto/update-admin.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiParam, ApiTags } from '@nestjs/swagger';
import { TokenGuard } from 'src/common/guards/token.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/role';
import { jekRoles } from '@prisma/client';
import { AllowInactive } from 'src/common/decorators/allow-inactive';

@ApiTags('Admins')
@ApiBearerAuth('token')
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @ApiOperation({
    summary: "Xodimlar ro'yxatini olish",
    description:
      "Barcha faol yoki nofaol xodimlarni ko'rish. Ruxsat: INSPECTION, GEVERNMENT.",
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Default: true',
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.INSPECTION, jekRoles.GOVERNMENT)
  @Get('all-list')
  async findAll(@Query('isActive') isActiveQuery: string) {
    try {
      const isActive = isActiveQuery === 'false' ? false : true;
      return await this.adminsService.findAll(isActive);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }

  @ApiOperation({
    summary: "Xodimlar ro'yxatini filterlab olish",
    description:
      "Xodimlar ro'yxatini filterlab ko'rish. Ruxsat: INSPECTION, GEVERNMENT.",
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.INSPECTION, jekRoles.GOVERNMENT)
  @Get('filter-list')
  async universalStaffSearch(@Query() filterDto: UniversalStaffSearch) {
    try {
      return await this.adminsService.universalStaffSearch(filterDto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }

  @ApiOperation({
    summary: "O'z profil ma'lumotlarini olish",
    description:
      "Tizimga kirgan adminning barcha ma'lumotlarini qaytaradi. Ruxsat: JEK.",
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK, jekRoles.INSPECTION, jekRoles.GOVERNMENT)
  @AllowInactive()
  @Get('self/data')
  async findSelf(@Req() req: any) {
    try {
      return await this.adminsService.findSelf(req['user'].id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }
  
  @ApiOperation({
    summary: "Xodim holatini o'zgartirish (activ/inactiv)",
    description:
      "Xodimni tizimda faollashtirish yoki o'chirish. Ruxsat: INSPECTION.",
  })
  @ApiParam({
    name: 'id',
    description: 'Xodim ID (UUID)',
    required: true,
    type: String,
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.INSPECTION)
  @Patch('update/status/:id')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatus: updateStatusDto,
  ) {
    try {
      return await this.adminsService.updateStatus(id, updateStatus);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }

  @ApiOperation({
    summary: "Profil ma'lumotlarini yangilash",
    description:
      "Admin o'zining shaxsiy ma'lumotlarini o'zgartirishi. Ruxsat: JEK, INSPECTION, GOVERNMENT.",
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK, jekRoles.INSPECTION, jekRoles.GOVERNMENT)
  @Patch('update/profile')
  async updateProfile(@Req() req: any, @Body() updateAdminDto: UpdateAdminDto) {
    try {
      return await this.adminsService.updateProfile(
        req['user'].id,
        updateAdminDto,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }

  @ApiOperation({
    summary: "Parolni o'zgartirish",
    description:
      'Hodimning joriy parolini yangisiga almashtirish. Ruxsat: JEK, INSPECTION, GOVERNMENT.',
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK, jekRoles.INSPECTION, jekRoles.GOVERNMENT)
  @Patch('change/password')
  async changePassword(
    @Req() req: any,
    @Body() changePassword: ChangePasswordDto,
  ) {
    try {
      return await this.adminsService.changePassword(
        req['user'].id,
        changePassword,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }

  @ApiOperation({
    summary: "Xodim ma'lumotlarini olish",
    description: "Xodimning ma'lumotlarini olish. Ruxsat: INSPECTION.",
  })
  @ApiParam({
    name: 'id',
    description: 'Xodim ID (UUID)',
    required: true,
    type: String,
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.INSPECTION)
  @Get('find/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    try {
      return await this.adminsService.findOne(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }
}
