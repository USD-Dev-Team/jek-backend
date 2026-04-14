import { Module } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { PrismaModule } from 'src/core/database/prsima.module';
import { RequestsModule } from '../requests/requests.module';

@Module({
  imports: [PrismaModule,RequestsModule],
  providers: [StatisticsService],
  controllers: [StatisticsController]
})
export class StatisticsModule { }
