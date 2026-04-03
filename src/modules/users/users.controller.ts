import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Post, Body, } from '@nestjs/common';
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
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
