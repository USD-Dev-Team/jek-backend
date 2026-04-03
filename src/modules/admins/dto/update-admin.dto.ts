import {
  IsOptional,
  IsString,
  IsPhoneNumber,
  MinLength,
  IsEnum,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { District } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAdminDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty()
  @IsOptional()
  @IsPhoneNumber('UZ', { message: "Telefon raqami noto'g'ri formatda" })
  phoneNumber?: string;

  @ApiProperty()
  @IsOptional()
  @IsEnum(District, { message: "Noto'g'ri tuman tanlandi" })
  address?: District;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Parol majburiy' })
  @MinLength(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[a-zA-Z]).*$/, {
    message: "Parolda kamida 1 ta raqam va 1 ta harf bo'lishi shart",
  })
  password: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Parolni tasdiqlash majburiy' })
  @IsString()
  passwordConfirm: string;
}

export class updateStatusDto {
  @ApiProperty()
  @IsNotEmpty()
  isActive: boolean;
}
