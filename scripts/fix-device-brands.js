/**
 * Tek seferlik düzeltme: marka/model ters kaydedilmiş cihazları düzeltir.
 *
 * Kullanım:
 *   node scripts/fix-device-brands.js            → KURU ÇALIŞTIRMA (hiçbir şey yazmaz)
 *   node scripts/fix-device-brands.js --apply    → uygular
 *
 * Güvenlik:
 *  - Yalnızca marka TANINIYORSA dokunur. Tanınmayan (yerel marka vb.) satırlar OLDUĞU GİBİ kalır.
 *  - Aynı satırı iki kez çalıştırmak zararsızdır (düzeltilmiş satır artık "ters" görünmez).
 *  - Değişen her satır ekrana yazılır; sessiz değişiklik yok.
 */
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// TS modülünü Node'dan kullanmak yerine kuralları burada birebir tekrarlıyoruz;
// tek kaynak src/lib/device-brands.ts — değişirse burası da güncellenmeli.
const KNOWN_BRANDS = [
  'canon', 'hp', 'hewlett packard', 'hewlett-packard', 'konica', 'konica minolta', 'minolta',
  'pantum', 'ninestar', 'xerox', 'lexmark', 'brother', 'samsung', 'epson', 'kyocera',
  'ricoh', 'sharp', 'oki', 'toshiba', 'develop', 'olivetti', 'triumph adler', 'utax',
  'panasonic', 'dell', 'kodak', 'riso', 'duplo', 'nashuatec', 'gestetner', 'infotec',
];
const DISPLAY = {
  hp: 'HP', hewlettpackard: 'HP', canon: 'Canon', konica: 'Konica Minolta',
  konicaminolta: 'Konica Minolta', minolta: 'Konica Minolta', pantum: 'Pantum',
  ninestar: 'Ninestar', xerox: 'Xerox', lexmark: 'Lexmark', brother: 'Brother',
  samsung: 'Samsung', epson: 'Epson', kyocera: 'Kyocera', ricoh: 'Ricoh', sharp: 'Sharp',
  oki: 'OKI', toshiba: 'Toshiba', develop: 'Develop', olivetti: 'Olivetti',
  triumphadler: 'Triumph Adler', utax: 'UTAX', panasonic: 'Panasonic', dell: 'Dell',
  kodak: 'Kodak', riso: 'Riso', duplo: 'Duplo', nashuatec: 'Nashuatec',
  gestetner: 'Gestetner', infotec: 'Infotec',
};
const fold = (s) => String(s ?? '').toLocaleLowerCase('tr')
  .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
  .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9]/g, '');
function brandKey(v) {
  const f = fold(v);
  if (!f) return null;
  for (const b of KNOWN_BRANDS) if (f === fold(b)) return fold(b);
  for (const b of KNOWN_BRANDS) { const fb = fold(b); if (fb.length >= 4 && f.startsWith(fb)) return fb; }
  return null;
}
const isKnownBrand = (v) => brandKey(v) !== null;
const displayBrand = (v) => { const k = brandKey(v); return k ? (DISPLAY[k] ?? String(v).trim()) : String(v ?? '').trim(); };
function normalizeBrandModel(brandIn, modelIn) {
  const brand = String(brandIn ?? '').trim();
  const model = String(modelIn ?? '').trim();
  if (isKnownBrand(brand)) return { brand: displayBrand(brand), model, swapped: false, recognized: true };
  if (isKnownBrand(model)) return { brand: displayBrand(model), model: brand, swapped: true, recognized: true };
  return { brand, model, swapped: false, recognized: false };
}

const APPLY = process.argv.includes('--apply');
const p = new PrismaClient();
const ascii = (s) => String(s).normalize('NFKD').replace(/[^\x20-\x7E]/g, '?');

(async () => {
  const devs = await p.device.findMany({ select: { id: true, brand: true, model: true, serialNo: true } });
  console.log(`\n=== MARKA/MODEL DUZELTME — ${APPLY ? 'UYGULAMA' : 'KURU CALISTIRMA (yazma yok)'} ===`);
  console.log(`Toplam cihaz: ${devs.length}\n`);

  const degisecek = [];
  let yazimDuzeltme = 0, dokunulmayan = 0;

  for (const d of devs) {
    const nz = normalizeBrandModel(d.brand, d.model);
    if (!nz.recognized) { dokunulmayan++; continue; }
    if (nz.brand === d.brand && nz.model === d.model) continue;   // zaten doğru
    if (nz.swapped) degisecek.push({ d, nz, tip: 'TERS' });
    else { degisecek.push({ d, nz, tip: 'YAZIM' }); yazimDuzeltme++; }
  }

  const ters = degisecek.filter((x) => x.tip === 'TERS').length;
  console.log(`Ters kayit (marka<->model)  : ${ters}`);
  console.log(`Sadece yazim duzeltmesi     : ${yazimDuzeltme}`);
  console.log(`Tanınmayan marka (DOKUNULMAZ): ${dokunulmayan}`);
  console.log(`Degisiklik gerekmeyen        : ${devs.length - degisecek.length - dokunulmayan}\n`);

  console.log('--- ORNEKLER (ilk 10) ---');
  degisecek.slice(0, 10).forEach(({ d, nz, tip }) => {
    console.log(`  [${tip}] "${ascii(d.brand)}" / "${ascii(d.model)}"  ->  "${ascii(nz.brand)}" / "${ascii(nz.model)}"`);
  });

  if (!APPLY) {
    console.log(`\nKURU CALISTIRMA — hicbir sey yazilmadi.`);
    console.log(`Uygulamak icin: node scripts/fix-device-brands.js --apply\n`);
    await p.$disconnect();
    return;
  }

  let ok = 0, hata = 0;
  for (const { d, nz } of degisecek) {
    try { await p.device.update({ where: { id: d.id }, data: { brand: nz.brand, model: nz.model } }); ok++; }
    catch (e) { hata++; console.error('  HATA', d.serialNo, e.message.slice(0, 90)); }
  }
  console.log(`\nUYGULANDI: ${ok} cihaz guncellendi, ${hata} hata.`);

  const sonrasi = await p.device.groupBy({ by: ['brand'], _count: true, orderBy: { _count: { brand: 'desc' } }, take: 12 });
  console.log('\n--- DUZELTME SONRASI MARKA DAGILIMI ---');
  sonrasi.forEach((r) => console.log(`  ${String(r._count).padStart(5)}  ${ascii(r.brand)}`));
  await p.$disconnect();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
