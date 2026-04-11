import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Post, Body, InternalServerErrorException, HttpException } from '@nestjs/common';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: "Adminlarni ro'yxatdan o'tkazish",
    description: "Yangi JEK adminini tizimga qo'shish. Ruxsat: Hamma.",
  })
  @Post('jek/register')
  async registerJek(@Body() createAuthDto: RegisterDto) {
    try {
      const result = await this.authService.registerJek(createAuthDto);

      return {
        message: result.message,
        userId: result.userId,
        role: result.role,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }

  @ApiOperation({
    summary: 'Adminlarni tizimga kirishi',
    description:
      'Telefon raqami va parol orqali tizimga kirish va JWT token olish. Ruxsat: Hamma.',
  })
  @Post('jek/login')
  async login(@Body() loginDto: LoginDto) {
    try {
      const result = await this.authService.login(loginDto);

      return {
        message: result.message,
        userId: result.userId,
        role: result.role,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }

  @ApiOperation({
    summary: 'Refresh token orqali tokenni yangilash',
    description:
      'Refresh token yuboriladi va yangi access hamda refresh token olinadi.',
  })
  @Post('jek/refresh')
  async refresh(@Body() payload: RefreshTokenDto) {
    try {
      return await this.authService.refreshTokens(payload.refreshToken);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }
}
