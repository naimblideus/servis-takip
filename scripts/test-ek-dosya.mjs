// EK DOSYA (ZIP/CSV) OKUMA testi.
// Çalıştır:  node scripts/test-ek-dosya.mjs
//
// Neden: filo yazılımları sayaç raporunu EK olarak gönderiyor (Kyocera Fleet
// Services varsayılan olarak ZIP'li CSV). Uç yalnız gövdeyi okuduğu için bu
// raporlar sessizce sıfır okuma üretiyordu.
//
// Test GERÇEK bir ZIP üretir (deflate ile, elle) ve okuyucunun onu açıp
// içindeki CSV'yi metne çevirdiğini doğrular. Sonra o metnin MEVCUT sayaç
// ayrıştırıcısı tarafından okunabildiğini de kontrol eder — asıl mesele bu.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { deflateRawSync, crc32 } from 'node:zlib';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-ek-'));
let ekleriMetneCevir, parseCounterEmailCoklu;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/ek-dosya.ts'), join(KOK, 'src/lib/counter-email.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
  ({ ekleriMetneCevir } = await import(pathToFileURL(join(g, 'ek-dosya.js')).href));
  ({ parseCounterEmailCoklu } = await import(pathToFileURL(join(g, 'counter-email.js')).href));
} catch (e) {
  console.error('Derleme başarısız:', e.stderr?.toString()?.slice(0, 600) || e.message);
  process.exit(1);
}

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay).slice(0, 300)}` : ''}`); }
};

// ── Elle ZIP üretici (deflate). Gerçek bir arşiv kurar. ──────────────────
function zipYap(dosyalar) {
  const yereller = [], merkez = [];
  let ofs = 0;
  for (const { ad, icerik } of dosyalar) {
    const veri = Buffer.from(icerik, 'utf8');
    const sik = deflateRawSync(veri);
    const adB = Buffer.from(ad, 'utf8');
    const c = crc32 ? crc32(veri) : 0;

    const yh = Buffer.alloc(30);
    yh.writeUInt32LE(0x04034b50, 0); yh.writeUInt16LE(20, 4); yh.writeUInt16LE(0, 6);
    yh.writeUInt16LE(8, 8);                       // deflate
    yh.writeUInt32LE(c >>> 0, 14);
    yh.writeUInt32LE(sik.length, 18); yh.writeUInt32LE(veri.length, 22);
    yh.writeUInt16LE(adB.length, 26); yh.writeUInt16LE(0, 28);
    yereller.push(yh, adB, sik);

    const mh = Buffer.alloc(46);
    mh.writeUInt32LE(0x02014b50, 0); mh.writeUInt16LE(20, 4); mh.writeUInt16LE(20, 6);
    mh.writeUInt16LE(8, 10);
    mh.writeUInt32LE(c >>> 0, 16);
    mh.writeUInt32LE(sik.length, 20); mh.writeUInt32LE(veri.length, 24);
    mh.writeUInt16LE(adB.length, 28);
    mh.writeUInt32LE(ofs, 42);
    merkez.push(mh, adB);
    ofs += yh.length + adB.length + sik.length;
  }
  const yerelB = Buffer.concat(yereller);
  const merkezB = Buffer.concat(merkez);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(dosyalar.length, 8); eocd.writeUInt16LE(dosyalar.length, 10);
  eocd.writeUInt32LE(merkezB.length, 12); eocd.writeUInt32LE(yerelB.length, 16);
  return Buffer.concat([yerelB, merkezB, eocd]);
}

const b64 = (b) => b.toString('base64');

// Kyocera Fleet Services'ın ürettiğine yakın bir sayaç CSV'si
const KFS_CSV =
`"Serial Number","Model","Total Black","Total Color","Read Date"
"VLK9901234","ECOSYS M2540dn","148320","0","2026-09-01"
"VLK9905678","TASKalfa 2554ci","98211","31044","2026-09-01"
"VLK9909999","ECOSYS M3540dn","55010","0","2026-09-01"`;

console.log('\nZIP VE CSV OKUMA\n');

{
  const zip = zipYap([{ ad: 'counter_report.csv', icerik: KFS_CSV }]);
  const r = ekleriMetneCevir([{ ad: 'KFS_Report.zip', base64: b64(zip) }]);
  t('ZIP açılıyor ve içindeki CSV okunuyor', r.okunan.includes('counter_report.csv'), r);
  t('seri numaraları metne geçti', /VLK9901234/.test(r.metin) && /VLK9905678/.test(r.metin), r.metin.slice(0, 200));
  t('sayaç değerleri metne geçti', /148320/.test(r.metin) && /31044/.test(r.metin), r.metin.slice(0, 200));
  t('ayraçlar boşluğa çevrildi (tırnak kalmadı)', !r.metin.includes('","'), r.metin.slice(0, 120));
}

