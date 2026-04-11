import 'dotenv/config';
import { PrismaClient, jekRoles } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const password = 'Admin123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('🌱 Seeding database...');

    // 1. 4 ta Government (Hokimiyat) adminlarini yaratish
    const governmentUsers = [
        { first_name: 'Gov', last_name: 'User 1', phoneNumber: '+998901000001' },
        { first_name: 'Gov', last_name: 'User 2', phoneNumber: '+998901000002' },
        { first_name: 'Gov', last_name: 'User 3', phoneNumber: '+998901000003' },
        { first_name: 'Gov', last_name: 'User 4', phoneNumber: '+998901000004' },
    ];

    for (const user of governmentUsers) {
        await prisma.admins.upsert({
            where: { phoneNumber: user.phoneNumber },
            update: {}, // Agar bo'lsa hech narsa qilmaslik
            create: {
                ...user,
                password: hashedPassword,
                role: jekRoles.Government,
                isActive: true,
            },
        });
    }
    console.log('✅ 4 Government users seeded');

    // 2. 4 ta INSPECTION (Inspeksiya) adminlarini yaratish
    const inspectionUsers = [
        { first_name: 'Insp', last_name: 'User 1', phoneNumber: '+998902000001' },
        { first_name: 'Insp', last_name: 'User 2', phoneNumber: '+998902000002' },
        { first_name: 'Insp', last_name: 'User 3', phoneNumber: '+998902000003' },
        { first_name: 'Insp', last_name: 'User 4', phoneNumber: '+998902000004' },
    ];

    for (const user of inspectionUsers) {
        await prisma.admins.upsert({
            where: { phoneNumber: user.phoneNumber },
            update: {}, // Agar bo'lsa hech narsa qilmaslik
            create: {
                ...user,
                password: hashedPassword,
                role: jekRoles.INSPECTION,
                isActive: true,
            },
        });
    }
    console.log('✅ 4 Inspection users seeded');

    console.log('🎉 Seeding completed successfully.');
}

main()
    .catch((e) => {
        console.error('CRITICAL SEED ERROR:');
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
