import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTenant() {
  const tenantName = 'Afyon Teknik Servis';
  const adminEmail = 'afyonadmin@servis.com';
  const adminPassword = 'afyon170305';
  const adminName = 'Afyon Admin';

  console.log('🌱 Yeni tenant oluşturuluyor...');

  // Tenant oluştur
  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName,
      plan: 'pro',
    },
  });

  console.log('✅ Tenant oluşturuldu:', tenant.name, '| ID:', tenant.id);

  // Admin kullanıcı oluştur
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: adminEmail,
      passwordHash: hashedPassword,
      name: adminName,
      role: UserRole.ADMIN,
    },
  });

  console.log('✅ Admin kullanıcı oluşturuldu:', admin.email);
  console.log('\n🔑 Giriş Bilgileri:');
  console.log(`   Email   : ${adminEmail}`);
  console.log(`   Şifre   : ${adminPassword}`);
  console.log(`   Tenant  : ${tenantName} (${tenant.id})`);
}

createTenant()
  .catch((e) => {
    console.error('❌ Hata:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
