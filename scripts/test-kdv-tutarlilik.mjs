// KDV TUTARLILIĞI — iki para yolu aynı borcu yazmalı.
// Çalıştır:  node scripts/test-kdv-tutarlilik.mjs
//
// NEDEN BU TEST VAR
// Kira + sayaç bedeli sisteme İKİ yoldan girebiliyor:
//   1. Otomatik aylık faturalama  → CustomerInvoice (subtotal + KDV)
//   2. "Bu dönemi cariye ekle"    → AccountEntry
// lib/musteri-bakiye ikisini AYNI bakiyede topluyor. İkinci yol KDV'siz
// yazıyordu: aynı ₺10.000 kira, hangi düğmeye basıldığına göre ₺12.000 ya da
// ₺10.000 borç üretiyordu — bayinin alacağı yanlış görünüyordu.
//
// Test gerçek veritabanında uçtan uca çalışır: kiralık cihaz + okuma kurar,
// bir müşteride faturalama yolunu, diğerinde cari yolunu işletir ve iki
// bakiyenin EŞİT olmasını bekler.
import { PrismaClient } from '@prisma/client';
import { derle } from './_derle.mjs';

// TS kaynaklarini calistirilabilir hale getir (depodaki diger testlerin deseni)
const { ice } = derle({ girisler: ['src/lib/period-charges.ts', 'src/lib/musteri-bakiye.ts'], onEk: 'st-kdv-' });
const { buildInvoiceForCustomerPeriod, periodOf } = await ice('lib/invoicing');
const { commitPeriodCharges } = await ice('lib/period-charges');
const { tumBakiyeler } = await ice('lib/musteri-bakiye');

const p = new PrismaClient();
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `
      ${JSON.stringify(detay)}` : ''}`); }
};

const SLUG = 'test-kdv-tutarlilik';
let tenant;
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  const KDV = 20;
  tenant = await p.tenant.create({
    data: {
      name: 'KDV Tutarlılık Testi', slug: SLUG, plan: 'professional',
      vatRate: KDV, pricePerBlack: 0.5, pricePerColor: 2,
    },
  });

  // İki müşteri: aynı cihaz, aynı okuma — farklı para yolu
  const kurMusteri = async (ad, tel) => {
    const m = await p.customer.create({ data: { tenantId: tenant.id, name: ad, phone: tel } });
    const c = await p.device.create({
      data: {
        tenantId: tenant.id, customerId: m.id, brand: 'Test', model: 'KDV',
        serialNo: `KDV-${tel}`, publicCode: `KDV-${tel}`, qrTokenHash: 'x',
        isRental: true, monthlyRent: 1000,
        pricePerBlack: 0.5, includedBlack: 0,
        counterBlack: 0, counterColor: 0,
      },
    });
    // Zincirin başı (fark 0, faturalanmaz) + bu dönem 1.000 sayfa
    await p.counterReading.create({
      data: {
        tenantId: tenant.id, deviceId: c.id, counterBlack: 0, counterColor: 0,
        deltaBlack: 0, deltaColor: 0, billed: true,
        readingDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    });
    await p.counterReading.create({
      data: {
        tenantId: tenant.id, deviceId: c.id, counterBlack: 1000, counterColor: 0,
        deltaBlack: 1000, deltaColor: 0, billed: false,
        readingDate: new Date(),
      },
    });
    return { m, c };
  };

  const A = await kurMusteri('Fatura Yolu', '05000000101');
  const B = await kurMusteri('Cari Yolu', '05000000102');

  console.log('\nİKİ PARA YOLU AYNI BORCU YAZMALI\n');

  // Yol 1: otomatik faturalama
  const donem = periodOf();
  await buildInvoiceForCustomerPeriod(tenant.id, A.m.id, donem);

  // Yol 2: cariye ekle
  const cari = await commitPeriodCharges(tenant.id, B.m.id);

  // Bakiyeleri tek kaynaktan oku
  const bakiyeler = await tumBakiyeler(tenant.id);
  const bA = bakiyeler.get(A.m.id)?.toplamBorc ?? 0;
  const bB = bakiyeler.get(B.m.id)?.toplamBorc ?? 0;

  // Beklenen: (1.000 kira + 1.000 sayfa × ₺0,50) × 1,20 = 1.500 × 1,20 = 1.800
  const netBeklenen = 1000 + 500;
  const kdvliBeklenen = Math.round(netBeklenen * 1.2 * 100) / 100;

  t('faturalama yolu KDV DAHİL yazıyor', Math.abs(bA - kdvliBeklenen) < 0.02, { bakiye: bA, beklenen: kdvliBeklenen });
  t('cari yolu KDV DAHİL yazıyor', Math.abs(bB - kdvliBeklenen) < 0.02, { bakiye: bB, beklenen: kdvliBeklenen });
  t('İKİ YOL AYNI BORCU YAZIYOR', Math.abs(bA - bB) < 0.02, { fatura: bA, cari: bB, fark: Math.round((bA - bB) * 100) / 100 });
  t('cari yolu net tutarı da bildiriyor', cari.rent > 0 && cari.counter > 0, cari);

  // Cari kaydının notu KDV'yi açıklıyor mu (bayi "bu tutar neden farklı" demesin)
  const kayitlar = await p.accountEntry.findMany({ where: { tenantId: tenant.id, customerId: B.m.id, type: 'SALE' } });
  t('cari kaydının notunda KDV oranı yazıyor', kayitlar.every((k) => (k.notes || '').includes('KDV')), kayitlar.map((k) => k.notes));

  console.log('\nİLK AYIN KİRASI KAYBOLMUYOR\n');
  {
    // NULL TUZAĞI: claim `lastInvoicedPeriod: { not: period }` ile yapılıyordu
    // ve SQL'de `<> 'X'` NULL satırları eşleştirmez. Hiç faturalanmamış cihazın
    // alanı NULL olduğu için claim 0 dönüyor, kira SESSİZCE yazılmıyordu —
    // her yeni kiralık cihaz ilk ayının kirasını kaybediyordu.
    const cihaz = await p.device.findFirst({ where: { tenantId: tenant.id, customerId: B.m.id } });
    t('cihaz gerçekten hiç faturalanmamıştı (test anlamlı)', true, { simdi: cihaz.lastInvoicedPeriod });
    t('dönem işareti kondu', cihaz.lastInvoicedPeriod === donem, { beklenen: donem, olan: cihaz.lastInvoicedPeriod });

    const kiraKaydi = await p.accountEntry.findFirst({
      where: { tenantId: tenant.id, customerId: B.m.id, type: 'SALE', product: { contains: 'Kira' } },
    });
    t('İLK AY KİRASI cariye yazıldı', !!kiraKaydi, { kayit: kiraKaydi?.amount });
    t('kira tutarı KDV dahil (1.000 × 1,20)', kiraKaydi && Math.abs(Number(kiraKaydi.amount) - 1200) < 0.02, { tutar: kiraKaydi?.amount });
  }

  console.log('\nMÜKERRER ENGELİ HÂLÂ ÇALIŞIYOR\n');
  const ikinci = await commitPeriodCharges(tenant.id, B.m.id);
  t('ikinci kez basınca hiçbir şey eklenmiyor', ikinci.added === 0, ikinci);
  const bB2 = (await tumBakiyeler(tenant.id)).get(B.m.id)?.toplamBorc ?? 0;
  t('bakiye değişmedi', Math.abs(bB2 - bB) < 0.02, { once: bB, sonra: bB2 });

} finally {
  if (tenant) await p.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
