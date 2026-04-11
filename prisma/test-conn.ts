import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const roles = await prisma.$queryRaw`SELECT 1`;
        console.log('Connection successful:', roles);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);
