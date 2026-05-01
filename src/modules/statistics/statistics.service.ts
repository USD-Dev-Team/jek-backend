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
      if (district && neighborhood) {
        // Ikkala maydon ham kelsa - OR logikasi
        baseWhere.address = {
          OR: [
            { district: { contains: district, mode: 'insensitive' } },
            { neighborhood: { contains: neighborhood, mode: 'insensitive' } },
          ],
        };  
      } else if (district) {
        // Faqat district kelsa
        baseWhere.address = {
          district: { contains: district, mode: 'insensitive' },
        };
      } else if (neighborhood) {
        // Faqat neighborhood kelsa
        baseWhere.address = {
          neighborhood: { contains: neighborhood, mode: 'insensitive' },
        };
      }
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

    // 5. Top 5 hodimlar (User complete qilganlari bo'yicha)
    const topEmployeesGrouped = await this.prisma.requests.groupBy({
      by: ['assigned_jek_id'],
      where: {
        ...baseWhere,
        status: 'COMPLETED',
        assigned_jek_id: { not: null },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    });

    const adminIds = topEmployeesGrouped
      .map((item) => item.assigned_jek_id)
      .filter((id): id is string => !!id);

    const admins = await this.prisma.admins.findMany({
      where: { id: { in: adminIds } },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        addresses: {
          include: {
            address: {
              select: {
                district: true,
                neighborhood: true,
              },
            },
          },
        },
      },
    });

    const adminMap = new Map(admins.map((a) => [a.id, a]));

    const topEmployees = topEmployeesGrouped.map((item) => {
      const admin = item.assigned_jek_id
        ? adminMap.get(item.assigned_jek_id)
        : null;

      // Adminning barcha hududlarini olish
      const districts =
        admin?.addresses.map((a) => a.address.district).filter(Boolean) ?? [];
      const neighborhoods =
        admin?.addresses.map((a) => a.address.neighborhood).filter(Boolean) ??
        [];

      return {
        id: item.assigned_jek_id,
        name: admin ? `${admin.first_name} ${admin.last_name}` : "Noma'lum",
        completedCount: item._count.id,
        districts: districts.length > 0 ? districts : ["Noma'lum"],
        neighborhoods: neighborhoods.length > 0 ? neighborhoods : ["Noma'lum"],
      };
    });

    return {
      // Статуслар рўйхати (Фронтенд учун хом ҳолатда)
      // Масалан: [{ status: 'PENDING', _count: { id: 10 } }, ...]
      statuses: statusCounts,

      yearlyDynamics,
      todayActivity: {
        received: todayReceived,
        finished: todayFinished,
      },
      topEmployees,
      // Умумий сонини ҳам қўшиб юборамиз
      totalRequests: statusCounts.reduce(
        (acc, curr) => acc + curr._count.id,
        0,
      ),
    };
  }

  async getDistrictStatisticsByStatus(year?: number) {
    const targetYear = year ?? new Date().getFullYear();

    // 1. Yil boshidan oxirigicha bo'lgan vaqt oralig'ini belgilash
    const startDate = new Date(`${targetYear}-01-01`);
    const endDate = new Date(`${targetYear}-12-31T23:59:59.999Z`);

    // 2. Barcha arizalarni olish (filter bilan)
    const requests = await this.prisma.requests.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        address: {
          select: {
            district: true,
          },
        },
      },
    });

    // 3. Ma'lumotlarni guruhlash
    const districts = new Map<string, any>();

    requests.forEach((request) => {
      const district = request.address.district;
      const status = request.status;

      if (!districts.has(district)) {
        districts.set(district, {
          district,
          PENDING: 0,
          IN_PROGRESS: 0,
          COMPLETED: 0,
          JEK_COMPLETED: 0,
          REJECTED: 0,
          JEK_REJECTED: 0,
          total: 0,
        });
      }

      const districtData = districts.get(district);
      if (districtData && status in districtData) {
        districtData[status] += 1;
        districtData.total += 1;
      }
    });

    return Array.from(districts.values()).sort((a, b) =>
      a.district.localeCompare(b.district),
    );
  }

  private async getMonthlyDynamics(year: number, baseWhere: any) {
    const adminId = baseWhere.assigned_jek_id;
    const addressFilter = baseWhere.address;

    // 1. Admin filtri
    const adminFilter = adminId
      ? Prisma.sql`AND "assigned_jek_id" = ${adminId}`
      : Prisma.empty;

    // 2. Address filtri (district va neighborhood) - OR logikasi bilan
    let addressCondition = Prisma.empty;
    if (addressFilter) {
      if (addressFilter.OR) {
        // Ikkala maydon ham kelsa - OR logikasi
        const districtValue = addressFilter.OR[0]?.district?.contains;
        const neighborhoodValue = addressFilter.OR[1]?.neighborhood?.contains;

        if (districtValue && neighborhoodValue) {
          addressCondition = Prisma.sql`AND EXISTS (
            SELECT 1 FROM "addresses" a 
            WHERE a.id = "requests".address_id 
            AND (a.district ILIKE ${`%${districtValue}%`} OR a.neighborhood ILIKE ${`%${neighborhoodValue}%`})
          )`;
        }
      } else if (addressFilter.district) {
        // Faqat district kelsa
        addressCondition = Prisma.sql`AND EXISTS (
          SELECT 1 FROM "addresses" a 
          WHERE a.id = "requests".address_id 
          AND a.district ILIKE ${`%${addressFilter.district.contains}%`}
        )`;
      } else if (addressFilter.neighborhood) {
        // Faqat neighborhood kelsa
        addressCondition = Prisma.sql`AND EXISTS (
          SELECT 1 FROM "addresses" a 
          WHERE a.id = "requests".address_id 
          AND a.neighborhood ILIKE ${`%${addressFilter.neighborhood.contains}%`}
        )`;
      }
    }

    // 3. Сўровни юборамиз
    const monthlyData = await this.prisma.$queryRaw`
    SELECT 
      EXTRACT(MONTH FROM "createdAt") as month,
      COUNT(id) as count
    FROM "requests"
    WHERE EXTRACT(YEAR FROM "createdAt") = ${year}
    ${adminFilter}
    ${addressCondition}
    GROUP BY month
    ORDER BY month ASC
  `;

    // 4. Маълумотни форматлаш
    const chartData = new Array(12).fill(0);
    (monthlyData as any[]).forEach((d) => {
      // PostgreSQL баъзан ойни 1.0 (float) қайтариши мумкин, шунинг учун parseInt
      const monthIndex = parseInt(d.month) - 1;
      chartData[monthIndex] = Number(d.count);
    });

    return chartData;
  }
}
