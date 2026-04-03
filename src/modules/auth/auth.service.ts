import {
    BadRequestException,
    ConflictException,
    Injectable,
} from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { PrismaService } from 'src/core/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async register(registerDto: RegisterDto) {
        const cleanPhone = registerDto.phoneNumber.replace(/\D/g, '');

        const finalPhone =
            cleanPhone.length === 9 ? `998${cleanPhone}` : cleanPhone;

        const existJek = await this.prisma.admins.findUnique({
            where: { phoneNumber: finalPhone },
        });

        if (existJek) {
            throw new ConflictException('Phone number already added');
        }

        const { password, passwordConfirm, phoneNumber, ...data } = registerDto;

        if (password !== passwordConfirm) {
            throw new BadRequestException('Password error');
        }
        const hashPassword = await bcrypt.hash(password, 12);
        const jti = crypto.randomUUID();

        const newJek = await this.prisma.admins.create({
            data: {
                ...data,
                password: hashPassword,
                phoneNumber: finalPhone,
                jti,
            },
            select: { phoneNumber: true, id: true, role: true, jti: true },
        });

        const payload = {
            id: newJek.id,
            role: newJek.role,
            phoneNumber: newJek.phoneNumber,
            jti: newJek.jti,
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
            where: { id: newJek.id },
            data: { refreshToken: hashedRefreshToken },
        });

        return {
            message: "Muvaffaqiyatli ro'yxatdan o'tdingiz",
            refreshToken,
            accessToken,
        };
    }

    async login(loginDto: LoginDto) {
        const cleanPhone = loginDto.phoneNumber.replace(/\D/g, '');

        const finalPhone =
            cleanPhone.length === 9 ? `998${cleanPhone}` : cleanPhone;

        const existJek = await this.prisma.admins.findUnique({
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
            jti,
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
            data: { refreshToken: hashedRefreshToken, jti },
        });

        return {
            message: 'Login muvofaqiyatli amalga oshdi',
            refreshToken,
            accessToken,
        };
    }
}
