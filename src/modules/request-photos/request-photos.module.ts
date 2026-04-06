import { Module, Global } from '@nestjs/common';
import { RequestPhotosService } from './request-photos.service';
import { RequestPhotosController } from './request-photos.controller';
import { MediaModule } from '../media/media.module';

@Global()
@Module({
    imports: [MediaModule],
    controllers: [RequestPhotosController],
    providers: [RequestPhotosService],
    exports: [RequestPhotosService],
})
export class RequestPhotosModule { }
