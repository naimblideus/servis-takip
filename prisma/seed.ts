import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Teknik Servis',
      plan: 'pro',
    },
  });

  console.log('✅ Tenant created:', tenant.name);

  const adminPassword = await bcrypt.hash('admin170305', 10);
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@demo.com',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
    },
  });

  console.log('✅ Admin user created:', admin.email);

  const techPassword = await bcrypt.hash('tech170305', 10);
  const technician = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'teknisyen@demo.com',
      passwordHash: techPassword,
      name: 'Ahmet Yılmaz',
      role: UserRole.TECHNICIAN,
    },
  });

  console.log('✅ Technician created:', technician.email);

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: 'Mehmet Demir',
        phone: '05321234567',
        address: 'Atatürk Cad. No:45 Kadıköy/İstanbul',
        consent: true,
      },
    }),
    prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: 'Ayşe Kaya',
        phone: '05339876543',
        address: 'İstiklal Cad. No:123 Beyoğlu/İstanbul',
        consent: true,
      },
    }),
  ]);

  console.log('✅ Created', customers.length, 'customers');

  const devices = await Promise.all([
    prisma.device.create({
      data: {
        tenantId: tenant.id,
        customerId: customers[0].id,
        brand: 'HP',
        model: 'LaserJet Pro M404dn',
        serialNo: 'JPGR123456',
        location: 'Ofis',
        publicCode: generatePublicCode(),
        qrTokenHash: await bcrypt.hash(generateToken(), 10),
      },
    }),
    prisma.device.create({
      data: {
        tenantId: tenant.id,
        customerId: customers[1].id,
        brand: 'Canon',
        model: 'imageRUNNER 2425',
        serialNo: 'CNR987654',
        location: 'Muhasebe',
        publicCode: generatePublicCode(),
        qrTokenHash: await bcrypt.hash(generateToken(), 10),
      },
    }),
  ]);

  console.log('✅ Created', devices.length, 'devices');

  const parts = await Promise.all([
    prisma.part.create({
      data: {
        tenantId: tenant.id,
        sku: 'HP-TONER-05A',
        name: 'HP 05A Toner Kartuş',
        buyPrice: 450,
        sellPrice: 650,
        stockQty: 15,
        minStock: 5,
      },
    }),
    prisma.part.create({
      data: {
        tenantId: tenant.id,
        sku: 'CANON-DRUM',
        name: 'Canon Drum Unit',
        buyPrice: 850,
        sellPrice: 1200,
        stockQty: 8,
        minStock: 3,
      },
    }),
    prisma.part.create({
      data: {
        tenantId: tenant.id,
        sku: 'FUSER-UNIT',
        name: 'Fuser Unit (Universal)',
        buyPrice: 1200,
        sellPrice: 1800,
        stockQty: 5,
        minStock: 2,
      },
    }),
  ]);

  console.log('✅ Created', parts.length, 'parts');

  const ticket = await prisma.serviceTicket.create({
    data: {
      tenantId: tenant.id,
      deviceId: devices[0].id,
      customerId: customers[0].id,
      ticketNumber: generateTicketNumber(),
      status: 'IN_SERVICE',
      createdByUserId: technician.id,
      assignedUserId: technician.id,
      issueTemplate: 'Kağıt Sıkışması',
      issueText: 'Yazıcıda sürekli kağıt sıkışması problemi var',
      actionText: 'Kağıt yolu temizlendi, rulolar kontrol edildi',
      totalCost: 350,
      paymentStatus: 'UNPAID',
    },
  });

  console.log('✅ Sample ticket created:', ticket.ticketNumber);

  // ═══ TEST TENANT — Import testi için ayrı ortam ═══
  const testTenant = await prisma.tenant.create({
    data: {
      name: 'Test Import Firması',
      plan: 'pro',
    },
  });

  const testAdminPassword = await bcrypt.hash('test123', 10);
  const testAdmin = await prisma.user.create({
    data: {
      tenantId: testTenant.id,
      email: 'test@import.com',
      passwordHash: testAdminPassword,
      name: 'Import Test Admin',
      role: UserRole.ADMIN,
    },
  });

  console.log('✅ Test tenant created:', testTenant.name);
  console.log('✅ Test admin created:', testAdmin.email);

  console.log('🎉 Seeding completed!');
  console.log('\n📝 Demo Credentials:');
  console.log('Admin: admin@demo.com / admin170305');
  console.log('Technician: teknisyen@demo.com / tech170305');
  console.log('\n📝 Import Test Credentials:');
  console.log('Import Test: test@import.com / test123');
}

function generatePublicCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'DEV-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function generateTicketNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return 'TSK-' + year + '-' + random;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });