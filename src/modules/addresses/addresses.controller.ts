import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, Req } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { AssignAddressDto } from './dto/address.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TokenGuard } from 'src/common/guards/token.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/role';

@ApiTags('Addresses (Manzillar)')
@ApiBearerAuth('token')
@Controller('addresses')
export class AddressesController {
    constructor(private readonly addressesService: AddressesService) { }

    @ApiOperation({ summary: "Xodimga yangi mahalla biriktirish" })
    @ApiParam({ name: 'adminId', description: 'Xodim ID (UUID)' })
    @UseGuards(TokenGuard, RoleGuard)
    @Roles('INSPECTION')
    @Post('assign/:adminId')
    async assignAddress(
        @Param('adminId', ParseUUIDPipe) adminId: string,
        @Body() data: AssignAddressDto,
    ) {
        return this.addressesService.assignToAdmin(adminId, data);
    }

    @ApiOperation({ summary: "Xodimdan biriktirilgan mahallani o'chirish" })
    @ApiParam({ name: 'jek_id', description: 'Xodim ID (UUID)' })
    @ApiParam({ name: 'addressId', description: 'Address ID (UUID)' })
    @UseGuards(TokenGuard, RoleGuard)
    @Roles('INSPECTION')
    @Delete('remove/:jek_id/:addressId')
    async removeAddress(
        @Param('jek_id', ParseUUIDPipe) jek_id: string,
        @Param('addressId', ParseUUIDPipe) addressId: string,
    ) {
        return this.addressesService.removeFromAdmin(jek_id, addressId);
    }

    // @ApiOperation({ summary: "Barcha mavjud tumanlar ro'yxatini olish" })
    // @Get('districts')
    // async getDistricts() {
    //     return this.addressesService.getAllDistricts();
    // }

    // @ApiOperation({ summary: "Tumandagi barcha mahallalar ro'yxatini olish" })
    // @ApiQuery({ name: 'district' })
    // @Get('mahallas')
    // async getMahallas(@Query('district') district: string) {
    //     return this.addressesService.getMahallas(district);
    // }

    @ApiOperation({ summary: "Xodim o'ziga biriktirilgan manzillar ro'yxatini olishi" })
    @UseGuards(TokenGuard, RoleGuard)
    @Roles('JEK')
    @Get('my-addresses')
    async findMyAddresses(@Req() req:Request) {
        return this.addressesService.findMyAddresses(req["user"].id);
    }
}
