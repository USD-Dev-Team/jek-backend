import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { GeneralStatisticsDto } from './dto/statistics.dto';
import { TokenGuard } from 'src/common/guards/token.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/role';
import { jekRoles } from '@prisma/client';
@ApiBearerAuth('token')
@ApiTags('Statistics')
@Controller('statistics')
@ApiTags('Statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('general')
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK, jekRoles.INSPECTION, jekRoles.GOVERNMENT)
  @ApiOperation({
    summary: "Dashboard uchun barcha statistik ma'lumotlarni olish",
  })
  @ApiResponse({ status: 200, description: 'Muvaffaqiyatli qaytarildi' })
  async getGeneralStats(@Query() query: GeneralStatisticsDto) {
    // query ichidan year, district, adminId, neighborhood keladi
    return this.statisticsService.getDashboardData(query);
  }

  @Get('district-statistics')
  @UseGuards(TokenGuard, RoleGuard)
  @Roles(jekRoles.JEK, jekRoles.INSPECTION, jekRoles.GOVERNMENT)
  @ApiOperation({
    summary:
      "Berilgan yil bo'yicha har bir tumandagi arizalar soni status bo'yicha",
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Yil (default: joriy yil)',
  })
  @ApiResponse({ status: 200, description: 'Muvaffaqiyatli qaytarildi' })
  async getDistrictStatistics(@Query('year') year?: number) {
    return this.statisticsService.getDistrictStatisticsByStatus(year);
  }
}
