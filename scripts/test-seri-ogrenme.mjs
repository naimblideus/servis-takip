/**
 * SERİ ÖĞRENME — yanlış girilmiş seri bir kez düzeltilince kalıcı olmalı.
 *
 * SENARYO: teknisyen cihazı eklerken seriyi bir harf yanlış girdi (LSA44O4O71,
 * O yerine sıfır). Cihaz her ay doğru seriyle (LSA4404071) rapor gönderiyor.
 * Eşleşme olmadığı için rapor kuyruğa düşüyor.
 *
 * Bayi kuyrukta bir kez elle eşleştirdiğinde sistem bunu ÖĞRENMELİ; sonraki
 * ay aynı rapor otomatik işlenmeli. Öğrenmezse bayi aynı cihazı her ay elle
 * işler — kiralık filoda otomasyonun hiç olmaması demek.
 *
 * VERİ YAZAR, sonunda geri alır. Yerel olmayan veritabanında çalışmaz.
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = process.cwd().replace(/\\/g, '/');
process.env.SAYAC_EPOSTA_SECRET = 'test-sir';

function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const satir = readFileSync('.env', 'utf8').split(/\r?\n/).find((s) => /^\s*DATABASE_URL\s*=/.test(s));
    return satir ? satir.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.error('DURDURULDU: DATABASE_URL yerel değil. Bu test veri yazar.');
  process.exit(1);
}

const g = mkdtempSync(join(tmpdir(), 'ogren-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/app/api/sayac/eposta/route.ts'),
    join(KOK, 'src/lib/counter-email.ts'), join(KOK, 'src/lib/readings.ts'),
    join(KOK, 'src/lib/prisma.ts'), join(KOK, 'src/lib/invoicing.ts'),
    join(KOK, 'src/lib/sayac-eposta.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck', '--allowJs',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz */ }

const P = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
const duzelt = (dosya, esle) => {
  const y = join(g, dosya); let s = readFileSync(y, 'utf8');
  for (const [a, b] of esle) s = s.split(a).join(b);
  writeFileSync(y, s);
};
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(P)};\nexport const prisma = new PrismaClient();\n`);
writeFileSync(join(g, 'next-server-shim.js'), 'export const NextResponse = { json: (v, i) => ({ __json: v, status: i?.status ?? 200 }) };\n');
duzelt('app/api/sayac/eposta/route.js', [
  ["'@/lib/prisma'", "'../../../../prisma-shim.js'"], ["'@/lib/counter-email'", "'../../../../lib/counter-email.js'"],
  ["'@/lib/readings'", "'../../../../lib/readings.js'"], ["'next/server'", "'../../../../next-server-shim.js'"],
  ["'@/lib/sayac-eposta'", "'../../../../lib/sayac-eposta.js'"],
]);
duzelt('lib/readings.js', [["'@/lib/prisma'", "'../prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(P)], ["'@/lib/invoicing'", "'./invoicing.js'"]]);
duzelt('lib/invoicing.js', [["'@/lib/prisma'", "'../prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(P)]]);

const { POST } = await import(pathToFileURL(join(g, 'app/api/sayac/eposta/route.js')).href);
const { PrismaClient } = await import(P);
const p = new PrismaClient();

const istek = (govde) => ({
  headers: { get: (h) => (h === 'x-sayac-secret' ? 'test-sir' : null) },
  url: 'http://x/api/sayac/eposta', json: async () => govde,
});
let gecti = 0, kaldi = 0;
const t = (ad, ok, ek = '') => { if (ok) { console.log(`  ✓ ${ad}`); gecti++; } else { console.log(`  ✗ ${ad}${ek ? '\n      ' + ek : ''}`); kaldi++; } };

console.log('\nSeri öğrenme — yanlış girilmiş seri bir kez düzeltilir\n');
const baslangic = new Date();

const bayi = await p.tenant.findFirst({
  where: { sayacEpostaKodu: { not: null }, users: { some: { email: 'demo@nextusservis.com' } } },
  select: { id: true, sayacEpostaKodu: true },
});
const musteri = await p.customer.findFirst({ where: { tenantId: bayi.id }, select: { id: true } });

// Etikette LSA4404071 yazıyor ama sisteme LSA44O4O71 girilmiş (0 yerine O).
const YANLIS = 'LSA44O4O71';
const DOGRU = 'LSA4404071';
const cihaz = await p.device.create({
  data: {
    tenantId: bayi.id, customerId: musteri.id, brand: 'Kyocera', model: 'ECOSYS M3540dn',
    serialNo: YANLIS, isRental: true, counterBlack: 600000, counterColor: 0,
    publicCode: 'TEST-' + Math.floor(Math.random() * 1e9),
    qrTokenHash: 'test-' + Math.floor(Math.random() * 1e12),
  },
  select: { id: true },
});
const adres = `sayac+${bayi.sayacEpostaKodu}@nextusservis.com`;
const rapor = (siyah) => ['Seri No        Siyah', `${DOGRU}       ${siyah}`].join('\n');

// 1) İlk rapor: eşleşmemeli
let r = await POST(istek({ to: adres, subject: 'Sayac', text: rapor(616381) }));
t('yanlış seri → eşleşmiyor, kuyruğa düşüyor', r.__json.islenen === 0, JSON.stringify(r.__json).slice(0, 160));

// 2) Bayi elle eşleştiriyor: uçtaki öğrenme mantığının aynısı
const kuyruk = await p.counterEmail.findFirst({
  where: { tenantId: bayi.id, receivedAt: { gte: baslangic } }, orderBy: { receivedAt: 'desc' },
});
if (kuyruk?.serial && kuyruk.serial !== YANLIS) {
  await p.device.update({ where: { id: cihaz.id }, data: { reportedSerial: kuyruk.serial } });
}
const sonra = await p.device.findUnique({ where: { id: cihaz.id }, select: { serialNo: true, reportedSerial: true } });
t('elle eşleştirince bildirilen seri ÖĞRENİLDİ', sonra.reportedSerial === DOGRU, `öğrenilen: ${sonra.reportedSerial}`);
t('etiketteki seri DEĞİŞMEDİ (saha okuyacak)', sonra.serialNo === YANLIS, `serialNo: ${sonra.serialNo}`);

// 3) Sonraki ayın raporu: artık otomatik işlenmeli
r = await POST(istek({ to: adres, subject: 'Sayac', text: rapor(617024) }));
t('sonraki ay OTOMATİK işleniyor', r.__json.islenen === 1, JSON.stringify(r.__json.sonuclar));

const okuma = await p.counterReading.findFirst({
  where: { deviceId: cihaz.id }, orderBy: { readingDate: 'desc' }, select: { counterBlack: true },
});
t('sayaç doğru cihaza yazıldı', okuma?.counterBlack === 617024, `yazılan: ${okuma?.counterBlack}`);

// Temizlik
await p.counterReading.deleteMany({ where: { deviceId: cihaz.id } });
await p.counterEmail.deleteMany({ where: { tenantId: bayi.id, receivedAt: { gte: baslangic } } });
await p.device.delete({ where: { id: cihaz.id } });
console.log('\n  (test cihazı ve kayıtları silindi)');

await p.$disconnect();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
