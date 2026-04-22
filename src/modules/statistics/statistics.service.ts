import { Injectable } from '@nestjs/common';
import { GeneralStatisticsDto } from './dto/statistics.dto';
import { PrismaService } from 'src/core/database/prisma.service';
import { Prisma } from '@prisma/client';
@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(dto: GeneralStatisticsDto) {
    const year = dto.year ?? new Date().getFullYear();
    const { district, adminId, neighborhood } = dto;

    // 1. Динамик филтр
    const baseWhere: any = {
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      },
    };

    if (district || neighborhood) {
      baseWhere.address = {
        ...(district && {
          district: { contains: district, mode: 'insensitive' },
        }),
        ...(neighborhood && {
          neighborhood: { contains: neighborhood, mode: 'insensitive' },
        }),
      };
    }
    if (adminId) baseWhere.assigned_jek_id = adminId;

    // 2. Барча статусларни биттада гуруҳлаб санаш
    const statusCounts = await this.prisma.requests.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { id: true },
    });

    // 3. График учун ойлик динамика
    const yearlyDynamics = await this.getMonthlyDynamics(year, baseWhere);

    // 4. Бугунги фаоллик
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayReceived, todayFinished] = await Promise.all([
      this.prisma.requests.count({
        where: { ...baseWhere, createdAt: { gte: today } },
      }),
      this.prisma.requests.count({
        where: { ...baseWhere, status: 'COMPLETED', updatedAt: { gte: today } },
      }),
    ]);

    return {
      // Статуслар рўйхати (Фронтенд учун хом ҳолатда)
      // Масалан: [{ status: 'PENDING', _count: { id: 10 } }, ...]
      statuses: statusCounts,

      yearlyDynamics,
      todayActivity: {
        received: todayReceived,
        finished: todayFinished,
      },
      // Умумий сонини ҳам қўшиб юборамиз
      totalRequests: statusCounts.reduce(
        (acc, curr) => acc + curr._count.id,
        0,
      ),
    };
  }

  private async getMonthlyDynamics(year: number, baseWhere: any) {
    const adminId = baseWhere.assigned_jek_id;

    // 1. Динамик филтр ясаб оламиз
    // Агар adminId бўлса, UUID типида солиштирамиз, бўлмаса бўш жой қолдирамиз
    const adminFilter = adminId
      ? Prisma.sql`AND "assigned_jek_id" = ${adminId}`
      : Prisma.empty;

    // 2. Сўровни юборамиз
    const monthlyData = await this.prisma.$queryRaw`
    SELECT 
      EXTRACT(MONTH FROM "createdAt") as month,
      COUNT(id) as count
    FROM "requests"
    WHERE EXTRACT(YEAR FROM "createdAt") = ${year}
    ${adminFilter}  
    GROUP BY month
    ORDER BY month ASC
  `;

    // 3. Маълумотни форматлаш
    const chartData = new Array(12).fill(0);
    (monthlyData as any[]).forEach((d) => {
      // PostgreSQL баъзан ойни 1.0 (float) қайтариши мумкин, шунинг учун parseInt
      const monthIndex = parseInt(d.month) - 1;
      chartData[monthIndex] = Number(d.count);
    });

    return chartData;
  }
}
