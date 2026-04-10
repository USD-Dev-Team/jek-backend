import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from 'src/core/database/prsima.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AddressesModule } from '../addresses/addresses.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [PrismaModule, ConfigModule, JwtModule, AddressesModule]
})
export class AuthModule { }
