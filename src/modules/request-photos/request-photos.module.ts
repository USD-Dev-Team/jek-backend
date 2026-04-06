import { Module, Global } from '@nestjs/common';
import { RequestPhotosService } from './request-photos.service';
import { RequestPhotosController } from './request-photos.controller';

@Global()
@Module({
    controllers: [RequestPhotosController],
    providers: [RequestPhotosService],
    exports: [RequestPhotosService],
})
export class RequestPhotosModule { }
