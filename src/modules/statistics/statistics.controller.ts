import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { TokenGuard } from 'src/common/guards/token.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/role';
import { jekRoles } from '@prisma/client';

@ApiTags('Statistics')
@ApiBearerAuth()
@Controller('statistics')
@UseGuards(TokenGuard, RoleGuard)
export class StatisticsController {
    constructor(private readonly statisticsService: StatisticsService) { }

    @Get('my-performance')
    @Roles(jekRoles.JEK)
    @ApiOperation({
        summary: 'JEK xodimi uchun o\'z faoliyati statistikasi',
        description: 'Xodimga biriktirilgan hududlardagi jami arizalar va statuslar bo\'yicha bo\'linishi.',
    })
    async getMyPerformance(@Req() req: any) {
        const jekId = req.user.id;
        return await this.statisticsService.getMyPerformance(jekId);
    }
}
