import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './core/database/prsima.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AdminsModule } from './modules/admins/admins.module';
import { RequestsModule } from './modules/requests/requests.module';
import { BotModule } from './modules/bot/bot.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '1h' }, // Access token muddati
      }),
    }),
    AuthModule,
    UsersModule,
    AdminsModule,
    RequestsModule,
    BotModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
