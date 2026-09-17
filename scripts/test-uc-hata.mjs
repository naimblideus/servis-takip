// UÇ NOKTA HATALARI — dil bütünlüğü
// Çalıştır:  node scripts/test-uc-hata.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Arayüzün tamamı İngilizce olsa bile, bir şey ters gittiğinde uç noktadan
// Türkçe bir cümle dönüyordu. Bayi için en kötü an işlerin ters gittiği andır;
// o anda anlamadığı bir dilde hata okumak durumu iki kat kötü yapar.
//
// Uçlar artık cümle kurmuyor: src/lib/uc-hata.ts anahtarı alıyor ve cümleyi
// İSTEĞİN dilinde kuruyor. Bu testin işi o düzeni korumak:
//   1. api içinde gömülü Türkçe hata metni KALMASIN,
//   2. her anahtarın iki dilde de karşılığı olsun,
//   3. çağrılarda kullanılan her anahtar sözlükte gerçekten bulunsun
//      (yazım hatası olursa ekranda BOŞ hata çıkardı — en kötü tür),
//   4. yer tutuculu cümlelerde {p1}/{p2} doldurulmadan kalmasın.
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');

const g = mkdtempSync(join(tmpdir(), 'st-uch-'));
let sozlukMod;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/i18n/sozluk.ts'), join(KOK, 'src/lib/i18n/tr.ts'), join(KOK, 'src/lib/i18n/en.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
  const yol = join(g, 'sozluk.js');
  writeFileSync(yol, readFileSync(yol, 'utf8').replace("from './tr'", "from './tr.js'").replace("from './en'", "from './en.js'"), 'utf8');
  sozlukMod = await import(pathToFileURL(yol).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { sozluk, doldur } = sozlukMod;
const TRS = sozluk('tr'), ENS = sozluk('en');

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const API = join(KOK, 'src/app/api');
const dosyalar = [];
(function gez(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) gez(p);
    else if (e.name.endsWith('.ts')) dosyalar.push(p);
  }
})(API);

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ UÇLARDA GÖMÜLÜ TÜRKÇE HATA YOK');
// ───────────────────────────────────────────────────────────────────────────
const TR_HARF = /[ğĞıİşŞçÇöÖüÜ]/;
const HATA_KALIP = [
  /error:\s*'((?:[^'\\\n]|\\.)*)'/g,
  /error:\s*"((?:[^"\\\n]|\\.)*)"/g,
  /error:\s*`([^`\n]*)`/g,
];
// Aktarım raporundaki satır kayıtları: kaydedilmiş METİN, arşivdeki eski
// oturumlar için yedek olarak duruyor. Yanında `kod` var; ekran onu çeviriyor.
const YEDEK_METIN = /kod:\s*'[A-Z_]+'/;

const gomulu = [];
for (const f of dosyalar) {
  const s = readFileSync(f, 'utf8');
  const kisa = f.slice(API.length + 1).replace(/\\/g, '/');
  for (const kal of HATA_KALIP) {
    for (const m of s.matchAll(kal)) {
      if (!TR_HARF.test(m[1])) continue;
      // Aynı nesnede `kod` varsa bu çevrilmiş kaydın yedeğidir.
      const pencere = s.slice(m.index, m.index + 320);
      if (YEDEK_METIN.test(pencere)) continue;
      gomulu.push(`${kisa} · ${m[1].slice(0, 60)}`);
    }
  }
}
t(`${dosyalar.length} uç dosyası tarandı`, dosyalar.length >= 140, dosyalar.length);
t('★ uçlarda gömülü Türkçe hata cümlesi yok', gomulu.length === 0, gomulu.slice(0, 6));

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ KULLANILAN HER ANAHTAR SÖZLÜKTE VAR');
// ───────────────────────────────────────────────────────────────────────────
// Yazım hatası olan anahtar ekranda BOŞ hata gösterirdi: kullanıcı bir şeyin
// ters gittiğini görür ama ne olduğunu göremez.
const kullanilan = new Set();
for (const f of dosyalar) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/ucHatasi\(\s*'([A-Z0-9_]+)'/g)) kullanilan.add(m[1]);
}
const sozlukAnahtarlari = new Set(Object.keys(TRS.ucHata));
const eksik = [...kullanilan].filter((k) => !sozlukAnahtarlari.has(k));
t(`${kullanilan.size} anahtar kullanılıyor`, kullanilan.size >= 150, kullanilan.size);
t('★ kullanılan her anahtar sözlükte var', eksik.length === 0, eksik);

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ İKİ DİLDE DE DOLU');
// ───────────────────────────────────────────────────────────────────────────
const bosTr = [...sozlukAnahtarlari].filter((k) => !TRS.ucHata[k] || TRS.ucHata[k].length < 2);
const bosEn = [...sozlukAnahtarlari].filter((k) => !ENS.ucHata[k] || ENS.ucHata[k].length < 2);
t('tr tarafında boş anahtar yok', bosTr.length === 0, bosTr);
t('★ en tarafında boş anahtar yok', bosEn.length === 0, bosEn);

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ YER TUTUCULAR İKİ DİLDE DE AYNI');
// ───────────────────────────────────────────────────────────────────────────
// Türkçesinde {p1} olup İngilizcesinde olmayan bir cümle, sayıyı sessizce
// yutar: "en fazla satır" der ama kaç satır olduğunu söylemez.
const yer = (s) => [...String(s).matchAll(/\{(p\d+)\}/g)].map((m) => m[1]).sort().join(',');
const uyusmaz = [...sozlukAnahtarlari].filter((k) => yer(TRS.ucHata[k]) !== yer(ENS.ucHata[k]));
t('★ {p1}/{p2} iki dilde de aynı', uyusmaz.length === 0,
  uyusmaz.map((k) => `${k}: tr(${yer(TRS.ucHata[k])}) en(${yer(ENS.ucHata[k])})`).slice(0, 6));

// Doldurulunca yer tutucu kalmamalı.
const SAHTE = { p1: 'A', p2: 'B', p3: 'C' };
const kalanYer = [...sozlukAnahtarlari].filter((k) =>
  /\{p\d+\}/.test(doldur(ENS.ucHata[k], SAHTE)) || /\{p\d+\}/.test(doldur(TRS.ucHata[k], SAHTE)));
t('doldurunca yer tutucu kalmıyor', kalanYer.length === 0, kalanYer.slice(0, 6));

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ YARDIMCININ KENDİSİ');
// ───────────────────────────────────────────────────────────────────────────
{
  const y = readFileSync(join(KOK, 'src/lib/uc-hata.ts'), 'utf8');
  t('cümle isteğin dilinde kuruluyor', /sunucuDili\(\)/.test(y));
  t('★ `error` alanı `ek` ile ezilemiyor', /\{ kod, \.\.\.\(secenek\?\.ek \?\? \{\}\), error \}/.test(y));
  t('müşteriye açık uçlar için dil geçilebiliyor', /dil\?:\s*Dil/.test(y));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
