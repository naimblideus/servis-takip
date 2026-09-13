// PARÇA ALIŞI — uçtan uca
// Çalıştır:  node scripts/test-stok-alis-ucu.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Alış kaydı üç şeyi AYNI ANDA yapmak zorunda: kaydı yazmak, stoğu
// artırmak, ortalama maliyeti güncellemek. Biri olmazsa stok artar ama
// maliyet yanlış kalır — ve rakam makul göründüğü için kimse fark etmez.
//
//   1. Üçü birden olmalı.
//   2. Fişe parça eklendiğinde o günün maliyeti fişe DONDURULMALI.
//   3. Teknisyen stok ARTIRAMAMALI (parça eklemek başka, alış başka).
//   4. Gelecek tarihli alış kabul edilmemeli.
//   5. Komşu bayinin parçasına alış yazılamamalı.
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

const SLUG = 'test-stok-alis';

const giris = async (eposta) => {
  const csrfR = await fetch(`${KOK}/api/auth/csrf`);
  const { csrfToken } = await csrfR.json();
  const cerez0 = (csrfR.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  const r = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cerez0 },
    body: new URLSearchParams({ csrfToken, email: eposta, password: 'test1234' }),
  });
  const yeni = (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]);
  return [...cerez0.split('; ').filter(Boolean), ...yeni].join('; ');
};

