import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { AssignAddressDto } from './dto/address.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AddressesService {
    private readonly logger = new Logger(AddressesService.name);
    private mahallaData: any;

    constructor(private readonly prisma: PrismaService) {
        this.loadMahallaData();
    }

    private loadMahallaData() {
        try {
            const filePath = path.join(process.cwd(), 'mahallas.json');
            const fileContent = fs.readFileSync(filePath, 'utf8');
            this.mahallaData = JSON.parse(fileContent);
        } catch (error) {
            this.logger.error('Error loading mahallas.json:', error);
            this.mahallaData = { addresses: [], mahallas: {} };
        }
    }

    async validateAndGetAddress (data: AssignAddressDto) {
        // 0. Hudud va mahalla mavjudligini JSON bo'yicha tekshirish
        const districts = this.mahallaData.addresses;
        if (!districts.includes(data.district)) {
            throw new BadRequestException(`Xato: '${data.district}' nomli tuman bazada mavjud emas`);
        }

        const mahallas = this.mahallaData.mahallas[data.district] || [];
        if (!mahallas.includes(data.neighborhood)) {
            throw new BadRequestException(`Xato: '${data.neighborhood}' mahallasi '${data.district}' tarkibida mavjud emas`);
        }

        let address = await this.prisma.addresses.findFirst({
            where: {
                district: data.district,
                neighborhood: data.neighborhood,
                street: data.street || null,
                house: data.house || null,
            },
        });

        if (!address) {
            address = await this.prisma.addresses.create({
                data: {
                    district: data.district,
                    neighborhood: data.neighborhood,
                    street: data.street || null,
                    house: data.house || null,
                },
            });
        }
        return address;
    }

    async assignToAdmin(adminId: string, data: AssignAddressDto) {
        const existJek = await this.prisma.admins.findUnique({ where: { id: adminId } });
        if (!existJek) throw new NotFoundException('Employee not found');

        const address = await this.validateAndGetAddress (data);

        const exists = await this.prisma.admin_addresses.findFirst({
            where: {
                admin_id: adminId,
                address_id: address.id,
            },
        });

        if (exists) throw new BadRequestException('Ushbu mahalla allaqachon biriktirilgan');

        await this.prisma.admin_addresses.create({
            data: {
                admin_id: adminId,
                address_id: address.id,
            },
        });

        return { success: true, message: 'Hudud muvaffaqiyatli biriktirildi' };
    }

    async removeFromAdmin(adminId: string, addressId: string) {
        const deleted = await this.prisma.admin_addresses.deleteMany({
            where: {
                admin_id: adminId,
                address_id: addressId,
            },
        });

        if (deleted.count === 0) throw new NotFoundException('Biriktirilgan manzil topilmadi');

        return { success: true, message: 'Hudud biriktirmasi o\'chirildi' };
    }

    // // Kelajakda bot va frontend uchun kerakli metodlar
    // async getAllDistricts() {
    //     return this.prisma.addresses.findMany({
    //         distinct: ['district'],
    //         select: { district: true },
    //     });
    // }

    // async getMahallas(district: string) {
    //     return this.prisma.addresses.findMany({
    //         where: { district },
    //         distinct: ['neighborhood'],
    //         select: { neighborhood: true },
    //     });
    // }

async findMyAddresses(jek_id: string) {
    return this.prisma.admin_addresses.findMany({
        where: {
            admin_id: jek_id,
        },
        select:{
            address:true,
        }
    });
}
}
