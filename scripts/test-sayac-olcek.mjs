/**
 * SAYAÇ HATTI — ÖLÇEK TESTİ.
 *
 * Tek e-postada N cihazlık filo raporu işlenirken gerçekte ne oluyor: kaç
 * saniye sürüyor, cihaz başına kaç milisaniye düşüyor, uç zaman aşımına
 * yaklaşıyor mu.
 *
 * NİYE GEREKLİ: "bin makineyi destekliyoruz" cümlesi ancak ölçülmüşse
 * söylenebilir. Uçta maxDuration=120sn var; cihaz başına 120 ms bile olsa
 * 1000 cihaz 120 saniye eder ve rapor YARIDA kesilir — üstelik yarısı
 * işlenmiş, yarısı işlenmemiş olarak. Bu sessiz ve pahalı bir arıza olurdu.
 *
 * VERİ YAZAR, sonunda tamamını geri alır. Yerel olmayan veritabanında çalışmaz.
 *
 * Çalıştırma:  node scripts/test-sayac-olcek.mjs [cihazSayisi]
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ADET = parseInt(process.argv[2] || '200', 10);
const KOK = process.cwd().replace(/\\/g, '/');
process.env.SAYAC_EPOSTA_SECRET = 'test-sir';

function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync('.env', 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.error('DURDURULDU: DATABASE_URL yerel değil. Bu test veri yazar.');
  process.exit(1);
}

const g = mkdtempSync(join(tmpdir(), 'olcek-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/app/api/sayac/eposta/route.ts'), join(KOK, 'src/lib/counter-email.ts'),
    join(KOK, 'src/lib/readings.ts'), join(KOK, 'src/lib/prisma.ts'), join(KOK, 'src/lib/invoicing.ts'),
    join(KOK, 'src/lib/sayac-eposta.ts'),
    join(KOK, 'src/lib/ek-dosya.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck', '--allowJs',
  ], { stdio: 'pipe' });
} catch { /* tip hatası önemsiz */ }

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
  ["'@/lib/ek-dosya'", "'../../../../lib/ek-dosya.js'"],
]);
duzelt('lib/readings.js', [["'@/lib/prisma'", "'../prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(P)], ["'@/lib/invoicing'", "'./invoicing.js'"]]);
duzelt('lib/invoicing.js', [["'@/lib/prisma'", "'../prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(P)]]);

const { POST } = await import(pathToFileURL(join(g, 'app/api/sayac/eposta/route.js')).href);
const { PrismaClient } = await import(P);
const p = new PrismaClient();

console.log(`\nSayaç hattı ölçek testi — ${ADET} cihaz tek e-postada\n`);
const baslangic = new Date();

const bayi = await p.tenant.findFirst({
  where: { sayacEpostaKodu: { not: null }, users: { some: { email: 'demo@nextusservis.com' } } },
  select: { id: true, sayacEpostaKodu: true },
});
const musteri = await p.customer.findFirst({ where: { tenantId: bayi.id }, select: { id: true } });

// ── Test filosu ──────────────────────────────────────────────────────────
process.stdout.write(`  ${ADET} test cihazı oluşturuluyor... `);
const t0 = Date.now();
const seriler = Array.from({ length: ADET }, (_, i) => `OLCEK${String(i).padStart(5, '0')}`);
await p.device.createMany({
  data: seriler.map((s, i) => ({
    tenantId: bayi.id, customerId: musteri.id, brand: 'Test', model: 'Olcek',
    serialNo: s, isRental: true, counterBlack: 100000 + i, counterColor: 0,
    publicCode: 'OLCEK-' + i + '-' + Math.floor(Math.random() * 1e6),
    qrTokenHash: 'olcek-' + i + '-' + Math.floor(Math.random() * 1e9),
  })),
});
console.log(`${((Date.now() - t0) / 1000).toFixed(1)} sn`);

// ── Filo raporu ──────────────────────────────────────────────────────────
const rapor = ['Aylik Filo Sayac Raporu', '', 'Seri No        Siyah',
  ...seriler.map((s, i) => `${s}       ${100000 + i + 500}`)].join('\n');
console.log(`  rapor boyutu: ${(rapor.length / 1024).toFixed(0)} KB`);

const istek = {
  headers: { get: (h) => (h === 'x-sayac-secret' ? 'test-sir' : null) },
  url: 'http://x/api/sayac/eposta',
  json: async () => ({ to: `sayac+${bayi.sayacEpostaKodu}@nextusservis.com`, subject: 'Filo', text: rapor }),
};

process.stdout.write('  işleniyor... ');
const t1 = Date.now();
const cevap = await POST(istek);
const sure = Date.now() - t1;
const v = cevap.__json;
console.log(`${(sure / 1000).toFixed(1)} sn\n`);

const basarili = v.islenen === ADET;
console.log(`  işlenen        : ${v.islenen}/${ADET} ${basarili ? '✓' : '✗'}`);
console.log(`  bekleyen       : ${v.bekleyen}`);
console.log(`  toplam süre    : ${(sure / 1000).toFixed(1)} sn`);
console.log(`  cihaz başına   : ${(sure / ADET).toFixed(0)} ms`);
console.log();
console.log('  ── 120 sn uç sınırına göre kestirim ──');
const cihazBasi = sure / ADET;
console.log(`  1000 cihaz     : ~${(cihazBasi * 1000 / 1000).toFixed(0)} sn  ${cihazBasi * 1000 < 120000 ? '✓ sığar' : '✗ ZAMAN AŞIMI'}`);
console.log(`  sığabilecek en fazla cihaz: ~${Math.floor(120000 / cihazBasi)}`);

// ── Veritabanına yazılan metin ───────────────────────────────────────────
// Her kayda raporun TAMAMINI yazmak, 1000 cihazlı filoda ayda 20 MB eder.
// Bayi kuyrukta zaten o cihazın SATIRINI görmek ister, 20 KB'lık raporu değil.
const kayitlar = await p.counterEmail.findMany({
  where: { tenantId: bayi.id, receivedAt: { gte: baslangic } },
  select: { rawText: true },
});
const toplamMetin = kayitlar.reduce((t, k) => t + k.rawText.length, 0);
const naifBoyut = rapor.length * ADET;
console.log();
console.log('  ── veritabanına yazılan metin ──');
console.log(`  gerçek         : ${(toplamMetin / 1024).toFixed(0)} KB (${kayitlar.length} kayıt)`);
console.log(`  her kayda tüm rapor yazılsaydı: ${(naifBoyut / 1024 / 1024).toFixed(1)} MB`);
console.log(`  tasarruf       : ${(100 - toplamMetin / naifBoyut * 100).toFixed(1)}%  ·  yılda ${((naifBoyut - toplamMetin) * 12 / 1024 / 1024).toFixed(0)} MB (tek müşteri)`);

// ── Kaynak alanı GERÇEKTEN yazılıyor mu ───────────────────────────────────
// Tartışmada kanıt ağırlığını belirleyen alan bu; yazılmıyorsa sessizce ELLE
// (en zayıf seviye) kalır ve cihazdan gelen okuma bayi girişi gibi görünür.
const kaynaklar = await p.counterReading.groupBy({
  by: ['source'], where: { deviceId: { in: (await p.device.findMany({ where: { serialNo: { startsWith: 'OLCEK' } }, select: { id: true } })).map((d) => d.id) } },
  _count: { _all: true },
});
const cihazKaynakli = kaynaklar.find((k) => k.source === 'CIHAZ_EPOSTA')?._count._all ?? 0;
console.log();
console.log(`  kaynak alanı   : ${cihazKaynakli}/${ADET} okuma CIHAZ_EPOSTA ${cihazKaynakli === ADET ? '✓' : '✗ (ELLE kalmış!)'}`);
if (cihazKaynakli !== ADET) process.exitCode = 1;
// ── Temizlik ─────────────────────────────────────────────────────────────
process.stdout.write('\n  temizleniyor... ');
const idler = (await p.device.findMany({ where: { serialNo: { startsWith: 'OLCEK' } }, select: { id: true } })).map((d) => d.id);
await p.counterReading.deleteMany({ where: { deviceId: { in: idler } } });
await p.counterEmail.deleteMany({ where: { tenantId: bayi.id, receivedAt: { gte: baslangic } } });
await p.device.deleteMany({ where: { id: { in: idler } } });
console.log(`${idler.length} cihaz ve kayıtları silindi`);

await p.$disconnect();
rmSync(g, { recursive: true, force: true });
process.exit(basarili ? 0 : 1);
