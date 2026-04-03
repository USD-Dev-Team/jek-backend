import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Post, Body } from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @ApiOperation({
    summary: "Adminlarni ro'yxatdan o'tkazish",
    description: "Yangi JEK adminini tizimga qo'shish. Ruxsat: Hamma.",
  })
  @Post('jek/register')
  async register(@Body() createAuthDto: RegisterDto) {
    const result = await this.authService.register(createAuthDto);

    return {
      message: result.message,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @ApiOperation({
    summary: 'Adminlarni tizimga kirishi',
    description:
      'Telefon raqami va parol orqali tizimga kirish va JWT token olish. Ruxsat: Hamma.',
  })
  @Post('jek/login')
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);

    return {
      message: result.message,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }
}
