import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChangePasswordDto,
  UniversalStaffSearch,
  UpdateAdminDto,
  updateStatusDto,
} from './dto/update-admin.dto';
import { PrismaService } from 'src/core/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { jekRoles } from '@prisma/client';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedAdmins();
  }

  private async seedAdmins() {
    const password = 'Admin123!';
    const hashedPassword = await bcrypt.hash(password, 12);

    const governmentUsers = [
      { first_name: 'Gov', last_name: 'User 1', phoneNumber: '998901000001' },
      { first_name: 'Gov', last_name: 'User 2', phoneNumber: '998901000002' },
      { first_name: 'Gov', last_name: 'User 3', phoneNumber: '998901000003' },
      { first_name: 'Gov', last_name: 'User 4', phoneNumber: '998901000004' },
    ];

    for (const user of governmentUsers) {
      await this.prisma.admins.upsert({
        where: { phoneNumber: user.phoneNumber },
        update: {},
        create: {
          ...user,
          password: hashedPassword,
          role: jekRoles.GOVERNMENT,
          isActive: true,
        },
      });
    }

    const inspectionUsers = [
      { first_name: 'Insp', last_name: 'User 1', phoneNumber: '998902000001' },
      { first_name: 'Insp', last_name: 'User 2', phoneNumber: '998902000002' },
      { first_name: 'Insp', last_name: 'User 3', phoneNumber: '998902000003' },
      { first_name: 'Insp', last_name: 'User 4', phoneNumber: '998902000004' },
    ];

    for (const user of inspectionUsers) {
      await this.prisma.admins.upsert({
        where: { phoneNumber: user.phoneNumber },
        update: {},
        create: {
          ...user,
          password: hashedPassword,
          role: jekRoles.INSPECTION,
          isActive: true,
        },
      });
    }

    console.log('✅ Seed completed');
  }

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
    const { addresses, ...payload } = existJek;
    const cleanAdresses = existJek.addresses.map((el) => el.address);
    return {
      success: true,
      data: { ...payload, addresses: [...cleanAdresses] },
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

  async universalStaffSearch(dto: UniversalStaffSearch) {
    const {search, district, neighborhood, isActive, role, page = 1, limit = 10} = dto;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search.replace(/\D/g, '') } }
      ];
    }

    if (role) {
      where.role = role; 
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (district || neighborhood) {
      where.addresses = {
        some: {
          address: {
            ...(district && {
              district: { contains: district, mode: 'insensitive' },
            }),
            ...(neighborhood && {
              neighborhood: { contains: neighborhood, mode: 'insensitive' },
            }),
          },
        },
      };
    }

    const [staff, total] = await Promise.all([
      this.prisma.admins.findMany({
        where,
        include: {
          addresses: {
            include: { address: true },
          },
        },
        orderBy: { first_name: 'asc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.admins.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    return {
      success: true,
      data: staff,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      },
    };
  }
}
