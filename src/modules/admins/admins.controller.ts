import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Req,
  ParseUUIDPipe,
  UseGuards,
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
  findSelf(@Req() req: Request) {
    return this.adminsService.findSelf(req['user'].id);
  }

  @ApiOperation({
    summary: "Xodim holatini o'zgartirish (activ/inactiv)",
    description: "Xodimni tizimda faollashtirish yoki o'chirish. Ruxsat: JEK.",
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK)
  @Patch('update/status/:id')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatus: updateStatusDto,
  ) {
    return this.adminsService.updateStatus(id, updateStatus);
  }

  @ApiOperation({
    summary: "Profil ma'lumotlarini yangilash",
    description: "Adminning shaxsiy ma'lumotlarini o'zgartirish. Ruxsat: JEK.",
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK)
  @Patch('update/profile')
  updateProfile(@Req() req: Request, @Body() updateAdminDto: UpdateAdminDto) {
    return this.adminsService.updateProfile(req['user'].id, updateAdminDto);
  }

  @ApiOperation({
    summary: "Parolni o'zgartirish",
    description: "Adminning joriy parolini yangisiga almashtirish. Ruxsat: JEK.",
  })
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK)
  @Patch('change/password')
  changePassword(
    @Req() req: Request,
    @Body() changePassword: ChangePasswordDto,
  ) {
    return this.adminsService.changePassword(req['user'].id, changePassword);
  }
}
