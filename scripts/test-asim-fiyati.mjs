// AŞIM FİYATI — dahil paketi aşan sayfalar hangi fiyattan faturalanıyor?
// Çalıştır:  node scripts/test-asim-fiyati.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Cihaz kartında ve Toplu Zam ekranında "Aşım (S/B)" diye ayrı bir fiyat
// ayarlanabiliyordu ama FATURALAMA BU ALANI HİÇ OKUMUYORDU: aşan sayfalar
// her zaman normal sayfa fiyatından kesiliyordu.
//
// "Ayda 1.000 sayfa dahil, aşanı 60 kuruş" diye anlaşan bayi, aşan sayfaları
// 42 kuruştan faturalıyordu. Sayfa başına 18 kuruş, ayda 500 sayfa aşımda
// ₺90 — ve hiçbir ekran bunu söylemiyordu. Bayi sözleşmesine bakıp "doğru
// kesiyorum" sanıyordu.
//
// Test uçtan uca koşuyor çünkü asıl risk hesap değil VERİ YOLU: fiyat alanı
// sorguda seçilmezse düzeltme kâğıt üzerinde kalır, fatura yine eski
// rakamı verir.
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

const SLUG = 'test-asim-fiyati';

try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  const tenant = await p.tenant.create({
    data: {
      name: SLUG, slug: SLUG, pricePerBlack: 0.30, pricePerColor: 1.00,
      users: { create: { email: 'asim@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Y', role: 'ADMIN', isActive: true } },
    },
  });
  const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'Aşım Testi', phone: '5551110001' } });

  const c = await fetch(`${KOK}/api/auth/csrf`);
  const cc = (c.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await c.json();
  const gy = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cc },
    body: new URLSearchParams({ email: 'asim@test.local', password: 'test1234', csrfToken, redirect: 'false', json: 'true' }),
    redirect: 'manual',
  });
  const cs = [cc];
  for (const x of (gy.headers.getSetCookie?.() ?? [])) cs.push(x.split(';')[0]);
  const cerez = cs.join('; ');

  let sira = 0;
  const cihazKur = (ek) => p.device.create({
    data: {
      tenantId: tenant.id, customerId: musteri.id, brand: 'Kyocera', model: 'M2540',
      serialNo: `ASM-${++sira}`, isRental: true, monthlyRent: 1000,
      publicCode: `ASM-${sira}`, qrTokenHash: 'x',
      counterBlack: 10000, counterColor: 0, ...ek,
    },
  });
  // Zincirin başı: fark buradan hesaplanıyor.
  const baslangic = (deviceId) => p.counterReading.create({
    data: {
      tenantId: tenant.id, deviceId, counterBlack: 10000, counterColor: 0,
      deltaBlack: 0, deltaColor: 0, calculatedCost: 0, billed: true,
      source: 'TOPLU', readingDate: new Date(Date.now() - 40 * 86400000),
    },
  });
  const oku = async (deviceId, siyah, renkli = 0) => {
    const y = await fetch(`${KOK}/api/devices/${deviceId}/readings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ counterBlack: siyah, counterColor: renkli, includeMonthlyRent: false }),
    });
    return y.json();
  };

  console.log('\n★ AŞIM FİYATI FATURAYA GİRİYOR\n');
  {
    // Dahil 1.000 · sayfa ₺0,30 · aşım ₺0,60 · okuma 1.500 sayfa
    // Aşan 500 sayfa × ₺0,60 = ₺300   (eskiden 500 × ₺0,30 = ₺150 idi)
    const d = await cihazKur({ includedBlack: 1000, pricePerBlack: 0.30, overagePriceBlack: 0.60 });
    await baslangic(d.id);
    const r = await oku(d.id, 11500);
    t('fark 1.500 sayfa', r.deltaBlack === 1500, r.deltaBlack);
    t('★ aşan 500 sayfa AŞIM fiyatından kesildi (₺300)', Number(r.calculatedCost) === 300, {
      beklenen: 300, gelen: Number(r.calculatedCost), eskiHatali: 150,
    });
  }
  {
    // Renkli tarafta da aynı: dahil 500 · sayfa ₺1,00 · aşım ₺2,00
    // Aşan 300 renkli × ₺2,00 = ₺600
    const d = await cihazKur({
      includedBlack: 0, pricePerBlack: 0, includedColor: 500,
      pricePerColor: 1.00, overagePriceColor: 2.00,
    });
    await baslangic(d.id);
    const r = await oku(d.id, 10000, 800);
    t('★ renkli aşım da aşım fiyatından (₺600)', Number(r.calculatedCost) === 600, {
      beklenen: 600, gelen: Number(r.calculatedCost), eskiHatali: 300,
    });
  }

  console.log('\nDAHİL PAKETİN İÇİ ÜCRETSİZ KALIYOR\n');
  {
    // Dahil 1.000, okuma 800 → hiç aşım yok, tutar 0 olmalı.
    const d = await cihazKur({ includedBlack: 1000, pricePerBlack: 0.30, overagePriceBlack: 0.60 });
    await baslangic(d.id);
    const r = await oku(d.id, 10800);
    t('dahil paketin içi ücretsiz', Number(r.calculatedCost) === 0, r.calculatedCost);
  }

  console.log('\n★ AŞIM FİYATI BOŞKEN DAVRANIŞ DEĞİŞMİYOR\n');
  {
    // Mevcut verinin tamamı böyle: aşım alanı boş. Fatura AYNEN eskisi gibi
    // sayfa fiyatını kullanmalı — bu düzeltme kimsenin faturasını değiştirmedi.
    const d = await cihazKur({ includedBlack: 1000, pricePerBlack: 0.30, overagePriceBlack: null });
    await baslangic(d.id);
    const r = await oku(d.id, 11500);
    t('★ aşım boşsa sayfa fiyatı kullanılıyor (₺150)', Number(r.calculatedCost) === 150, {
      beklenen: 150, gelen: Number(r.calculatedCost),
    });
  }
  {
    // Cihazın sayfa fiyatı da boşsa bayi varsayılanına düşmeli (₺0,30).
    const d = await cihazKur({ includedBlack: 1000, pricePerBlack: null, overagePriceBlack: null });
    await baslangic(d.id);
    const r = await oku(d.id, 11500);
    t('sayfa fiyatı da boşsa bayi varsayılanı (₺150)', Number(r.calculatedCost) === 150, Number(r.calculatedCost));
  }
  {
    // Aşım fiyatı SIFIR yazılmışsa bu bir tercihtir — "aşım ücretsiz".
    // null ile 0 karıştırılmamalı; 0 sayfa fiyatına düşmemeli.
    const d = await cihazKur({ includedBlack: 1000, pricePerBlack: 0.30, overagePriceBlack: 0 });
    await baslangic(d.id);
    const r = await oku(d.id, 11500);
    t('★ aşım ₺0 yazılmışsa ücretsiz (sayfa fiyatına DÜŞMÜYOR)', Number(r.calculatedCost) === 0, Number(r.calculatedCost));
  }

  console.log('\nAYNI DÖNEMDE İKİNCİ OKUMA — DAHİL PAKET TEK KEZ\n');
  {
    // Dahil 1.000. Önce 600 sayfa (aşım yok), sonra 700 sayfa daha.
    // Kümülatif 1.300 → aşan 300 × ₺0,60 = ₺180. Dahil paket iki kez
    // uygulanmamalı.
    const d = await cihazKur({ includedBlack: 1000, pricePerBlack: 0.30, overagePriceBlack: 0.60 });
    await baslangic(d.id);
    const r1 = await oku(d.id, 10600);
    t('ilk okuma aşımsız', Number(r1.calculatedCost) === 0, r1.calculatedCost);
    const r2 = await oku(d.id, 11300);
    t('★ ikinci okumada yalnız aşan 300 sayfa (₺180)', Number(r2.calculatedCost) === 180, {
      beklenen: 180, gelen: Number(r2.calculatedCost),
    });
  }
} finally {
  const e = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (e) await p.tenant.delete({ where: { id: e.id } });
  console.log('\n  (temizlik: test bayisi silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
