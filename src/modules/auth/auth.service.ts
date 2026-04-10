import {
    BadRequestException,
    ConflictException,
    Injectable,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AddressesService } from '../addresses/addresses.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly configService: ConfigService,
        private readonly addressesService: AddressesService,
    ) { }

    async registerJek(registerDto: RegisterDto) {
        const cleanPhone = registerDto.phoneNumber.replace(/\D/g, '');
        const finalPhone = cleanPhone.length === 9 ? `998${cleanPhone}` : cleanPhone;

        const existJek = await this.prisma.admins.findUnique({
            where: { phoneNumber: finalPhone },
            select: { id: true } as any
        });

        if (existJek) {
            throw new ConflictException('Phone number already added');
        }

        if (registerDto.password !== registerDto.passwordConfirm) {
            throw new BadRequestException('Password error');
        }

        const hashPassword = await bcrypt.hash(registerDto.password, 12);
        const jti = crypto.randomUUID();

        // Tranzaksiya boshlanishi
        return await this.prisma.$transaction(async (tx) => {
            const newJek: any = await tx.admins.create({
                data: {
                    first_name: registerDto.first_name,
                    last_name: registerDto.last_name,
                    password: hashPassword,
                    phoneNumber: finalPhone,
                    jti,
                    isActive: true,
                } as any,
                select: { phoneNumber: true, id: true, role: true, jti: true } as any,
            });

            // Ro'yxatdan o'tayotganda yuborilgan manzillarni biriktirish
            if (registerDto.addresses && registerDto.addresses.length > 0) {
                for (const addr of registerDto.addresses) {
                    // Agar bitta addr xato bo'lsa, xato otiladi va tranzaksiya rollback bo'ladi
                    await this.addressesService.assignToAdmin(newJek.id, addr, tx);
                }
            }

            const payload = {
                id: newJek.id,
                role: newJek.role,
                phoneNumber: newJek.phoneNumber,
            };

            const accessToken = await this.jwt.signAsync(payload, {
                secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
                expiresIn: '1h',
            });

            const refreshToken = await this.jwt.signAsync(payload, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                expiresIn: '7d',
            });

            return {
                message: 'Muvofaqiyatli ro\'yxatdan o\'tdingiz',
                userId: newJek.id,
                role: newJek.role,
                refreshToken,
                accessToken,
            };
        });
    }

    async login(loginDto: LoginDto) {
        const cleanPhone = loginDto.phoneNumber.replace(/\D/g, '');

        const finalPhone =
            cleanPhone.length === 9 ? `998${cleanPhone}` : cleanPhone;

        const existJek: any = await this.prisma.admins.findUnique({
            where: { phoneNumber: finalPhone },
        });

        if (!existJek) {
            throw new BadRequestException('Phone number or password error');
        }

        const existPassword = await bcrypt.compare(
            loginDto.password,
            existJek.password,
        );

        if (!existPassword) {
            throw new BadRequestException('Phone number or password error');
        }

        const jti = crypto.randomUUID();
        const payload = {
            id: existJek.id,
            role: existJek.role,
            phoneNumber: existJek.phoneNumber,
        };

        const accessToken = await this.jwt.signAsync(payload, {
            secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
            expiresIn: '1h',
        });

        const refreshToken = await this.jwt.signAsync(payload, {
            secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
        });

        const hashedRefreshToken = await bcrypt.hash(refreshToken, 12);

        await this.prisma.admins.update({
            where: { id: existJek.id },
            data: { refreshToken: hashedRefreshToken, jti } as any,
        });

        return {
            message: 'Login muvaffaqiyatli amalga oshdi',
            userId: existJek.id,
            role: existJek.role,
            refreshToken,
            accessToken,
        };
    }
}
