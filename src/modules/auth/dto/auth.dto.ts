import {
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AssignAddressDto } from '../../addresses/dto/address.dto';
import { Type } from 'class-transformer';
export class RegisterDto {
  @ApiProperty({ example: "Alisher" })
  @IsNotEmpty({ message: 'Isminggizni kiriting' })
  @IsString()
  first_name: string;

  @ApiProperty({ example: "Valiyev" })
  @IsNotEmpty({ message: 'Isminggizni kiriting' })
  @IsString()
  last_name: string;

  @ApiProperty({ example: "+998951111111" })
  @IsNotEmpty({ message: 'Telefon raqami kiritilishi shart' })
  @IsString({ message: "Telefon raqami matn ko'rinishida bo'lishi kerak" })
  @Matches(
    /^(\+?998)?\s?(90|91|93|94|95|97|98|99|33|88|20)\s?\d{3}\s?\d{2}\s?\d{2}$/,
    {
      message:
        "Telefon raqami noto'g'ri shaklda. Namuna: +99895 111 11 11 yoki 95 111 11 11",
    },
  )
  phoneNumber: string;

  @ApiProperty({ example: "a12345678" })
  @IsNotEmpty({ message: 'Parol majburiy' })
  @MinLength(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[a-zA-Z]).*$/, {
    message: "Parolda kamida 1 ta raqam va 1 ta harf bo'lishi shart",
  })
  password: string;

  @ApiProperty({ example: "a12345678" })
  @IsNotEmpty({ message: 'Parolni tasdiqlash majburiy' })
  @IsString()
  passwordConfirm: string;

  @ApiProperty({ type: [AssignAddressDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignAddressDto)
  addresses?: AssignAddressDto[];
}

export class LoginDto {
  @ApiProperty({ example: "+998951111111" })
  @IsNotEmpty({ message: 'Telefon raqami kiritilishi shart' })
  @IsString({ message: "Telefon raqami matn ko'rinishida bo'lishi kerak" })
  @Matches(
    /^(\+?998)?\s?(90|91|93|94|95|97|98|99|33|88|20)\s?\d{3}\s?\d{2}\s?\d{2}$/,
    {
      message:
        "Telefon raqami noto'g'ri shaklda. Namuna: +99895 111 11 11 yoki 95 111 11 11",
    },
  )
  phoneNumber: string;

  @ApiProperty({ example: "a12345678" })
  @IsString()
  @MinLength(6, { message: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" })
  @IsNotEmpty({ message: 'Parol kiritilishi shart' })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Token kiritilishi shart' })
  refreshToken: string;
}