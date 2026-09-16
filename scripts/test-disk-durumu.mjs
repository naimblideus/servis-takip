// DİSK DOLULUĞU — nöbetçinin en pahalı sessiz arızası
// Çalıştır:  node scripts/test-disk-durumu.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// 4 Eylül'de sunucunun diski derleme sırasında doldu. Derleme öldü, yardımcı
// konteyner kapanmadı, Coolify "deploy hâlâ sürüyor" sayıp sıradaki hiçbir şeyi
// başlatmadı. Uygulama 12 GÜN eski imajda dondu ve kimse fark etmedi — site
// çalışıyordu. Bu kontrol o arızayı yakalamak için var; yanlış eşik ya alarmı
// geç çalar (aynı kayıp tekrarlar) ya da sürekli çalar (kimse bakmaz).
//
// Test ettiklerim:
//   1. YÜZDE TEK BAŞINA YETMEZ — büyük diskte %85 rahat, küçükte değil.
//   2. BOŞ ALAN ÖNCELİKLİ: asıl soru "bir sonraki derleme sığar mı".
//   3. BOZUK GİRDİ HÜKÜM ÜRETMİYOR (sıfır disk, eksi boş alan, boş > toplam).
//   4. CÜMLE İKİ DİLDE DE KURULUYOR — disk durumu artık metin değil KOD
//      döndürüyor; cümleyi nobetci-metin.ts okuyanın dilinde kuruyor. Kod
//      ile sözlük ayrışırsa ekranda ham kod ya da boş satır kalır.
import { mkdtempSync, existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-disk-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/disk-durumu.ts'), join(KOK, 'src/lib/nobetci-metin.ts'),
    join(KOK, 'src/lib/i18n/sozluk.ts'), join(KOK, 'src/lib/i18n/tr.ts'), join(KOK, 'src/lib/i18n/en.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

// tsc uzantısız bırakıyor; Node ESM uzantı ister.
for (const [d, ...cift] of [
  ['i18n/sozluk.js', ["from './tr'", "from './tr.js'"], ["from './en'", "from './en.js'"]],
  ['nobetci-metin.js', ["from './i18n/sozluk'", "from './i18n/sozluk.js'"]],
]) {
  const yol = join(g, d);
  let icerik = readFileSync(yol, 'utf8');
  for (const [a, b] of cift) icerik = icerik.replace(a, b);
  writeFileSync(yol, icerik, 'utf8');
}

const { diskDurumu, DERLEME_ICIN_GB, KRITIK_GB, UYARI_YUZDE, KRITIK_YUZDE } =
  await import(pathToFileURL(join(g, 'disk-durumu.js')).href);
const { kontrolMesaji, kontrolNedeni } = await import(pathToFileURL(join(g, 'nobetci-metin.js')).href);
const { sozluk } = await import(pathToFileURL(join(g, 'i18n/sozluk.js')).href);
const TRS = sozluk('tr'), ENS = sozluk('en');
/** Kodu iki dilde de cümleye çevir. */
const mesajTR = (d) => kontrolMesaji(TRS, d.mesajKod);
const mesajEN = (d) => kontrolMesaji(ENS, d.mesajKod);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const GB = 1_000_000_000;

console.log('\n★ SAĞLIKLI DİSK\n');
{
  // Temizlikten sonra ölçülen gerçek değer: 61,3 GB toplam, 37,8 GB boş.
  const d = diskDurumu(61.3 * GB, 37.8 * GB);
  t('seviye iyi', d.seviye === 'iyi', d);
  t('kullanım %38', d.kullanimYuzde === 38, d.kullanimYuzde);
  t('★ sorun yokken nedeni YAZILMIYOR', d.nedenKod === undefined, d.nedenKod);
  t('mesaj hem yüzde hem boş alan veriyor', /%38/.test(mesajTR(d)) && /37\.8 GB/.test(mesajTR(d)), mesajTR(d));
  t('★ İngilizcede yüzde sayının ARKASINDA', /38%/.test(mesajEN(d)) && !/%38/.test(mesajEN(d)), mesajEN(d));
}

console.log('\n★ ASIL ARIZANIN YAŞANDIĞI NOKTA\n');
{
  // 4 Eylül öncesi durum: 58 GB diskte derleme sırasında alan bitti.
  const d = diskDurumu(58 * GB, 2 * GB);
  t('★ 2 GB boş → KRİTİK', d.seviye === 'kritik', d);
  t('nedeni derleme önbelleğini işaret ediyor', /builder prune/.test(kontrolNedeni(TRS, d.nedenKod)), d.nedenKod);
  t('★ neden İngilizcede de aynı komutu veriyor', /builder prune/.test(kontrolNedeni(ENS, d.nedenKod)));
  t('mesaj boş alanı söylüyor', /2 GB boş/.test(mesajTR(d)), mesajTR(d));
  t('★ İngilizce mesaj boş alanı söylüyor', /2 GB free/.test(mesajEN(d)), mesajEN(d));

  // Bu gece ölçülen tehlikeli nokta: 50/58 GB dolu, 7,4 GB boş.
  const b = diskDurumu(58 * GB, 7.4 * GB);
  t('★ 7,4 GB boş → UYARI (henüz kritik değil)', b.seviye === 'uyari', b);
  t('uyarı "sığmayabilir" diyor', /sığmayabilir/.test(kontrolNedeni(TRS, b.nedenKod)), b.nedenKod);
  t('★ kritik ile uyarı AYNI nedeni vermiyor', b.nedenKod !== d.nedenKod, [b.nedenKod, d.nedenKod]);
  t('★ iki dilde de cümle boş kalmıyor', mesajTR(b).length > 5 && mesajEN(b).length > 5);
}

console.log('\n★ YÜZDE TEK BAŞINA YETMEZ\n');
{
  // 500 GB diskte %85 doluluk 75 GB bırakır — rahat. Ama yüzde eşiği
  // tek ölçüt olsaydı burada alarm çalardı.
  const buyuk = diskDurumu(500 * GB, 75 * GB);
  t('★ büyük diskte %85 dolu ama 75 GB boş → yine de uyarı (yüzde eşiği)',
    buyuk.seviye === 'uyari', buyuk);

  // 60 GB diskte %85 doluluk 9 GB bırakır — derleme zor sığar.
  const kucuk = diskDurumu(60 * GB, 9 * GB);
  t('★ küçük diskte 9 GB boş → uyarı', kucuk.seviye === 'uyari', kucuk);

  // 1 TB diskte 50 GB boş = %95 dolu. Boş alan bol ama yüzde kritik.
  const dev = diskDurumu(1000 * GB, 50 * GB);
  t('★ %95 dolu → boş alan bol olsa da KRİTİK', dev.seviye === 'kritik', dev);
}

console.log('\n★ EŞİK SINIRLARI\n');
{
  // İKİ KURAL BİRDEN İŞLİYOR (boş alan VE yüzde). Boş alan eşiğini tek
  // başına sınamak için diskin yüzdesi rahat bölgede kalmalı; yoksa yüzde
  // kuralı önce devreye girer ve test kendi kurduğu tuzağa düşer —
  // 200 GB'da 10 GB boş demek %95 dolu demektir, orada uyarı beklemek yanlış.
  // 60 GB'da 10 GB boş = %83: yüzde eşiğinin altında.
  t(`boş alan tam ${DERLEME_ICIN_GB} GB, yüzde rahat → iyi`,
    diskDurumu(60 * GB, DERLEME_ICIN_GB * GB).seviye === 'iyi',
    diskDurumu(60 * GB, DERLEME_ICIN_GB * GB));
  t(`boş alan ${DERLEME_ICIN_GB - 0.1} GB → uyarı`,
    diskDurumu(60 * GB, (DERLEME_ICIN_GB - 0.1) * GB).seviye === 'uyari',
    diskDurumu(60 * GB, (DERLEME_ICIN_GB - 0.1) * GB));
  // 40 GB'da 4 GB boş = %90: yüzde uyarı bölgesinde, kritiğin altında.
  t(`boş alan tam ${KRITIK_GB} GB → uyarı (kritik değil)`,
    diskDurumu(40 * GB, KRITIK_GB * GB).seviye === 'uyari',
    diskDurumu(40 * GB, KRITIK_GB * GB));
  t(`boş alan ${KRITIK_GB - 0.1} GB → kritik`,
    diskDurumu(40 * GB, (KRITIK_GB - 0.1) * GB).seviye === 'kritik');
  t('★ iki kuraldan hangisi tetiklerse tetiklesin sonuç aynı ciddiyette',
    diskDurumu(1000 * GB, 50 * GB).seviye === 'kritik'
    && diskDurumu(58 * GB, 2 * GB).seviye === 'kritik');
  t(`★ uyarı eşiği ${UYARI_YUZDE}, kritik ${KRITIK_YUZDE} — arada boşluk var`,
    UYARI_YUZDE < KRITIK_YUZDE);
}

console.log('\n★ BOZUK GİRDİ HÜKÜM ÜRETMİYOR\n');
{
  t('toplam sıfır → null (sıfıra bölme yok)', diskDurumu(0, 0) === null);
  t('eksi toplam → null', diskDurumu(-1, 0) === null);
  t('★ eksi boş alan → null', diskDurumu(100 * GB, -5) === null);
  t('★ boş alan toplamdan büyük → null', diskDurumu(10 * GB, 20 * GB) === null);
  t('tamamen dolu disk kritik', diskDurumu(58 * GB, 0).seviye === 'kritik');
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
