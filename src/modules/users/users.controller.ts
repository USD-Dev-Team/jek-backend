import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Post, Body, InternalServerErrorException, HttpException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @ApiOperation({
    summary: 'Foydalanuvchilarni ro\'yxatdan o\'tkazish',
    description:
      'Telegram bot orqali kelgan foydalanuvchi ma\'lumotlarini bazaga saqlash. Ruxsat: Hamma.',
  })
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    try {
      return await this.usersService.create(createUserDto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Serverda xatolik yuz berdi');
    }
  }
}
