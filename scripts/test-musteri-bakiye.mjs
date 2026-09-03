// BİRLEŞİK MÜŞTERİ BAKİYESİ testi.
// Çalıştır:  node scripts/test-musteri-bakiye.mjs
//
// Neden ayrı test: bu para hesabı. Borç iki ayrı tabloda birikiyor
// (servis = AccountEntry, kira/sayaç = CustomerInvoice) ve ekranlar artık
// ikisinin TOPLAMINI gösteriyor. Yanlış toplarsak bayi yanlış tutar takip
// eder ya da müşteriye yanlış ekstre verir.
//
// Gerçek veritabanına geçici bir bayi açıp siler; başka veriye dokunmaz.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaClient } from '@prisma/client';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-bakiye-'));
let tumBakiyeler, bakiye, ekstre;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/musteri-bakiye.ts'), join(KOK, 'src/lib/prisma.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

const P = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
const fs = await import('node:fs');
const duzelt = (dosya, esle) => {
  const y = join(g, dosya); let s = fs.readFileSync(y, 'utf8');
  for (const [a, b] of esle) s = s.split(a).join(b);
  fs.writeFileSync(y, s);
};
fs.writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(P)};\nexport const prisma = new PrismaClient();\n`);
duzelt('musteri-bakiye.js', [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(P)]]);
({ tumBakiyeler, bakiye, ekstre } = await import(pathToFileURL(join(g, 'musteri-bakiye.js')).href));

const p = new PrismaClient();
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const SLUG = 'test-bakiye-gecici';
let tenant;
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  tenant = await p.tenant.create({ data: { name: 'Bakiye Testi', slug: SLUG, plan: 'professional' } });
  const m = await p.customer.create({ data: { tenantId: tenant.id, name: 'Test Müşteri', phone: '05000000001' } });
  const bos = await p.customer.create({ data: { tenantId: tenant.id, name: 'Borçsuz', phone: '05000000002' } });

  console.log('\nBİRLEŞİK BAKİYE\n');

  // Servis: 1000 borç, 400 ödeme → 600
  await p.accountEntry.create({ data: { tenantId: tenant.id, customerId: m.id, type: 'SALE', amount: 1000, product: 'Servis A', date: new Date('2026-01-10') } });
  await p.accountEntry.create({ data: { tenantId: tenant.id, customerId: m.id, type: 'PAYMENT', amount: 400, date: new Date('2026-01-20') } });

  let b = await bakiye(tenant.id, m.id);
  t('yalnız servis: 1000 borç − 400 ödeme = 600', b.servisBorc === 600 && b.toplamBorc === 600, b);

  // Fatura: 2000 toplam, 500 ödenmiş, OPEN → 1500 açık
  await p.customerInvoice.create({ data: {
    tenantId: tenant.id, customerId: m.id, invoiceNumber: 'T-001', period: '2026-02',
    dueDate: new Date('2026-03-01'), status: 'PARTIAL', totalAmount: 2000, paidAmount: 500,
    invoiceDate: new Date('2026-02-01'),
  } });

  b = await bakiye(tenant.id, m.id);
  t('servis 600 + fatura 1500 = 2100 birleşik', b.toplamBorc === 2100 && b.faturaBorc === 1500, b);

  // ÖDENMİŞ fatura borca EKLENMEMELİ
  await p.customerInvoice.create({ data: {
    tenantId: tenant.id, customerId: m.id, invoiceNumber: 'T-002', period: '2026-03',
    dueDate: new Date('2026-04-01'), status: 'PAID', totalAmount: 5000, paidAmount: 5000,
    invoiceDate: new Date('2026-03-01'),
  } });
  b = await bakiye(tenant.id, m.id);
  t('ÖDENMİŞ fatura borca eklenmez', b.toplamBorc === 2100, b);

  // İPTAL fatura borca EKLENMEMELİ
  await p.customerInvoice.create({ data: {
    tenantId: tenant.id, customerId: m.id, invoiceNumber: 'T-003', period: '2026-04',
    dueDate: new Date('2026-05-01'), status: 'CANCELLED', totalAmount: 9000, paidAmount: 0,
    invoiceDate: new Date('2026-04-01'),
  } });
  b = await bakiye(tenant.id, m.id);
  t('İPTAL fatura borca eklenmez', b.toplamBorc === 2100, b);

  // TASLAK fatura borca EKLENMEMELİ (henüz kesilmedi)
  await p.customerInvoice.create({ data: {
    tenantId: tenant.id, customerId: m.id, invoiceNumber: 'T-004', period: '2026-05',
    dueDate: new Date('2026-06-01'), status: 'DRAFT', totalAmount: 7000, paidAmount: 0,
    invoiceDate: new Date('2026-05-01'),
  } });
  b = await bakiye(tenant.id, m.id);
  t('TASLAK fatura borca eklenmez', b.toplamBorc === 2100, b);

  // Vadesi geçmiş fatura SAYILIR
  await p.customerInvoice.create({ data: {
    tenantId: tenant.id, customerId: m.id, invoiceNumber: 'T-005', period: '2026-06',
    dueDate: new Date('2026-07-01'), status: 'OVERDUE', totalAmount: 300, paidAmount: 0,
    invoiceDate: new Date('2026-06-01'),
  } });
  b = await bakiye(tenant.id, m.id);
  t('VADESİ GEÇMİŞ fatura borca eklenir (2100+300)', b.toplamBorc === 2400, b);

  // Borçsuz müşteri
  const b2 = await bakiye(tenant.id, bos.id);
  t('borçsuz müşteri 0 döner', b2.toplamBorc === 0, b2);

  // Fazla ödeme → negatif bakiye (kredi)
  await p.accountEntry.create({ data: { tenantId: tenant.id, customerId: bos.id, type: 'PAYMENT', amount: 250, date: new Date('2026-01-05') } });
  const b3 = await bakiye(tenant.id, bos.id);
  t('fazla ödeme negatif bakiye (kredi) verir', b3.toplamBorc === -250, b3);

  // Tüm bakiyeler haritası
  const hepsi = await tumBakiyeler(tenant.id);
  t('tumBakiyeler iki müşteriyi de kapsar', hepsi.size === 2, [...hepsi.values()]);

  console.log('\nEKSTRE\n');
  const satirlar = await ekstre(tenant.id, m.id);
  const servisSayisi = satirlar.filter((s) => s.kaynak === 'SERVIS').length;
  const faturaSayisi = satirlar.filter((s) => s.kaynak === 'FATURA').length;
  t('ekstre servis kalemlerini içerir (2 satır)', servisSayisi === 2, servisSayisi);
  t('ekstre İPTAL faturayı DIŞLAR', !satirlar.some((s) => s.detay === 'T-003'), satirlar.map((s) => s.detay));
  t('ekstre ödenmiş faturayı borç+ödeme olarak gösterir', faturaSayisi >= 4, faturaSayisi);

  const tarihler = satirlar.map((s) => s.tarih);
  t('ekstre yeniden eskiye sıralı', tarihler.every((x, i) => i === 0 || tarihler[i - 1] >= x), tarihler);

  // Ekstredeki borç−ödeme, bakiyeyle tutmalı (ÖDENMİŞ fatura dahil edildiği
  // için ekstre toplamı = açık borç; en kritik tutarlılık kontrolü)
  const net = satirlar.reduce((s, x) => s + (x.tip === 'BORC' ? x.tutar : -x.tutar), 0);
  t('ekstre net toplamı = birleşik bakiye', Math.abs(net - 2400) < 0.01, { net, beklenen: 2400 });

} finally {
  if (tenant) await p.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
  await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
