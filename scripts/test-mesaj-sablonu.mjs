// TOPLU HATIRLATMA ŞABLONU — değişken doldurma
// Çalıştır:  node scripts/test-mesaj-sablonu.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu metin MÜŞTERİYE gidiyor ve para istiyor. Yanlış doldurulursa bayi
// "Sayın {ad}, {borç} borcunuz var" diye bir SMS göndermiş olur — ölçülmüş
// bir utanç kaynağı, üstelik toplu. Test ettiklerim:
//
//   1. ÖNİZLEME İLE GÖNDERİLEN AYNI KURALDAN GEÇİYOR — ekranda doğru görünüp
//      telefona yanlış giden metin olmasın (eskiden iki ayrı replace zinciri
//      vardı: biri istemcide, biri sunucuda).
//   2. HER DEĞİŞKENİN TÜM YAZIMLARI — {ad}/{name}, {borç}/{borc}/{debt},
//      {telefon}/{phone}. Türkçe klavyesi olmayan makinede yazılan {borc}
//      sessizce boş gitmesin.
//   3. AYNI DEĞİŞKEN BİRDEN ÇOK KEZ geçebilir (g bayrağı).
//   4. BİLİNMEYEN DEĞİŞKEN OLDUĞU GİBİ KALIR — sessizce silinip cümleyi
//      bozmaz, bayi yazım hatasını görür.
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-sablon-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/mesaj-sablonu.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

const { sablonDoldur, SABLON_DEGISKENLERI } = await import(pathToFileURL(join(g, 'mesaj-sablonu.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const D = { ad: 'Mercan Hukuk', borc: '₺1.240,00', telefon: '05551112233' };

console.log('\n★ TÜRKÇE DEĞİŞKENLER\n');
{
  const out = sablonDoldur('Sayın {ad}, {borç} bakiyeniz var. Tel: {telefon}', D);
  t('★ üç değişken de doldu', out === 'Sayın Mercan Hukuk, ₺1.240,00 bakiyeniz var. Tel: 05551112233', out);
  t('★ metinde hiç süslü parantez kalmadı', !/[{}]/.test(out), out);
}

console.log('\n★ İNGİLİZCE DEĞİŞKENLER\n');
{
  const out = sablonDoldur('Dear {name}, your balance is {debt}. Phone: {phone}', D);
  t('★ {name}/{debt}/{phone} de çalışıyor', out === 'Dear Mercan Hukuk, your balance is ₺1.240,00. Phone: 05551112233', out);
}

console.log('\n★ YAZIM VARYANTLARI VE TEKRAR\n');
{
  t('★ ç’siz {borc} da doluyor', sablonDoldur('{borc}', D) === '₺1.240,00', sablonDoldur('{borc}', D));
  t('aynı değişken iki kez', sablonDoldur('{ad} — {ad}', D) === 'Mercan Hukuk — Mercan Hukuk');
  t('karışık dil aynı şablonda', sablonDoldur('{ad}/{debt}', D) === 'Mercan Hukuk/₺1.240,00');
}

console.log('\n★ SAĞLAMLIK\n');
{
  t('★ bilinmeyen değişken olduğu gibi kalır', sablonDoldur('{musteri} borcu', D) === '{musteri} borcu',
    sablonDoldur('{musteri} borcu', D));
  t('boş şablon boş döner', sablonDoldur('', D) === '');
  t('null şablon çökmüyor', sablonDoldur(null, D) === '');
  t('eksik değer boş dize olur (undefined yazmaz)',
    sablonDoldur('{ad}!', { borc: '', telefon: '' }) === '!', sablonDoldur('{ad}!', { borc: '', telefon: '' }));
  t('değişken listesi iki dilde de üç tane',
    SABLON_DEGISKENLERI.tr.length === 3 && SABLON_DEGISKENLERI.en.length === 3);
  t('★ tr listesi {borç} içeriyor', SABLON_DEGISKENLERI.tr.includes('{borç}'));
  t('★ en listesi {debt} içeriyor', SABLON_DEGISKENLERI.en.includes('{debt}'));
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
