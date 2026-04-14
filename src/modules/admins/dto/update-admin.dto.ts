import {
  IsOptional,
  IsString,
  IsPhoneNumber,
  MinLength,
  IsNotEmpty,
  Matches,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAdminDto {
  @ApiProperty({ default: 'Alisher' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiProperty({ default: 'Valiyev' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({ default: '+998951111111' })
  @IsOptional()
  @IsPhoneNumber('UZ', { message: "Telefon raqami noto'g'ri formatda" })
  phoneNumber?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ default: 'a12345678' })
  @IsNotEmpty({ message: 'Parol majburiy' })
  @MinLength(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[a-zA-Z]).*$/, {
    message: "Parolda kamida 1 ta raqam va 1 ta harf bo'lishi shart",
  })
  password: string;

  @ApiProperty({ default: 'a12345678' })
  @IsNotEmpty({ message: 'Parolni tasdiqlash majburiy' })
  @IsString()
  passwordConfirm: string;
}

export class updateStatusDto {
  @ApiProperty({ default: true })
  @IsNotEmpty()
  isActive: boolean;
}

export class UniversalStaffSearch {
  @ApiPropertyOptional({
    description: 'Ismi',
    example: 'Ali',
  })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Familyasi',
    example: 'Valiyev',
  })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Tuman nomi',
    example: 'Guliston tumani',
  })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({
    description: 'Mahalla yoki kvartal nomi',
    example: 'Namuna',
  })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({
    description: 'Telefon raqami',
    example: '+998901234567',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Ariza holati',
    example: true,
  })
  @IsOptional()
  @IsString()
  isActive?: boolean;
}