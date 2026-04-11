import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChangePasswordDto,
  UpdateAdminDto,
  updateStatusDto,
} from './dto/update-admin.dto';
import { PrismaService } from 'src/core/database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  //Admin profilini ko'rish
  async findSelf(id: string) {
    const existJek = await this.prisma.admins.findUnique({
      where: { id },
      select: {
        first_name: true,
        last_name: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        addresses: {
          select: {
            address: {
              select: { id: true, district: true, neighborhood: true },
            },
          },
        },
      },
    });
    if (!existJek) {
      throw new NotFoundException('Employee not found');
    }
    const {addresses,...payload}=existJek
    const cleanAdresses=existJek.addresses.map(el=>el.address)
    return {
      success: true,
      data: {...payload,addresses:[...cleanAdresses]},
    };
  }

  async updateProfile(id: string, updateAdminDto: UpdateAdminDto) {
    const existJek = await this.prisma.admins.findUnique({
      where: { id },
    });

    if (!existJek) {
      throw new NotFoundException('Employee not found');
    }
    return {
      success: true,
      message: 'Employee profile success updated',
      data: await this.prisma.admins.update({
        where: { id },
        data: updateAdminDto,
        select: {
          first_name: true,
          last_name: true,
          phoneNumber: true,
          role: true,
        } as any,
      }),
    };
  }

  async updateStatus(id: string, updateStatus: updateStatusDto) {
    const existJek = await this.prisma.admins.findUnique({ where: { id } });
    if (!existJek) {
      throw new NotFoundException('Employee not found');
    }

    await this.prisma.admins.update({
      where: { id },
      data: { isActive: updateStatus.isActive },
    });

    return {
      success: true,
      message: updateStatus.isActive
        ? 'Xodim faollashtirildi'
        : "Xodim nofaol holatga o'tkazildi",
    };
  }

  async changePassword(id: string, changePasswordDto: ChangePasswordDto) {
    if (changePasswordDto.password !== changePasswordDto.passwordConfirm) {
      throw new BadRequestException('Password error');
    }
    const hashPassword = await bcrypt.hash(changePasswordDto.password, 12);

    const existJek = await this.prisma.admins.findUnique({ where: { id } });
    if (!existJek) {
      throw new NotFoundException('Employee not found');
    }

    await this.prisma.admins.update({
      where: { id },
      data: { password: hashPassword },
    });
    return { success: true, message: 'Password changed successfully.' };
  }

  async findAll(isActive: boolean = true) {
    const admins = await this.prisma.admins.findMany({
      where: { isActive },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
      } as any,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: admins,
    };
  }

  async findOne(id: string) {
    const existJek = await this.prisma.admins.findUnique({
      where: { id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        addresses: {
          select: {
            address: true,
          },
        },
      } as any,
    });
    if (!existJek) {
      throw new NotFoundException('Employee not found');
    }
    return {
      success: true,
      data: existJek,
    };
  }
}