{
  const r = ekleriMetneCevir([{ ad: 'rapor.csv', base64: b64(Buffer.from(KFS_CSV, 'utf8')) }]);
  t('ZIP olmadan düz CSV de okunuyor', r.okunan.includes('rapor.csv') && /VLK9909999/.test(r.metin), r);
}

{
  const xml = '<devices><device><serial>VLK9901234</serial><black>148320</black></device></devices>';
  const r = ekleriMetneCevir([{ ad: 'rapor.xml', base64: b64(Buffer.from(xml, 'utf8')) }]);
  t('XML etiketlerden arındırılıp okunuyor', /VLK9901234/.test(r.metin) && !/</.test(r.metin), r.metin);
}

console.log('\nGÜVENLİK VE DAYANIKLILIK\n');

{
  const r = ekleriMetneCevir([{ ad: 'logo.png', base64: b64(Buffer.from([0x89, 0x50, 0x4e, 0x47])) }]);
  t('görsel ek ATLANIR ve sebebi yazılır', r.okunan.length === 0 && /metin değil/.test(r.atlanan[0]?.sebep || ''), r);
}
{
  const r = ekleriMetneCevir([{ ad: 'bozuk.zip', base64: b64(Buffer.from('bu bir zip degil', 'utf8')) }]);
  t('bozuk ZIP çökmez, sebep döner', r.okunan.length === 0 && r.atlanan.length === 1, r);
}
{
  const r = ekleriMetneCevir([{ ad: 'bos.csv', base64: '' }]);
  t('içeriksiz ek sebebiyle atlanır', /içerik yok/.test(r.atlanan[0]?.sebep || ''), r);
}
t('ek yoksa boş sonuç', ekleriMetneCevir(null).metin === '' && ekleriMetneCevir([]).okunan.length === 0);
{
  const cok = Array.from({ length: 40 }, (_, i) => ({ ad: `d${i}.csv`, base64: b64(Buffer.from('a,b', 'utf8')) }));
  const r = ekleriMetneCevir(cok);
  t('ek sayısı sınırlanıyor (en fazla 20)', r.okunan.length + r.atlanan.length <= 20, r.okunan.length + r.atlanan.length);
}

console.log('\nASIL MESELE — ek metni MEVCUT ayrıştırıcı tarafından okunuyor mu\n');

{
  const zip = zipYap([{ ad: 'counters.csv', icerik: KFS_CSV }]);
  const { metin } = ekleriMetneCevir([{ ad: 'KFS.zip', base64: b64(zip) }]);
  const seriler = ['VLK9901234', 'VLK9905678', 'VLK9909999'];
  const c = parseCounterEmailCoklu(metin, seriler, 'Counter Report');

  t('üç cihazın da sayacı çıkarıldı', c.cihazSayisi === 3, { cihazSayisi: c.cihazSayisi, okumalar: c.okumalar });
  const bul = (s) => c.okumalar.find((o) => o.serial === s);
  t('siyah sayaç doğru (VLK9901234 = 148320)', bul('VLK9901234')?.black === 148320, bul('VLK9901234'));
  t('renkli sayaç doğru (VLK9905678 = 31044)', bul('VLK9905678')?.color === 31044, bul('VLK9905678'));
  t('renksiz cihazda renkli UYDURULMUYOR', (bul('VLK9909999')?.color ?? null) !== 999, bul('VLK9909999'));
}

// ── BOŞ HÜCRE SÜTUN KAYDIRMASI ────────────────────────────────────────────
// Ölçülmüş gerçek hata: ardışık ayraçlar tek boşluğa inince boş hücre yok
// oluyor, sütun kayıyor ve RENKLİ değer siyah sanılıyordu — üstelik sonuç
// "güvenli" işaretlenip otomatik faturaya yazılıyordu.
{
  const csv = [
    'Serial Number,Model,Location,Black,Color',
    'ABC12345,Canon iR2530,,145230,22410',      // Location BOŞ
    'WXY9988,Ricoh IM C300,Kat 2,998450,1200',  // dolu
  ].join('\n');
  const r = ekleriMetneCevir([{ ad: 'bos-hucre.csv', base64: b64(Buffer.from(csv, 'utf8')) }]);
  t('boş hücre sütunu kaydırmıyor (yer tutucu korunuyor)', /Canon iR2530\s+-\s+145230/.test(r.metin), r.metin);

  const c = parseCounterEmailCoklu(r.metin, ['ABC12345', 'WXY9988'], 'Counter Report');
  const a = (c.okumalar || []).find((x) => x.serial === 'ABC12345');
  const b = (c.okumalar || []).find((x) => x.serial === 'WXY9988');
  t('boş hücreli satırda SİYAH doğru (145.230)', a && a.black === 145230, a);
  t('boş hücreli satırda RENKLİ doğru (22.410)', a && a.color === 22410, a);
  t('dolu satır etkilenmedi (998.450 / 1.200)', b && b.black === 998450 && b.color === 1200, b);
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
