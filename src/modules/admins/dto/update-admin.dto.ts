import {
  IsOptional,
  IsString,
  IsPhoneNumber,
  MinLength,
  IsNotEmpty,
  Matches,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { jekRoles } from '@prisma/client';
import { Transform } from 'class-transformer';

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
  @ApiPropertyOptional({ description: 'Ismi', example: 'Ali' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Familyasi', example: 'Valiyev' })
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
    description: 'Hodim roli',
    enum: jekRoles,
    example: jekRoles.JEK,
  })
  @IsOptional()
  @IsEnum(jekRoles)
  role?: jekRoles;

  @ApiPropertyOptional({ description: 'Xodim faolligi', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true) // Query'dan kelganda stringni boolean qiladi
  @IsBoolean()
  isActive?: boolean;

  // PAGINATSIYA UCHUN QO'SHILDI
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  limit?: number = 10;
}