// CİHAZ DEĞİŞİMİ / SAYAÇ SIFIRLAMA testi.
// Çalıştır:  node scripts/test-cihaz-degisimi.mjs
//
// Neden ayrı test: bu para hesabı ve sessiz. Sayaç düşünce bayi "sayaç
// sıfırlandı / cihaz değişti" onayı veriyordu; sistem İKİSİNİ DE aynı sayıyor
// ve okunan değerin TAMAMINI o ayın kullanımı yazıyordu.
//
// Sahadaki gerçek olay: müşterideki makine 620.000'de arızalanır, bayi depodan
// 480.000 sayfa basmış ikinci el makineyi takar. Teknisyen 480.000 okur.
// Eski davranış: delta = 480.000 → ₺0,42'den ₺201.600 YANLIŞ FATURA.
// Doğrusu: yeni makinenin ömür boyu sayacı bu ayın kullanımı DEĞİLDİR.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaClient } from '@prisma/client';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const g = mkdtempSync(join(tmpdir(), 'st-cihaz-'));
let createReading, ReadingError;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/readings.ts'), join(KOK, 'src/lib/prisma.ts'), join(KOK, 'src/lib/invoicing.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip denetimi ayrı koşuyor */ }

const P = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
const duzelt = (dosya, esle) => {
  const y = join(g, dosya); let s = readFileSync(y, 'utf8');
  for (const [a, b] of esle) s = s.split(a).join(b);
  writeFileSync(y, s);
};
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(P)};\nexport const prisma = new PrismaClient();\n`);
duzelt('readings.js', [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@/lib/invoicing'", "'./invoicing.js'"], ["'@prisma/client'", JSON.stringify(P)]]);
duzelt('invoicing.js', [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(P)]]);
({ createReading, ReadingError } = await import(pathToFileURL(join(g, 'readings.js')).href));

const p = new PrismaClient();
const SLUG = 'test-cihaz-degisimi';
let tenant;
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  tenant = await p.tenant.create({
    data: { name: 'Cihaz Değişimi Testi', slug: SLUG, plan: 'professional', pricePerBlack: 0.42, pricePerColor: 1.6 },
  });
  const m = await p.customer.create({ data: { tenantId: tenant.id, name: 'Test', phone: '05000000011' } });

  const cihazYap = async (seri) => p.device.create({
    data: {
      tenantId: tenant.id, customerId: m.id, brand: 'Kyocera', model: 'TASKalfa', serialNo: seri,
      isRental: true, monthlyRent: 1000, includedBlack: 0, includedColor: 0,
      counterBlack: 0, counterColor: 0, publicCode: seri, qrTokenHash: 'x',
    },
  });

  console.log('\nDÜŞEN SAYAÇ — ONAYSIZ\n');
  const c1 = await cihazYap('DEG-1');
  await createReading({ tenantId: tenant.id, deviceId: c1.id, counterBlack: 620000, counterColor: 0 });
  let hata = null;
  try {
    await createReading({ tenantId: tenant.id, deviceId: c1.id, counterBlack: 480000, counterColor: 0 });
  } catch (e) { hata = e; }
  t('onay yoksa düşük sayaç REDDEDİLİR', hata instanceof ReadingError && hata.code === 'COUNTER_DECREASE', hata?.code);

  console.log('\nCİHAZ DEĞİŞTİ (yeni makine takıldı)\n');
  const r1 = await createReading({
    tenantId: tenant.id, deviceId: c1.id, counterBlack: 480000, counterColor: 0,
    reset: true, resetTur: 'CIHAZ_DEGISTI',
  });
  t('delta 0 — ömür boyu sayaç bu ayın kullanımı SAYILMAZ', r1.reading.deltaBlack === 0, { delta: r1.reading.deltaBlack });
  t('ücret ₺0 (eski davranışta ₺201.600 olurdu)', Number(r1.reading.calculatedCost) === 0, { tutar: Number(r1.reading.calculatedCost) });

  // Bundan sonrası doğru sayılmalı: 480.000 → 485.000 = 5.000 sayfa
  const r2 = await createReading({ tenantId: tenant.id, deviceId: c1.id, counterBlack: 485000, counterColor: 0 });
  t('yeni cihazda SONRAKİ okuma doğru sayıyor (5.000 sayfa)', r2.reading.deltaBlack === 5000, { delta: r2.reading.deltaBlack });
  t('ücret 5.000 × ₺0,42 = ₺2.100', Math.abs(Number(r2.reading.calculatedCost) - 2100) < 0.01, { tutar: Number(r2.reading.calculatedCost) });

  console.log('\nSAYAÇ SIFIRLANDI (aynı makine)\n');
  const c2 = await cihazYap('DEG-2');
  await createReading({ tenantId: tenant.id, deviceId: c2.id, counterBlack: 620000, counterColor: 0 });
  const r3 = await createReading({
    tenantId: tenant.id, deviceId: c2.id, counterBlack: 7000, counterColor: 0,
    reset: true, resetTur: 'SAYAC_SIFIRLANDI',
  });
  t('delta = okunan değer (sıfırlamadan sonraki gerçek kullanım)', r3.reading.deltaBlack === 7000, { delta: r3.reading.deltaBlack });
  t('ücret 7.000 × ₺0,42 = ₺2.940', Math.abs(Number(r3.reading.calculatedCost) - 2940) < 0.01, { tutar: Number(r3.reading.calculatedCost) });

  console.log('\nGÜVENLİ VARSAYILAN (tür belirtilmemiş)\n');
  const c3 = await cihazYap('DEG-3');
  await createReading({ tenantId: tenant.id, deviceId: c3.id, counterBlack: 620000, counterColor: 0 });
  const r4 = await createReading({ tenantId: tenant.id, deviceId: c3.id, counterBlack: 480000, counterColor: 0, reset: true });
  t('tür yoksa CIHAZ_DEGISTI varsayılır → delta 0 (fahiş fatura kesilmez)', r4.reading.deltaBlack === 0, { delta: r4.reading.deltaBlack });

  console.log('\nRENKLİ KANAL\n');
  const c4 = await cihazYap('DEG-4');
  await createReading({ tenantId: tenant.id, deviceId: c4.id, counterBlack: 100000, counterColor: 50000 });
  const r5 = await createReading({
    tenantId: tenant.id, deviceId: c4.id, counterBlack: 20000, counterColor: 8000,
    reset: true, resetTur: 'CIHAZ_DEGISTI',
  });
  t('renkli delta da 0 — iki kanal aynı kuralı izliyor', r5.reading.deltaBlack === 0 && r5.reading.deltaColor === 0,
    { siyah: r5.reading.deltaBlack, renkli: r5.reading.deltaColor });

} finally {
  if (tenant) await p.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
  await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
