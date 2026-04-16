import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CompleteRequestDto {
  @ApiProperty({
    example:
      "Muammo joyida o'rganildi va bartaraf etildi. Yangi chiroq o'rnatildi.",
    description: "Arizani yopish bo'yicha izoh (Majburiy)",
  })
  @IsNotEmpty({ message: 'Izoh kiritish majburiy' })
  @IsString()
  @MinLength(10, {
    message: "Izoh kamida 10 ta belgidan iborat bo'lishi kerak",
  })
  note: string;
}

export class RejectRequestDto {
    @ApiProperty({
        example: 'Ushbu muammo bizning vakolatimizga kirmaydi. Iltimos, elektr tarmoqlariga murojaat qiling.',
        description: 'Rad etish sababi (Majburiy)',
    })
    @IsNotEmpty({ message: 'Rad etish sababini ko\'rsatish majburiy' })
    @IsString()
    @MinLength(10, { message: 'Sabab kamida 10 ta belgidan iborat bo\'lishi kerak' })
    reason: string;
}
