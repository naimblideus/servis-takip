// PORTAL TALEBİ GECİKMESİ
// Çalıştır:  node scripts/test-portal-gecikme.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Ekran bekleyen talebi yalnız SAYIYORDU: "3 bekliyor" yazıyor ama üçü de
// dünkü mü, biri iki haftalık mı belli değildi. Müşteri portaldan yazıp
// dönülmediği için telefonla arıyor ve bayi "bize ulaşmadı" diyor — oysa
// kayıt ekranda duruyor.
//
// Sayılacak olan YALNIZ BEKLEYENLER: işlenmiş bir talep ne kadar eski
// olursa olsun gecikme değildir, iş bitmiştir.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const p = new PrismaClient();
const KOK = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

try { await fetch(`${KOK}/api/rozetler`); } catch {
  console.log(`ATLANDI: ${KOK} ayakta değil (önce npm run dev).`);
  await p.$disconnect(); process.exit(0);
}

const SLUG = 'test-portal-gecikme';
const GUN = 86400000;
const gunOnce = (n) => new Date(Date.now() - n * GUN);

try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  const tenant = await p.tenant.create({
    data: {
      name: SLUG, slug: SLUG,
      users: { create: { email: 'pg@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Y', role: 'ADMIN', isActive: true } },
    },
  });
  const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'Portal Ofis', phone: '5551110001' } });

  const talep = (gun, durum = 'BEKLIYOR') => p.portalRequest.create({
    data: {
      tenantId: tenant.id, customerId: musteri.id,
      tur: 'ARIZA', durum, aciklama: `${gun} gün önce`,
      createdAt: gunOnce(gun),
    },
  });

  const c = await fetch(`${KOK}/api/auth/csrf`);
  const cc = (c.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await c.json();
  const gy = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cc },
    body: new URLSearchParams({ email: 'pg@test.local', password: 'test1234', csrfToken, redirect: 'false', json: 'true' }),
    redirect: 'manual',
  });
  const cs = [cc];
  for (const x of (gy.headers.getSetCookie?.() ?? [])) cs.push(x.split(';')[0]);
  const cerez = cs.join('; ');
  const al = async () => (await fetch(`${KOK}/api/portal-talepleri?durum=BEKLIYOR`, { headers: { cookie: cerez } })).json();

  console.log('\nGECİKME YOKKEN UYARI YOK\n');
  {
    const d = await al();
    t('boşken geciken 0', d.geciken === 0, d);
    t('en eski null', d.enEskiGun === null, d);
    await talep(0);
    const d2 = await al();
    t('bugünkü talep gecikme sayılmıyor', d2.geciken === 0 && d2.bekleyen === 1, d2);
    t('bekleyen gün 0', d2.items[0].bekleyenGun === 0, d2.items[0]);
  }

  console.log('\n★ EŞİK\n');
  {
    await talep(1);
    const d = await al();
    t('1 gün bekleyen gecikme değil', d.geciken === 0, d);
    await talep(2);
    const d2 = await al();
    t(`★ ${d2.gecikmeGun} gün bekleyen GECİKMİŞ`, d2.geciken === 1, d2);
    const iki = d2.items.find((x) => x.bekleyenGun === 2);
    t('satırda gecikti işareti var', iki?.gecikti === true, iki);
  }
  {
    await talep(9);
    const d = await al();
    t('gecikenler sayılıyor (2)', d.geciken === 2, d);
    t('★ en eski gün bildiriliyor (9)', d.enEskiGun === 9, d);
  }

  console.log('\n★ İŞLENMİŞ TALEP GECİKME DEĞİL\n');
  {
    await talep(30, 'ISLENDI');
    await talep(40, 'REDDEDILDI');
    const d = await al();
    t('★ işlenmiş/kapatılmış talepler gecikmeye girmiyor', d.geciken === 2, d);
    t('★ en eski gün de etkilenmiyor', d.enEskiGun === 9, d);
    t('bekleyen sayısı doğru (4)', d.bekleyen === 4, d);
  }

  console.log('\nKOMŞU BAYİ SIZMIYOR\n');
  {
    const komsu = await p.tenant.create({
      data: {
        name: `${SLUG}-k`, slug: `${SLUG}-k`,
        users: { create: { email: 'pg-k@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'K', role: 'ADMIN', isActive: true } },
      },
    });
    const km = await p.customer.create({ data: { tenantId: komsu.id, name: 'Komsu', phone: '5559990000' } });
    await p.portalRequest.create({
      data: { tenantId: komsu.id, customerId: km.id, tur: 'ARIZA', durum: 'BEKLIYOR', aciklama: 'komsu', createdAt: gunOnce(90) },
    });
    const d = await al();
    t('komşu bayinin talebi sayılmıyor', d.enEskiGun === 9 && d.bekleyen === 4, d);
    await p.tenant.delete({ where: { id: komsu.id } });
  }
} finally {
  for (const sl of [SLUG, `${SLUG}-k`]) {
    const e = await p.tenant.findFirst({ where: { slug: sl } });
    if (e) await p.tenant.delete({ where: { id: e.id } });
  }
  console.log('\n  (temizlik: test bayisi silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
