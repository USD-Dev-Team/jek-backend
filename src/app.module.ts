import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './core/database/prsima.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AdminsModule } from './modules/admins/admins.module';
import { RequestsModule } from './modules/requests/requests.module';
import { BotModule } from './modules/bot/bot.module';
import { MediaModule } from './modules/media/media.module';
import { RequestPhotosModule } from './modules/request-photos/request-photos.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { RedisModule } from '@nestjs-modules/ioredis';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RedisModule.forRoot({
      type: 'single',
      url: 'redis://localhost:6379', // Parol bo'lsa: redis://:password@host:port
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    AuthModule,
    UsersModule,
    AdminsModule,
    RequestsModule,
    MediaModule,
    RequestPhotosModule,
    AddressesModule,
    BotModule,
    StatisticsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
