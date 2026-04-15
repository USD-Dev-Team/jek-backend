import { Module } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';

import { AddressesModule } from '../addresses/addresses.module';
import { MediaModule } from '../media/media.module';
import { MediaService } from '../media/media.service';

@Module({
    imports: [AddressesModule,MediaModule],
    controllers: [RequestsController],
    providers: [RequestsService,MediaService],
    exports: [RequestsService],
})
export class RequestsModule { }
