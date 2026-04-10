import { IsString, IsNotEmpty } from 'class-validator';
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
}
