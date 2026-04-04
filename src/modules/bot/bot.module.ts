import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
import { BotUpdate } from './bot.update';
import { BotService } from './bot.service';

@Module({
    imports: [
        TelegrafModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                token: config.get<string>('BOT_TOKEN')!,
            }),
        }),
    ],
    providers: [BotUpdate, BotService],
})
export class BotModule { }
