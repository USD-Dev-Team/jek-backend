import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyPerformance(jekId: string) {
    // 1. Xodimga biriktirilgan hududlarni (mahallalarni) olish
    const admin = await this.prisma.admins.findUnique({
      where: { id: jekId },
      include: {
        addresses: {
          include: {
            address: true,
          },
        },
      },
    });

    if (!admin) {
      throw new NotFoundException('Xodim topilmadi');
    }

    const neighborhoodNames = admin.addresses.map(
      (a) => a.address.neighborhood,
    );

    // 2. Hududidagi jami arizalar soni (PENDING va o'ziga biriktirilganlar)
    const totalRequests = await this.prisma.requests.count({
      where: {
        address: {
          neighborhood: { in: neighborhoodNames },
        },
      },
    });

    // 3. Statuslar bo'yicha guruhlash
    const statsByStatus = await this.prisma.requests.groupBy({
      by: ['status'],
      where: {
        address: {
          neighborhood: { in: neighborhoodNames },
        },
      },
      _count: {
        id: true,
      },
    });

    // Ma'lumotlarni qulay formatga keltiramiz
    const byStatus = statsByStatus.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {});

    return {
      jek_info: {
        id: admin.id,
        name: `${admin.first_name} ${admin.last_name}`,
        neighborhoods: neighborhoodNames,
      },
      statistics: {
        total_neighborhood_requests: totalRequests,
        by_status: byStatus,
      },
    };
  }

  async getGeneralStatistics() {
    // Barcha statuslar bo'yicha sanoqni bir vaqtda olamiz
    const stats = await this.prisma.requests.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    // Jami arizalar sonini hisoblaymiz
    const totalRequests = await this.prisma.requests.count();

    // Natijani chiroyli formatga keltiramiz
    const formattedStats = {
      total: totalRequests,
      pending: 0,
      in_progress: 0,
      completed: 0,
      rejected: 0,
      jek_completed: 0,
      jek_rejected: 0,
    };

    stats.forEach((stat) => {
      const statusKey = stat.status.toLowerCase();
      if (formattedStats.hasOwnProperty(statusKey)) {
        formattedStats[statusKey] = stat._count.id;
      }
    });

    return formattedStats;
  }
}
