import {
  IsNotEmpty,
  IsString,
  IsPhoneNumber,
  IsNumberString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: '123456789',
    description: 'Telegram ID',
  })
  @IsNotEmpty({ message: 'Telegram ID kiritilishi shart' })
  @IsNumberString(
    {},
    { message: "Telegram ID faqat raqamlardan iborat bo'lishi kerak" },
  )
  telegram_id: string;

  @ApiProperty({
    example: 'John',
    description: 'Ism',
  })
  @IsNotEmpty({ message: 'Ism kiritilishi shart' })
  @IsString()
  first_name: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Familiya',
  })
  @IsNotEmpty({ message: 'Familiya kiritilishi shart' })
  @IsString()
  last_name: string;

  @ApiProperty({
    example: '+998901234567',
    description: 'Telefon raqami',
  })
  @IsNotEmpty({ message: 'Telefon raqami kiritilishi shart' })
  @IsPhoneNumber('UZ', {
    message: "Telefon raqami noto'g'ri formatda (+998XXXXXXXXX)",
  })
  phoneNumber: string;
}
