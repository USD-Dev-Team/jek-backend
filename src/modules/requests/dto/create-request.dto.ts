import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status_Flow } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  MaxLength,
  IsEnum,
  IsDateString,
} from 'class-validator';
export class CreateRequestDto {
  @ApiProperty({
    example: '123456789',
    description: 'Foydalanuvchining Telegram ID-si',
  })
  @IsNotEmpty({ message: 'Telegram ID kiritilishi shart' })
  @IsString()
  telegram_id: string;

  @ApiProperty({
    example: "Nurafshon MFY, Paxtakor ko'chasi, 15-uy",
    description: "Arizaning to'liq manzili",
  })
  @IsNotEmpty({ message: "To'liq manzil kiritilishi shart" })
  @IsString()
  @MaxLength(500)
  address: string;

  @ApiProperty({ example: 'Guliston tumani' })
  @IsNotEmpty({ message: 'Tuman kiritilishi shart' })
  @IsString()
  district: string;

  @ApiProperty({ example: 'Nurafshon' })
  @IsNotEmpty({ message: 'Mahalla kiritilishi shart' })
  @IsString()
  mahalla: string;

  @ApiProperty({ example: '15-bino', required: false })
  @IsOptional()
  @IsString()
  building_number?: string;

  @ApiProperty({ example: '45-xonadon', required: false })
  @IsOptional()
  @IsString()
  apartment_number?: string;

  @ApiProperty({
    example: 41.311081,
    description: 'Kenglik (Latitude)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({
    example: 69.240562,
    description: 'Uzunlik (Longitude)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({
    example: "Uyimiz oldidagi ko'cha chirog'i sinib qolgan...",
    description: "Muammo haqida batafsil ma'lumot",
  })
  @IsNotEmpty({ message: 'Tavsif kiritilishi shart' })
  @IsString()
  description: string;
}

export class UniversalFilterDto {
  @ApiPropertyOptional({
    description: 'Qidiruv boshlanish sanasi (ISO 8601 formatida)',
    example: '2026-04-10',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Qidiruv tugash sanasi (ISO 8601 formatida)',
    example: '2026-04-11',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

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
    description: 'Ariza holati',
    example: 'PENDING',
    enum: [
      'PENDING',
      'IN_PROGRESS',
      'JEK_COMPLETED',
      'JEK_REJECTED',
      'COMPLETED',
    ],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Qidiruv maydoni' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Page maydoni' })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Limit maydoni' })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  //tartib raqam, full_name, phone_number
}