import { ApiProperty } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsString,
    IsNumber,
    IsOptional,
    MaxLength,
    IsEnum,
} from 'class-validator';
import { District } from '@prisma/client';

export class CreateRequestDto {
    @ApiProperty({
        example: '123456789',
        description: 'Foydalanuvchining Telegram ID-si',
    })
    @IsNotEmpty({ message: 'Telegram ID kiritilishi shart' })
    @IsString()
    telegram_id: string;

    @ApiProperty({
        example: 'Toshkent sh., Yunusobod tumani, 19-kvartal, 1-uy',
        description: 'Arizaning aniq manzili',
    })
    @IsNotEmpty({ message: 'Manzil kiritilishi shart' })
    @IsString()
    @MaxLength(255)
    address: string;

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
        example: 'GULISTON_SHAHAR',
        enum: District,
        description: 'Tuman yoki shahar nomi (Enum)',
    })
    @IsNotEmpty({ message: 'Hudud kiritilishi shart' })
    @IsEnum(District, { message: "Noto'g'ri hudud kiritildi" })
    district: District;

    @ApiProperty({
        example: "Uyimiz oldidagi ko'cha chirog'i sinib qolgan, iltimos tuzatib bering.",
        description: 'Muammo haqida batafsil ma\'lumot',
    })
    @IsNotEmpty({ message: 'Tavsif kiritilishi shart' })
    @IsString()
    description: string;
}
