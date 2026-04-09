import { ApiProperty } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsString,
    IsNumber,
    IsOptional,
    MaxLength,
    IsEnum,
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
        example: 'Nurafshon MFY, Paxtakor ko\'chasi, 15-uy',
        description: 'Arizaning to\'liq manzili',
    })
    @IsNotEmpty({ message: 'To\'liq manzil kiritilishi shart' })
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

    @ApiProperty({ example: 'Paxtakor', required: false })
    @IsOptional()
    @IsString()
    street?: string;

    @ApiProperty({ example: '15', required: false })
    @IsOptional()
    @IsString()
    house?: string;

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
        description: 'Muammo haqida batafsil ma\'lumot',
    })
    @IsNotEmpty({ message: 'Tavsif kiritilishi shart' })
    @IsString()
    description: string;
}
