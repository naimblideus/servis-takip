// BAKİYE ÖLÇEK ÖLÇÜMÜ — tahmin değil, sayı.
//
// Soru: tek bir müşterinin bakiyesini almak, bayi büyüdükçe yavaşlıyor mu?
// Müşteri detayı her açılışta bu yolu kullanıyor.
//
// Çalıştır: node scripts/olcum-bakiye.mjs
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaClient } from '@prisma/client';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-olcum-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/musteri-bakiye.ts'), join(KOK, 'src/lib/prisma.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları ayrı koşuyor */ }
const P = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(P)};\nexport const prisma = new PrismaClient();\n`);
{
  const y = join(g, 'musteri-bakiye.js');
  let s = readFileSync(y, 'utf8');
  s = s.split("'@/lib/prisma'").join("'./prisma-shim.js'").split("'@prisma/client'").join(JSON.stringify(P));
  writeFileSync(y, s);
}
const { bakiye, tumBakiyeler, ekstre } = await import(pathToFileURL(join(g, 'musteri-bakiye.js')).href);

const p = new PrismaClient();
const SLUG = 'olcum-bakiye-gecici';
const MUSTERI = 300;
const FATURA_BASINA = 6;

let tenant;
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  console.log(`\nKuruluyor: ${MUSTERI} müşteri, her birine ${FATURA_BASINA} fatura + 4 hesap kaydı…`);
  tenant = await p.tenant.create({ data: { name: 'Ölçüm', slug: SLUG, plan: 'professional' } });

  const musteriler = [];
  for (let i = 0; i < MUSTERI; i++) {
    musteriler.push({ tenantId: tenant.id, name: `Müşteri ${i}`, phone: `0500000${String(i).padStart(4, '0')}` });
  }
  await p.customer.createMany({ data: musteriler });
  const kayitli = await p.customer.findMany({ where: { tenantId: tenant.id }, select: { id: true } });

  const girisler = [], faturalar = [];
  for (const [ix, c] of kayitli.entries()) {
    for (let k = 0; k < 2; k++) {
      girisler.push({ tenantId: tenant.id, customerId: c.id, type: 'SALE', amount: 500, product: `İş ${k}`, date: new Date(2026, k, 5) });
      girisler.push({ tenantId: tenant.id, customerId: c.id, type: 'PAYMENT', amount: 200, date: new Date(2026, k, 20) });
    }
    for (let k = 0; k < FATURA_BASINA; k++) {
      faturalar.push({
        tenantId: tenant.id, customerId: c.id, invoiceNumber: `O-${ix}-${k}`, period: `2026-0${(k % 9) + 1}`,
        dueDate: new Date(2026, k, 28), invoiceDate: new Date(2026, k, 1),
        status: k % 3 === 0 ? 'PAID' : 'OPEN', totalAmount: 1000, paidAmount: k % 3 === 0 ? 1000 : 0,
      });
    }
  }
  await p.accountEntry.createMany({ data: girisler });
  await p.customerInvoice.createMany({ data: faturalar });
  console.log(`  ${girisler.length} hesap kaydı, ${faturalar.length} fatura yazıldı\n`);

  const hedef = kayitli[0].id;
  const olc = async (ad, fn, tekrar = 5) => {
    await fn(); // ısınma
    const t0 = performance.now();
    for (let i = 0; i < tekrar; i++) await fn();
    const ms = (performance.now() - t0) / tekrar;
    console.log(`  ${ad.padEnd(42)} ${ms.toFixed(1).padStart(7)} ms`);
    return ms;
  };

  console.log('ÖLÇÜM (5 koşunun ortalaması)\n');
  const tekMs = await olc('bakiye() — TEK müşteri', () => bakiye(tenant.id, hedef));
  const tumMs = await olc('tumBakiyeler() — 300 müşteri', () => tumBakiyeler(tenant.id));
  const ekstreMs = await olc('ekstre() — TEK müşteri', () => ekstre(tenant.id, hedef));

  console.log('\nDEĞERLENDİRME');
  const oran = tekMs / ekstreMs;
  console.log(`  Tek müşterinin bakiyesi, tek müşterinin ekstresinden ${oran.toFixed(1)}× yavaş.`);
  if (tekMs > tumMs * 0.8) {
    console.log('  ⛔ bakiye() pratikte tumBakiyeler() kadar iş yapıyor —');
    console.log('     tek müşteri için BÜTÜN bayi taranıyor.');
  } else {
    console.log('  ✓ bakiye() tek müşteriye göre ölçekleniyor.');
  }
} finally {
  if (tenant) await p.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
  await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
  console.log('\n(geçici bayi silindi)');
}
