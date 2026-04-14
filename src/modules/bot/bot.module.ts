import { Module, Global } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
import { BotUpdate } from './bot.update';
import { BotService } from './bot.service';
import { BotFlowService } from './bot-flow.service';
import { AddressesModule } from '../addresses/addresses.module';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
    imports: [
        AddressesModule,
        TelegrafModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                token: config.get<string>('BOT_TOKEN')!,
            }),
        }),
        RedisModule
    ],
    providers: [BotUpdate, BotService, BotFlowService],
    exports: [BotService, BotFlowService],
})
export class BotModule { }
