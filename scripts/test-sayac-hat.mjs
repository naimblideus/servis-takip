/**
 * Sayaç e-postası hattı — UÇTAN UCA test (gerçek veritabanı).
 *
 * scripts/test-counter-email-coklu.mjs metin AYRIŞTIRMAYI test eder (saf, DB'siz).
 * Bu dosya HATTIN TAMAMINI test eder: adres → bayi → cihaz → okuma → cihaz sayacı.
 * Uç mantığı burada TEKRAR YAZILMAZ; gerçek route dosyası tsc ile derlenip
 * POST fonksiyonu çağrılır. Test edilen şey üretimde çalışan koddur.
 *
 * Çalıştırma:  node scripts/test-sayac-hat.mjs
 * Gerektirir:  yerel veritabanı + demo verisi (npm run seed)
 *
 * VERİ YAZAR. Yazdığı her şeyi sonunda geri alır ama yine de ÜRETİMDE
 * ÇALIŞTIRILMAZ — aşağıdaki kapı yerel olmayan veritabanında durdurur.
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = process.cwd().replace(/\\/g, '/');
process.env.SAYAC_EPOSTA_SECRET = 'test-sir';

// ── Üretim kapısı: bu test veri yazar, uzak veritabanında ASLA çalışmaz ──
// Prisma Client .env'i kendi okur; kapı da AYNI kaynağa bakmalı, yoksa kapı
// "tanımsız" görüp durdururken Prisma üretime bağlanıyor olabilir.
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const satir = readFileSync('.env', 'utf8').split(/\r?\n/)
      .find((s) => /^\s*DATABASE_URL\s*=/.test(s));
    return satir ? satir.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const db = veritabaniUrl();
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(db)) {
  console.error('DURDURULDU: DATABASE_URL yerel değil. Bu test veri yazar.');
  console.error('  DATABASE_URL =', db.replace(/:[^:@]*@/, ':***@') || '(tanımsız)');
  process.exit(1);
}


const g = mkdtempSync(join(tmpdir(), 'st-hat-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/app/api/sayac/eposta/route.ts'),
    join(KOK, 'src/lib/counter-email.ts'),
    join(KOK, 'src/lib/readings.ts'),
    join(KOK, 'src/lib/prisma.ts'),
    join(KOK, 'src/lib/invoicing.ts'),
    join(KOK, 'src/lib/sayac-eposta.ts'),
    join(KOK, 'src/lib/ek-dosya.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck', '--allowJs',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemli değil, JS üretildi */ }

const P = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
const duzelt = (dosya, esle) => {
  const y = join(g, dosya);
  let s = readFileSync(y, 'utf8');
  for (const [a, b] of esle) s = s.split(a).join(b);
  writeFileSync(y, s);
};
writeFileSync(join(g, 'prisma-shim.js'),
  `import { PrismaClient } from ${JSON.stringify(P)};\nexport const prisma = new PrismaClient();\n`);
writeFileSync(join(g, 'next-server-shim.js'),
  'export const NextResponse = { json: (veri, init) => ({ __json: veri, status: init?.status ?? 200 }) };\n');
