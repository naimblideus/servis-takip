const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const password = await bcrypt.hash('Admin123!', 12);
    const admin = await prisma.superAdmin.create({
        data: {
            email: 'admin@platform.com',
            password,
            name: 'Platform Admin',
        },
    });
    console.log('Süper admin oluşturuldu:', admin.email);
}

main()
    .catch(e => { console.error('Hata:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
