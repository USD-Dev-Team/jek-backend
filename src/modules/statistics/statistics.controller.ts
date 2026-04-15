import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GeneralStatisticsDto } from './dto/statistics.dto';

@ApiTags('Statistics')
@Controller('statistics')
// @UseGuards(JwtAuthGuard, RolesGuard) // Admin ekanini tekshirish uchun guardlar
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('general')
  @ApiOperation({
    summary: 'Dashboard uchun barcha statistik ma’lumotlarni olish',
  })
  @ApiResponse({ status: 200, description: 'Muvaffaqiyatli qaytarildi' })
  async getGeneralStats(@Query() query: GeneralStatisticsDto) {
    // query ichidan year, district, adminId, neighborhood keladi
    return this.statisticsService.getDashboardData(query);
  }
}
