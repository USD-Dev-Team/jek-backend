import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignAddressDto {
    @ApiProperty({ example: 'Guliston tumani' })
    @IsNotEmpty()
    @IsString()
    district: string;

    @ApiProperty({ example: 'Nurafshon' })
    @IsNotEmpty()
    @IsString()
    neighborhood: string;

    @ApiProperty({ example: 'Yoshlar ko\'chasi', required: false })
    @IsOptional()
    @IsString()
    street?: string;

    @ApiProperty({ example: '12', required: false })
    @IsOptional()
    @IsString()
    house?: string;
}
