// GARANTİ + TEKRAR ARIZA UCU — fiş ekranına gerçekten ulaşıyor mu?
// Çalıştır:  node scripts/test-garanti-ucu.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Kural kütüphanesi ayrı test ediliyor (test-garanti.mjs). Burada test
// edilen şey VERİ YOLU: alan sorguda seçilmezse ya da uç cevaba koymazsa
// teknisyen hiçbir şey görmez ve düzeltme kâğıt üzerinde kalır.
//
// Ayrıca: garanti alanlarını YAZABİLİYOR muyuz ve yazarken tarih kayıyor mu?
// Sözleşmelerde "2026-10-03" UTC okununca 20 gün 21 görünmüştü; aynı hata
// burada garantinin bitiş gününü kaydırırdı.
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

const SLUG = 'test-garanti-ucu';
const GUN = 86400000;
const gunSonra = (n) => new Date(Date.now() + n * GUN);
const gunOnce = (n) => new Date(Date.now() - n * GUN);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  const tenant = await p.tenant.create({
    data: {
      name: SLUG, slug: SLUG,
      users: { create: { email: 'gar@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Y', role: 'ADMIN', isActive: true } },
    },
  });
  const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'Garanti Ofis', phone: '5551110001' } });
  const kullanici = await p.user.findFirst({ where: { tenantId: tenant.id }, select: { id: true } });

  let n = 0;
  const cihazKur = (ek = {}) => p.device.create({
    data: {
      tenantId: tenant.id, customerId: musteri.id, brand: 'Kyocera', model: 'M2540',
      serialNo: `GAR-${++n}`, publicCode: `GAR-${n}`, qrTokenHash: 'x', ...ek,
    },
  });

  const c = await fetch(`${KOK}/api/auth/csrf`);
  const cc = (c.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await c.json();
  const gy = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cc },
    body: new URLSearchParams({ email: 'gar@test.local', password: 'test1234', csrfToken, redirect: 'false', json: 'true' }),
    redirect: 'manual',
  });
  const cs = [cc];
  for (const x of (gy.headers.getSetCookie?.() ?? [])) cs.push(x.split(';')[0]);
  const cerez = cs.join('; ');
  const durum = async (id) => (await fetch(`${KOK}/api/devices/${id}/fault-history`, { headers: { cookie: cerez } })).json();

  console.log('\n★ GARANTİ FİŞ EKRANINA ULAŞIYOR\n');
  {
    const d = await cihazKur({ warrantyEnd: gunSonra(200), warrantyNote: 'parça hariç' });
    const r = await durum(d.id);
    t('uç garanti bilgisini döndürüyor', !!r.garanti, r);
    t('kapsamda', r.garanti.durum === 'KAPSAMDA', r.garanti);
    t('★ ücretsiz olduğu söyleniyor', r.garanti.ucretli === false, r.garanti);
    t('kapsam notu mesajda', /parça hariç/.test(r.garanti.mesaj), r.garanti.mesaj);
  }
  {
    const d = await cihazKur({ warrantyEnd: gunOnce(10) });
    const r = await durum(d.id);
    t('bitmiş garanti BITTI', r.garanti.durum === 'BITTI', r.garanti);
    t('★ ücretli olduğu söyleniyor', r.garanti.ucretli === true, r.garanti);
  }
  {
    // ★ Kurulum tarihi var ama garanti yok: TÜRETİLMEMELİ.
    const d = await cihazKur({ installedAt: gunOnce(100) });
    const r = await durum(d.id);
    t('★ kurulum tarihinden garanti TÜRETİLMİYOR', r.garanti.durum === 'BILINMIYOR', r.garanti);
    t('★ ücret kararı verilmiyor (null)', r.garanti.ucretli === null, r.garanti);
  }

  console.log('\n★ GARANTİ YAZILABİLİYOR VE TARİH KAYMIYOR\n');
  {
    const d = await cihazKur();
    const hedef = gunSonra(45);
    const y = await fetch(`${KOK}/api/devices/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ warrantyStart: iso(gunOnce(320)), warrantyEnd: iso(hedef), warrantyNote: 'tam kapsam' }),
    });
    t('güncelleme kabul edildi', y.ok, y.status);
    const k = await p.device.findUnique({ where: { id: d.id }, select: { warrantyEnd: true, warrantyNote: true } });
    t('★ kaydedilen tarih YEREL gün olarak duruyor', iso(k.warrantyEnd) === iso(hedef), { yazilan: iso(hedef), okunan: iso(k.warrantyEnd) });
    t('kapsam notu kaydedildi', k.warrantyNote === 'tam kapsam', k);

    const r = await durum(d.id);
    t('★ kalan gün doğru (45)', r.garanti.kalanGun === 45, r.garanti);
  }
  {
    // Boşaltılabilmeli: yanlış girilen garanti silinsin.
    const d = await cihazKur({ warrantyEnd: gunSonra(10) });
    await fetch(`${KOK}/api/devices/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ warrantyEnd: '', warrantyNote: '' }),
    });
    const r = await durum(d.id);
    t('boş gönderilince garanti siliniyor', r.garanti.durum === 'BILINMIYOR', r.garanti);
  }

  console.log('\n★ TEKRAR ARIZA FİŞ EKRANINA ULAŞIYOR\n');
  {
    const d = await cihazKur();
    const r0 = await durum(d.id);
    t('geçmişsiz cihazda tekrar uyarısı yok', r0.tekrarAriza.tekrar === false, r0.tekrarAriza);

    await p.serviceTicket.create({
      data: {
        tenantId: tenant.id, customerId: musteri.id, deviceId: d.id,
        createdByUserId: kullanici.id, ticketNumber: 'GAR-ESKI-1',
        issueText: 'Kağıt sıkışması', status: 'DELIVERED',
        createdAt: gunOnce(12), statusUpdatedAt: gunOnce(10),
      },
    });
    const r = await durum(d.id);
    t('★ 10 gün önce kapanmış fiş tekrar sayılıyor', r.tekrarAriza.tekrar === true && r.tekrarAriza.gunler === 10, r.tekrarAriza);
    t('fiş numarası cevapta', r.tekrarAriza.fisler[0].ticketNumber === 'GAR-ESKI-1', r.tekrarAriza.fisler);
    t('arıza metni cevapta', /Kağıt/.test(r.tekrarAriza.fisler[0].arize), r.tekrarAriza.fisler[0]);
  }
  {
    // AÇIK fiş tekrar arıza değil.
    const d = await cihazKur();
    await p.serviceTicket.create({
      data: {
        tenantId: tenant.id, customerId: musteri.id, deviceId: d.id,
        createdByUserId: kullanici.id, ticketNumber: 'GAR-ACIK-1',
        issueText: 'Devam eden', status: 'IN_SERVICE',
        createdAt: gunOnce(5), statusUpdatedAt: gunOnce(5),
      },
    });
    const r = await durum(d.id);
    t('★ açık fiş tekrar arıza sayılmıyor', r.tekrarAriza.tekrar === false, r.tekrarAriza);
  }
  {
    // Eski fiş (60 gün) eşiğin dışında.
    const d = await cihazKur();
    await p.serviceTicket.create({
      data: {
        tenantId: tenant.id, customerId: musteri.id, deviceId: d.id,
        createdByUserId: kullanici.id, ticketNumber: 'GAR-COKESKI',
        issueText: 'Eski', status: 'DELIVERED',
        createdAt: gunOnce(62), statusUpdatedAt: gunOnce(60),
      },
    });
    const r = await durum(d.id);
    t('60 gün önceki fiş tekrar sayılmıyor', r.tekrarAriza.tekrar === false, r.tekrarAriza);
    t('arıza geçmişi yine de sayılıyor', r.total === 1, r.total);
  }

  console.log('\nKOMŞU BAYİ SIZMIYOR\n');
  {
    const komsu = await p.tenant.create({
      data: {
        name: `${SLUG}-k`, slug: `${SLUG}-k`,
        users: { create: { email: 'gar-k@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'K', role: 'ADMIN', isActive: true } },
      },
    });
    const km = await p.customer.create({ data: { tenantId: komsu.id, name: 'Komsu', phone: '5559990000' } });
    const kd = await p.device.create({
      data: {
        tenantId: komsu.id, customerId: km.id, brand: 'X', model: 'Y',
        serialNo: 'KOMSU-1', publicCode: 'KOMSU-1', qrTokenHash: 'x', warrantyEnd: gunSonra(100),
      },
    });
    const y = await fetch(`${KOK}/api/devices/${kd.id}/fault-history`, { headers: { cookie: cerez } });
    t('başka bayinin cihazı okunamıyor', y.status === 404, y.status);
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
