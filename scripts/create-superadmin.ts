import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'superadmin@demo.com';
  const password = 'admin170305';
  const name = 'Süper Admin';

  // Daha önce oluşturulduysa sil
  const existing = await (prisma as any).superAdmin.findUnique({ where: { email } });
  if (existing) {
    await (prisma as any).superAdmin.delete({ where: { email } });
    console.log('⚠️  Eski kayıt silindi, yenileniyor...');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await (prisma as any).superAdmin.create({
    data: {
      email,
      password: hashedPassword,
      name,
    },
  });

  console.log('✅ Süper Admin oluşturuldu!');
  console.log('');
  console.log('🔑 Giriş Bilgileri:');
  console.log(`   URL     : /super-admin/login`);
  console.log(`   Email   : ${email}`);
  console.log(`   Şifre   : ${password}`);
  console.log(`   ID      : ${admin.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Hata:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
