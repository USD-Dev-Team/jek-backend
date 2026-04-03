import { ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createUserDto: CreateUserDto) {
        const { telegram_id, phoneNumber, first_name, last_name } = createUserDto;

        // Telefon raqamini tozalash (agar kerak bo'lsa)
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const finalPhone = cleanPhone.length === 9 ? `998${cleanPhone}` : cleanPhone;

        // Mavjudligini tekshirish
        const existUser = await this.prisma.users.findUnique({
            where: { phoneNumber: finalPhone },
        });

        if (existUser) {
            throw new ConflictException('Foydalanuvchi allaqachon mavjud');
        }

        // Saqlash
        const newUser = await this.prisma.users.create({
            data: {
                telegram_id: BigInt(telegram_id),
                phoneNumber: finalPhone,
                first_name,
                last_name,
            },
        });

        return {
            success: true,
            message: "Foydalanuvchi muvaffaqiyatli ro'yxatdan o'tdi",
            data: {
                id: newUser.id,
                telegram_id: newUser.telegram_id.toString(),
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                phoneNumber: newUser.phoneNumber,
                role: newUser.role,
            },
        };
    }
}