duzelt('app/api/sayac/eposta/route.js', [
  ["'@/lib/prisma'", "'../../../../prisma-shim.js'"],
  ["'@/lib/counter-email'", "'../../../../lib/counter-email.js'"],
  ["'@/lib/readings'", "'../../../../lib/readings.js'"],
  ["'next/server'", "'../../../../next-server-shim.js'"],
  ["'@/lib/sayac-eposta'", "'../../../../lib/sayac-eposta.js'"],
  ["'@/lib/ek-dosya'", "'../../../../lib/ek-dosya.js'"],
]);
duzelt('lib/readings.js', [["'@/lib/prisma'", "'../prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(P)], ["'@/lib/invoicing'", "'./invoicing.js'"]]);
duzelt('lib/invoicing.js', [["'@/lib/prisma'", "'../prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(P)]]);

const { POST } = await import(pathToFileURL(join(g, 'app/api/sayac/eposta/route.js')).href);
const { PrismaClient } = await import(P);
const p = new PrismaClient();

const istek = (govde, sir = 'test-sir') => ({
  headers: { get: (h) => (h === 'x-sayac-secret' ? sir : null) },
  url: 'http://x/api/sayac/eposta',
  json: async () => govde,
});

let gecti = 0, kaldi = 0;
const t = (ad, kosul, ek = '') => {
  if (kosul) { console.log(`  \u2713 ${ad}`); gecti++; }
  else { console.log(`  \u2717 ${ad}${ek ? '\n      ' + ek : ''}`); kaldi++; }
};
const sonOkuma = (id) => p.counterReading.findFirst({
  where: { deviceId: id }, orderBy: { readingDate: 'desc' },
  select: { counterBlack: true, counterColor: true, deltaBlack: true, deltaColor: true },
});

console.log('\nSayac e-postasi hatti — uctan uca\n');
const baslangic = new Date();

const bayi = await p.tenant.findFirst({
  where: { sayacEpostaKodu: { not: null }, users: { some: { email: 'demo@nextusservis.com' } } },
  select: { id: true, name: true, sayacEpostaKodu: true },
});
const cihazlar = await p.device.findMany({
  where: { tenantId: bayi.id, isRental: true }, take: 3,
  select: { id: true, serialNo: true, counterBlack: true, counterColor: true },
  orderBy: { serialNo: 'asc' },
});
const adres = `sayac+${bayi.sayacEpostaKodu}@nextusservis.com`;
console.log(`bayi: ${bayi.name} · kod: ${bayi.sayacEpostaKodu} · ${cihazlar.length} cihaz`);
console.log(`renkli sayaclar: ${cihazlar.map((c) => `${c.serialNo}=${c.counterColor}`).join(', ')}\n`);

// 1) Sır kontrolü
let r = await POST(istek({ text: 'x' }, 'yanlis'));
t('yanlis sir reddedilir (401)', r.status === 401, `gelen ${r.status}`);

// 2) SADECE SİYAH sütunlu filo raporu — sahadaki en sık hâl.
//    Renkli sayacı olan cihazda 0 yazılırsa hepsi reddedilirdi.
const A = cihazlar.map((c, i) => ({ ...c, yeni: (c.counterBlack ?? 0) + 1000 * (i + 1) }));
r = await POST(istek({
  to: adres, from: 'filo@musteri.com', subject: 'Aylik Sayac Raporu',
  text: ['Aylik Filo Sayac Raporu', '', 'Seri No        Model        Siyah',
    ...A.map((c) => `${c.serialNo}       Cihaz        ${c.yeni}`)].join('\n'),
}));
let v = r.__json;
console.log(`  → yerlesim: ${v.yerlesim} · bayi: ${v.bayi} · cihaz: ${v.cihazSayisi} · islenen: ${v.islenen} · bekleyen: ${v.bekleyen}`);
t('bayi ADRESTEN belirlendi', v.bayi === 'kodla belirlendi', v.bayi);
t('tablo yerlesimi tanindi', v.yerlesim === 'tablo', v.yerlesim);
t(`sadece-siyah rapor: ${cihazlar.length} cihazin hepsi islendi`,
  v.islenen === cihazlar.length, JSON.stringify(v.sonuclar));

let dogru = true, renkKorundu = true, detay = [];
for (const c of A) {
  const s = await sonOkuma(c.id);
  detay.push(`${c.serialNo}: siyah ${c.yeni}→${s?.counterBlack}, renkli ${c.counterColor}→${s?.counterColor}`);
  if (s?.counterBlack !== c.yeni) dogru = false;
  if (s?.counterColor !== c.counterColor || s?.deltaColor !== 0) renkKorundu = false;
}
t('her sayac KENDI cihazina yazildi', dogru, detay.join(' | '));
t('renkli sayac TASINDI (artis 0, ucret uretilmedi)', renkKorundu, detay.join(' | '));

// 3) Siyah + renkli birlikte
const B = A.map((c, i) => ({ ...c, siyah: c.yeni + 500, renkli: (c.counterColor ?? 0) + 100 * (i + 1) }));
r = await POST(istek({
  to: adres, subject: 'Sayac',
  text: ['Seri No        Siyah        Renkli',
    ...B.map((c) => `${c.serialNo}       ${c.siyah}        ${c.renkli}`)].join('\n'),
}));
let ikiSutun = r.__json.islenen === cihazlar.length;
for (const c of B) {
  const s = await sonOkuma(c.id);
  if (s?.counterBlack !== c.siyah || s?.counterColor !== c.renkli) ikiSutun = false;
}
t('siyah+renkli rapor: iki sutun da dogru cihaza yazildi', ikiSutun, JSON.stringify(r.__json.sonuclar));

// 3b) Gmail köprüsünün gönderdiği biçim: Apps Script getTo() adresi
//     "İsim" <adres> olarak döndürebiliyor. Kod yine okunmalı.
const C = B.map((c) => ({ ...c, siyah2: c.siyah + 300 }));
r = await POST(istek({
  to: `"Nextus Servis" <nextusservis+${bayi.sayacEpostaKodu}@gmail.com>`,
  subject: 'Sayac',
  text: ['Seri No        Siyah', ...C.map((c) => `${c.serialNo}       ${c.siyah2}`)].join('\n'),
}));
t('Gmail bicimi "Isim" <adres> okunur', r.__json.bayi === 'kodla belirlendi' && r.__json.islenen === cihazlar.length,
  `bayi=${r.__json.bayi} islenen=${r.__json.islenen}`);

// 4) Sayaç düşüşü → kuyruğa
r = await POST(istek({ to: adres, subject: 'Sayac', text: `Seri No   Siyah\n${cihazlar[0].serialNo}   100` }));
t('dusuk sayac islenmez, kuyruga duser', r.__json.islenen === 0 && r.__json.bekleyen === 1,
  JSON.stringify(r.__json.sonuclar));

// 5) Bir cihaz bozuk, diğerleri işlenmeye devam eder
r = await POST(istek({
  to: adres, subject: 'Sayac',
  text: ['Seri No        Siyah',
    `${C[0].serialNo}       100`,
    `${C[1].serialNo}       ${C[1].siyah2 + 700}`,
    `${C[2].serialNo}       ${C[2].siyah2 + 700}`].join('\n'),
}));
t('bir satirin hatasi diger cihazlari DURDURMAZ', r.__json.islenen === 2 && r.__json.bekleyen === 1,
  JSON.stringify(r.__json.sonuclar));

// 6) Yanlış kod
r = await POST(istek({ to: 'sayac+yanliskod@nextusservis.com', subject: 's', text: 'Toplam: 5' }));
t('taninmayan kod kuyruga duser', r.__json.bekleyen === 1 && /kod/i.test(r.__json.sebep ?? ''), r.__json.sebep);

// 7) ÇOK CİHAZLI rapor, hiçbir seri sistemde YOK.
// Eskiden bütün metne TEK-cihaz okuyucusu uygulanıp ilk serinin yanına
// (muhtemelen başka cihazın) sayacı yazılıyordu; bayi kuyrukta "eşleştir"
// dediğinde YANLIŞ sayaç kaydediliyordu. Artık sayaç doldurulmaz.
r = await POST(istek({
  to: adres, subject: 'Counter Report',
  text: [
    'Serial Number: BILINMEYEN-AAA1',
    'Black: 145230',
    'Color: 22410',
    'Serial Number: BILINMEYEN-BBB2',
    'Black: 998450',
    'Color: 1200',
  ].join('\n'),
}));
t('cok cihazli + seri yok: kuyruga duser', r.__json.bekleyen === 1, JSON.stringify(r.__json).slice(0, 200));
t('cok cihazli + seri yok: SAYAC DOLDURULMAZ (yanlis eslesme onlenir)',
  /ayrılamadığı|DOLDURULMADI/i.test(r.__json.sebep ?? ''), r.__json.sebep);
t('kac cihaz oldugu bayiye soylenir', /2 cihaz/.test(r.__json.sebep ?? ''), r.__json.sebep);

// ── Temizlik: testin yazdığı her şeyi geri al ──
const eposta = await p.counterEmail.deleteMany({ where: { tenantId: bayi.id, receivedAt: { gte: baslangic } } });
const okuma = await p.counterReading.deleteMany({
  where: { deviceId: { in: cihazlar.map((c) => c.id) }, readingDate: { gte: baslangic } },
});
for (const c of cihazlar) {
  await p.device.update({ where: { id: c.id }, data: { counterBlack: c.counterBlack, counterColor: c.counterColor } });
}
console.log(`\n  (temizlik: ${eposta.count} e-posta kaydi, ${okuma.count} okuma silindi; cihaz sayaclari geri alindi)`);

await p.$disconnect();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} gecti, ${kaldi} kaldi\n`);
process.exit(kaldi ? 1 : 0);
