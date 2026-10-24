// AYLIK FATURA DÖNEMİ testi.
// Çalıştır:  node scripts/test-fatura-donemi.mjs
//
// Neden ayrı test: bu bayinin en pahalı hatasıydı. Cron ayın 1'inde çalışıyor
// ama BUGÜNÜN dönemini faturalıyordu; fatura ise yalnız o dönemin okumalarını
// alıyor. 1 Ekim'de "2026-10" faturalanınca Ekim'de henüz okuma olmadığı için
// EYLÜL'ün bütün sayaç geliri billed:false kalıyor ve bir sonraki ay da kendi
// penceresine bakacağı için BİR DAHA HİÇ faturalanmıyordu.
//
// Burada iki şey doğrulanır:
//   1. Kapanan dönem doğru hesaplanıyor mu (yıl sınırı dahil)
//   2. Faturalama gerçekten o dönemin okumalarını topluyor mu (gerçek DB)
import { rmSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { derle } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

// ── 1) Kapanan dönem hesabı ────────────────────────────────────────────────
// Cron'daki fonksiyonun birebir aynısı; ay çıkarmanın taşma tuzağını kontrol eder.
const kapananDonem = (bugun) => {
  const d = new Date(bugun);
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

console.log('\nKAPANAN DÖNEM HESABI\n');
t('1 Ekim → Eylül faturalanır', kapananDonem('2026-10-01T06:00:00') === '2026-09', kapananDonem('2026-10-01T06:00:00'));
t('1 Ocak → ÖNCEKİ YILIN Aralık ayı', kapananDonem('2026-01-01T06:00:00') === '2025-12', kapananDonem('2026-01-01T06:00:00'));
t('1 Mart → Şubat (kısa ay taşması yok)', kapananDonem('2026-03-01T06:00:00') === '2026-02', kapananDonem('2026-03-01T06:00:00'));
t('31 Mayıs → Nisan (ayın sonunda da doğru)', kapananDonem('2026-05-31T23:00:00') === '2026-04', kapananDonem('2026-05-31T23:00:00'));
t('1 Ekim BUGÜNÜN dönemini vermiyor', kapananDonem('2026-10-01T06:00:00') !== '2026-10');

// ── 2) Faturalama gerçekten o dönemin okumasını topluyor mu ────────────────
const { dizin: g, ice } = derle({ girisler: ['src/lib/invoicing.ts'], onEk: 'st-donem-' });
const { buildInvoiceForCustomerPeriod } = await ice('lib/invoicing');

const p = new PrismaClient();
const SLUG = 'test-donem-gecici';
let tenant;
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  tenant = await p.tenant.create({
    data: { name: 'Dönem Testi', slug: SLUG, plan: 'professional', pricePerBlack: 1, pricePerColor: 2 },
  });
  const m = await p.customer.create({ data: { tenantId: tenant.id, name: 'Test Müşteri', phone: '05000000009' } });
  const c = await p.device.create({
    data: {
      tenantId: tenant.id, customerId: m.id, brand: 'Test', model: 'X', serialNo: 'DONEM-TEST-1',
      isRental: true, monthlyRent: 1000, includedBlack: 0, includedColor: 0,
      counterBlack: 0, counterColor: 0, publicCode: 'DONEM-1', qrTokenHash: 'x',
    },
  });

  // EYLÜL'de okuma: 5.000 siyah sayfa (₺1/sayfa → ₺5.000 aşım)
  await p.counterReading.create({
    data: {
      tenantId: tenant.id, deviceId: c.id, counterBlack: 5000, counterColor: 0,
      deltaBlack: 5000, deltaColor: 0, readingDate: new Date('2026-09-15T10:00:00'), billed: false,
    },
  });

  console.log('\nFATURALAMA — DÖNEM PENCERESİ (gerçek veritabanı)\n');

  // YANLIŞ dönem (eski davranış): Ekim faturalanırsa Eylül okuması DIŞARIDA kalır
  // Satırlar veritabanından okunur: fonksiyon fatura kaydını döndürüyor,
  // ilişkileri içermiyor. Böylece gerçekten NE YAZILDIĞI ölçülmüş oluyor.
  const satirlariAl = async (fatura) =>
    fatura ? await p.invoiceLine.findMany({ where: { invoiceId: fatura.id } }) : [];

  const ekim = await buildInvoiceForCustomerPeriod(tenant.id, m.id, '2026-10');
  const ekimSayacSatiri = (await satirlariAl(ekim)).filter((x) => x.kind === 'COUNTER').length;
  t('ESKİ davranış kanıtı: Ekim faturasında Eylül sayacı YOK', ekimSayacSatiri === 0, { ekimSayacSatiri });

  // Eylül faturası kesilince okuma billed=true olmuş olabilir; temiz ölçüm için sıfırla
  await p.counterReading.updateMany({ where: { tenantId: tenant.id }, data: { billed: false } });
  await p.customerInvoice.deleteMany({ where: { tenantId: tenant.id } });

  // DOĞRU dönem: Eylül faturalanınca sayaç satırı ÇIKMALI
  const eylul = await buildInvoiceForCustomerPeriod(tenant.id, m.id, '2026-09');
  const sayacSatirlari = (await satirlariAl(eylul)).filter((x) => x.kind === 'COUNTER');
  const sayacTutari = sayacSatirlari.reduce((s, x) => s + Number(x.lineTotal), 0);
  t('DOĞRU dönem: Eylül faturasında sayaç satırı VAR', sayacSatirlari.length > 0, { adet: sayacSatirlari.length });
  t('Sayaç tutarı 5.000 sayfa × ₺1 = ₺5.000', Math.abs(sayacTutari - 5000) < 0.01, { sayacTutari });

  // Okuma faturalandı mı — bir daha faturalanmamalı
  const kalan = await p.counterReading.count({ where: { tenantId: tenant.id, billed: false } });
  t('Faturalanan okuma billed=true oldu (mükerrer faturalanmaz)', kalan === 0, { faturalanmamisKalan: kalan });

} finally {
  if (tenant) await p.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
  await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