try {
  for (const sl of [SLUG, `${SLUG}-k`]) {
    const e = await p.tenant.findFirst({ where: { slug: sl } });
    if (e) await p.tenant.delete({ where: { id: e.id } });
  }

  const tenant = await p.tenant.create({
    data: {
      name: 'Alış Test Ltd.', slug: SLUG,
      users: {
        create: [
          { email: 'als@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Y', role: 'ADMIN', isActive: true },
          { email: 'als-tek@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'T', role: 'TECHNICIAN', isActive: true },
        ],
      },
    },
  });
  const cerez = await giris('als@test.local');
  const cerezTek = await giris('als-tek@test.local');

  const parca = await p.part.create({
    data: { tenantId: tenant.id, sku: `ALS-${Date.now()}`, name: 'Kyocera TK-1170 Toner', group: 'Toner', stockQty: 0, buyPrice: 0, sellPrice: 1250 },
  });

  const alis = (govde, c = cerez) => fetch(`${KOK}/api/inventory/alis`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie: c },
    body: JSON.stringify(govde),
  });

  console.log('\n★ ÜÇÜ BİRDEN: kayıt + stok + ortalama\n');
  {
    const r = await alis({ partId: parca.id, adet: 5, birimAlis: 720, tedarikci: 'Anadolu Bilgisayar' });
    const d = await r.json();
    t('alış kaydedildi', r.status === 200 && d.ok, d);
    t('★ stok arttı', d.yeniStok === 5, d);
    t('★ ilk alışta ortalama = alış fiyatı', d.yeniOrtalama === 720, d);
    t('ilk alışta eski ortalama yok', d.eskiOrtalama === null, d);

    const kayit = await p.part.findUnique({ where: { id: parca.id }, select: { stockQty: true, avgCost: true, buyPrice: true } });
    t('veritabanında stok 5', kayit.stockQty === 5, kayit);
    t('★ veritabanında ortalama 720', Number(kayit.avgCost) === 720, kayit);
    t('son alış fiyatı da yazıldı', Number(kayit.buyPrice) === 720, kayit);
    t('alış kaydı tutuldu', (await p.partPurchase.count({ where: { partId: parca.id } })) === 1);
  }

  console.log('\n★ İKİNCİ ALIŞ ORTALAMAYI AĞIRLIKLI GÜNCELLİYOR\n');
  {
    // 5 × 720 + 3 × 650 = 5550 / 8 = 693,75
    const d = await (await alis({ partId: parca.id, adet: 3, birimAlis: 650, tedarikci: 'Marmara Ofis' })).json();
    t('★ ortalama 693,75', d.yeniOrtalama === 693.75, d);
    t('eski ortalama bildiriliyor', d.eskiOrtalama === 720, d);
    t('★ değişim yüzdesi negatif (ucuzladı)', d.degisimYuzde < 0, d);
    t('stok 8', d.yeniStok === 8, d);
    t('★ son alış 650 oldu ama ortalama 693,75 kaldı',
      Number((await p.part.findUnique({ where: { id: parca.id }, select: { buyPrice: true } })).buyPrice) === 650);

    const son = await p.partPurchase.findFirst({ where: { partId: parca.id }, orderBy: { createdAt: 'desc' } });
    t('alış sonrası ortalama kayda yazıldı', Number(son.avgAfter) === 693.75, son);
    t('tedarikçi kaydedildi', son.supplier === 'Marmara Ofis', son);
  }

  console.log('\n★ FİŞE PARÇA EKLENİNCE MALİYET DONDURULUYOR\n');
  {
    const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'M', phone: '5551110000' } });
    const cihaz = await p.device.create({
      data: {
        tenantId: tenant.id, customerId: musteri.id, brand: 'Kyocera', model: 'M2540',
        serialNo: 'ALS-1', publicCode: `ALS-${Date.now()}`, qrTokenHash: 'x', counterBlack: 1000,
      },
    });
    const yonetici = await p.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'ADMIN' } });
    const fis = await p.serviceTicket.create({
      data: {
        tenantId: tenant.id, deviceId: cihaz.id, customerId: musteri.id,
        ticketNumber: `ALS-${Date.now()}`, createdByUserId: yonetici.id, issueText: 'toner', status: 'NEW',
      },
    });

    const r = await fetch(`${KOK}/api/tickets/${fis.id}/parts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ partId: parca.id, quantity: 2 }),
    });
    t('parça fişe eklendi', r.status === 200, r.status);
    const tp = await p.ticketPart.findFirst({ where: { ticketId: fis.id } });
    t('★ o günün maliyeti fişe yazıldı (693,75)', Number(tp.unitCost) === 693.75, tp);

    // Sonra pahalı alış yapılıyor — GEÇMİŞ FİŞİN maliyeti DEĞİŞMEMELİ.
    await alis({ partId: parca.id, adet: 10, birimAlis: 1400, tedarikci: 'Acil Tedarik' });
    const yeniOrt = Number((await p.part.findUnique({ where: { id: parca.id }, select: { avgCost: true } })).avgCost);
    t('ortalama yükseldi', yeniOrt > 693.75, yeniOrt);
    const tp2 = await p.ticketPart.findFirst({ where: { ticketId: fis.id } });
    t('★ GEÇMİŞ FİŞİN maliyeti değişmedi', Number(tp2.unitCost) === 693.75, tp2);
    t('★ dondurulmasaydı fiş maliyeti iki katına çıkacaktı', yeniOrt / 693.75 > 1.5, yeniOrt);

    // Kullanım ortalamayı değiştirmemeli.
    const stokOnce = (await p.part.findUnique({ where: { id: parca.id }, select: { stockQty: true } })).stockQty;
    await fetch(`${KOK}/api/tickets/${fis.id}/parts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ partId: parca.id, quantity: 1 }),
    });
    const sonra = await p.part.findUnique({ where: { id: parca.id }, select: { stockQty: true, avgCost: true } });
    t('★ kullanım stoğu düşürüyor', sonra.stockQty === stokOnce - 1, { stokOnce, sonra: sonra.stockQty });
    t('★ kullanım ortalamayı DEĞİŞTİRMİYOR', Number(sonra.avgCost) === yeniOrt, sonra);
  }

  console.log('\n★ YETKİ VE DOĞRULAMA\n');
  {
    t('★ teknisyen stok ARTIRAMIYOR', (await alis({ partId: parca.id, adet: 1, birimAlis: 100 }, cerezTek)).status === 403);
    t('adet sıfır reddediliyor', (await alis({ partId: parca.id, adet: 0, birimAlis: 100 })).status === 400);
    t('negatif adet reddediliyor', (await alis({ partId: parca.id, adet: -3, birimAlis: 100 })).status === 400);
    t('negatif fiyat reddediliyor', (await alis({ partId: parca.id, adet: 1, birimAlis: -5 })).status === 400);
    t('parça seçilmemişse reddediliyor', (await alis({ adet: 1, birimAlis: 100 })).status === 400);

    const gelecek = new Date(Date.now() + 10 * 86400000).toISOString();
    const gr = await alis({ partId: parca.id, adet: 1, birimAlis: 100, tarih: gelecek });
    t('★ gelecek tarihli alış reddediliyor', gr.status === 400, gr.status);
    t('sebebi yazıyor', /gelecekte/i.test((await gr.json()).error || ''));
  }

  console.log('\n★ TEDARİKÇİ KARŞILAŞTIRMASI\n');
  {
    const d = await (await fetch(`${KOK}/api/inventory/alis?partId=${parca.id}`, { headers: { cookie: cerez } })).json();
    t('üç tedarikçi listeleniyor', d.tedarikciler.length === 3, d.tedarikciler.map((x) => x.tedarikci));
    t('★ en ucuz üstte', d.tedarikciler[0].tedarikci === 'Marmara Ofis', d.tedarikciler[0]);
    t('★ en pahalı altta', d.tedarikciler[2].tedarikci === 'Acil Tedarik', d.tedarikciler[2]);
    t('ortalama fiyatlar doğru', d.tedarikciler.find((x) => x.tedarikci === 'Anadolu Bilgisayar').ortalamaFiyat === 720, d.tedarikciler);
    t('alış geçmişi dönüyor', d.alislar.length === 3, d.alislar.length);
    t('parçanın ortalaması dönüyor', d.parca.avgCost > 0, d.parca);
  }

  console.log('\nKOMŞU BAYİ SIZMIYOR\n');
  {
    const komsu = await p.tenant.create({
      data: {
        name: `${SLUG}-k`, slug: `${SLUG}-k`,
        users: { create: { email: 'als-k@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'K', role: 'ADMIN', isActive: true } },
      },
    });
    const kp = await p.part.create({
      data: { tenantId: komsu.id, sku: `KOMSU-${Date.now()}`, name: 'Komsu Toner', stockQty: 5, buyPrice: 100, sellPrice: 200 },
    });
    t('★ başka bayinin parçasına alış yazılamıyor', (await alis({ partId: kp.id, adet: 1, birimAlis: 999 })).status === 400);
    t('komşunun stoğu değişmedi', (await p.part.findUnique({ where: { id: kp.id }, select: { stockQty: true } })).stockQty === 5);
    t('komşunun parçası okunamıyor',
      (await fetch(`${KOK}/api/inventory/alis?partId=${kp.id}`, { headers: { cookie: cerez } })).status === 404);
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
