import {
  IsNotEmpty,
  IsString,
  IsEnum,
  MinLength,
  Matches,
} from 'class-validator';
import { District } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
export class RegisterDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Isminggizni kiriting' })
  @IsString()
  first_name: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Isminggizni kiriting' })
  @IsString()
  last_name: string;

  @ApiProperty()
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

  @ApiProperty()
  @IsNotEmpty({ message: 'Hududni tanlash majburiy' })
  @IsEnum(District, {
    message: "Sirdaryo viloyatidagi to'g'ri hududni tanlang",
  })
  address: District;

  @ApiProperty()
  @IsNotEmpty({ message: 'Parol majburiy' })
  @MinLength(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[a-zA-Z]).*$/, {
    message: "Parolda kamida 1 ta raqam va 1 ta harf bo'lishi shart",
  })
  password: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Parolni tasdiqlash majburiy' })
  @IsString()
  passwordConfirm: string;
}

export class LoginDto {
  @ApiProperty()
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

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" })
  @IsNotEmpty({ message: 'Parol kiritilishi shart' })
  password: string;
}
