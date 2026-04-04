import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Req,
  ParseUUIDPipe,
  UseGuards,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { AdminsService } from './admins.service';
import {
  ChangePasswordDto,
  UpdateAdminDto,
  updateStatusDto,
} from './dto/update-admin.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TokenGuard } from 'src/common/guards/token.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/role';
import { jekRoles } from '@prisma/client';
import { AllowInactive } from 'src/common/decorators/allow-inactive';

@ApiTags('Admins')
@ApiBearerAuth('token')
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) { }

  @ApiOperation({
    summary: "O'z profil ma'lumotlarini olish",
    description: "Tizimga kirgan adminning barcha ma'lumotlarini qaytaradi. Ruxsat: JEK.",
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK)
  @AllowInactive()
  @Get('self/data')
  async findSelf(@Req() req: Request) {
    try {
      return await this.adminsService.findSelf(req['user'].id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }

  @ApiOperation({
    summary: "Xodim holatini o'zgartirish (activ/inactiv)",
    description: "Xodimni tizimda faollashtirish yoki o'chirish. Ruxsat: JEK.",
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK)
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
    description: "Adminning shaxsiy ma'lumotlarini o'zgartirish. Ruxsat: JEK.",
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK)
  @Patch('update/profile')
  async updateProfile(@Req() req: Request, @Body() updateAdminDto: UpdateAdminDto) {
    try {
      return await this.adminsService.updateProfile(req['user'].id, updateAdminDto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }

  @ApiOperation({
    summary: "Parolni o'zgartirish",
    description: "Adminning joriy parolini yangisiga almashtirish. Ruxsat: JEK.",
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK)
  @Patch('change/password')
  async changePassword(
    @Req() req: Request,
    @Body() changePassword: ChangePasswordDto,
  ) {
    try {
      return await this.adminsService.changePassword(req['user'].id, changePassword);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }
}
