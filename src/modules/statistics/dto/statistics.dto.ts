import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GeneralStatisticsDto {
  @ApiPropertyOptional({ description: 'Statistika yili', example: 2026 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number = new Date().getFullYear();

  @ApiPropertyOptional({
    description: "Tuman nomi bo'yicha filtr",
    example: 'Yunusobod',
  })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({
    description: "Xodim ID si bo'yicha filtr",
    example: 'uuid-123',
  })
  @IsOptional()
  @IsString()
  adminId?: string;

  @ApiPropertyOptional({
    description: "Mahalla nomi bo'yicha filtr",
    example: 'Namuna',
  })
  @IsOptional()
  @IsString()
  neighborhood?: string;
}
