import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Hesap bilgisi koda gömülmez (depo public). Ya argüman ya ortam değişkeni:
//   npx tsx scripts/create-superadmin.ts <email> <şifre> [ad]
//   SA_EMAIL=... SA_PASSWORD=... npx tsx scripts/create-superadmin.ts
// Şifre en az 12 karakter; ekrana basılmaz.
const EN_KISA_SIFRE = 12;

async function main() {
  const email = (process.argv[2] || process.env.SA_EMAIL || '').trim();
  const password = process.argv[3] || process.env.SA_PASSWORD || '';
  const name = process.argv[4] || process.env.SA_NAME || 'Süper Admin';

  if (!email || !password) {
    console.error('❌ E-posta ve şifre zorunlu.');
    console.error('   Kullanım: npx tsx scripts/create-superadmin.ts <email> <şifre> [ad]');
    console.error('   ya da SA_EMAIL ve SA_PASSWORD ortam değişkenleri.');
    process.exit(1);
  }
  if (password.length < EN_KISA_SIFRE) {
    console.error(`❌ Şifre en az ${EN_KISA_SIFRE} karakter olmalı.`);
    process.exit(1);
  }

  // Daha önce oluşturulduysa sil. Silmek 2FA kaydını da götürür.
  const existing = await (prisma as any).superAdmin.findUnique({ where: { email } });
  if (existing) {
    await (prisma as any).superAdmin.delete({ where: { email } });
    console.log('⚠️  Eski kayıt silindi, yenileniyor...');
    if (existing.totpEnabled) {
      console.log("⚠️  Eski hesabın 2FA kaydı da silindi — girişten sonra 2FA'yı yeniden açın.");
    }
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
  console.log(`   URL     : /super-admin/login`);
  console.log(`   Email   : ${email}`);
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
