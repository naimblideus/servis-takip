// SAYAÇ ANOMALİSİ — "bu artış bu makineye ait olamaz"
// Çalıştır:  node scripts/test-sayac-anomali.mjs
//
// NEDEN BU TEST
// Bu uyarı faturayı durdurmuyor, bayiyi DURDURUYOR: fatura kesmeden önce
// bakmasını istiyor. Boşuna durdurursak bayi uyarıya bakmayı bırakır ve
// gerçek bir hatalı okuma faturaya girer. O yüzden testin ağırlığı
// yakalamada değil, YANLIŞ ALARM VERMEMEDE.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-anomali-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/sayac-anomali.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

const { anomaliDegerlendir, normalHizBul, MUTLAK_TAVAN, KAT_ESIGI, TABAN_SAYFA } =
  await import(pathToFileURL(join(g, 'sayac-anomali.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const BUGUN = new Date('2026-09-08T10:00:00Z').getTime();
const ok = (gunOnce, siyah, renkli = 0) => ({
  readingDate: new Date(BUGUN - gunOnce * 86400000),
  counterBlack: siyah, counterColor: renkli,
});
// Aylık ~3.000 sayfa basan küçük ofis makinesi — 4 okuma, 90 gün
const KUCUK_OFIS = [ok(120, 10000), ok(90, 13000), ok(60, 16000), ok(30, 19000)];
// Aylık ~250.000 basan matbaa makinesi — eski sabit eşiği HER AY tetiklerdi
const MATBAA = [ok(120, 1000000), ok(90, 1250000), ok(60, 1500000), ok(30, 1750000)];

console.log('\nYANLIŞ ALARM VERMEMELİ\n');
{
  const s = anomaliDegerlendir(3000, 30, KUCUK_OFIS);
  t('normal aylık kullanım şüpheli değil', s.supheli === false, s);
}
{
  // İki katına çıkmış — yoğun ay olabilir, alarm YOK
  const s = anomaliDegerlendir(6000, 30, KUCUK_OFIS);
  t('kullanım İKİYE katlanınca alarm yok (yoğun ay)', s.supheli === false, s);
}
{
  // 4 kat — eşiğin hemen altı
  const s = anomaliDegerlendir(12000, 30, KUCUK_OFIS);
  t(`${KAT_ESIGI} kat eşiğinin ALTINDA alarm yok`, s.supheli === false, s);
}
{
  // ÖNEMLİ: eski sabit eşiğin (200.000) altında kaldığı için hiç uyarmayan durum
  const s = anomaliDegerlendir(250000, 30, MATBAA);
  t('gerçekten ayda 250.000 basan matbaa makinesi HER AY uyarı üretmiyor',
    s.supheli === false, s);
}
{
  // Ayda 40 sayfa basan makine 300'e çıkmış: 7 kat ama ortada para yok
  const az = [ok(120, 500), ok(90, 540), ok(60, 580), ok(30, 620)];
  const s = anomaliDegerlendir(300, 30, az);
  t(`kat aşılsa da ${TABAN_SAYFA} sayfa tabanının altı şüphe sayılmıyor`,
    s.supheli === false, s);
}
{
  // Geçmişi yetersiz cihaz — kıyas yok, yalnız mutlak tavan geçerli
  const s = anomaliDegerlendir(50000, 30, [ok(30, 1000)]);
  t('geçmişi yoksa kat kuralı çalışmıyor (yalnız mutlak tavan)',
    s.supheli === false && s.normalHiz === null, s);
}
{
  // Sıfır sayfa — durgunluk ayrı bir sinyal, burada alarm değil
  const s = anomaliDegerlendir(0, 30, KUCUK_OFIS);
  t('hiç basılmamışsa anomali değil (o ayrı sinyal)', s.supheli === false, s);
}

console.log('\nGERÇEK ANOMALİYİ YAKALAMALI\n');
{
  // Küçük ofis makinesine 150.000 sayfa gelmiş: eski sabit eşik (200.000)
  // bunu KAÇIRIYORDU — asıl düzeltilen kör nokta bu.
  const s = anomaliDegerlendir(150000, 30, KUCUK_OFIS);
  t('ayda 3.000 basan makineye gelen 150.000 sayfa YAKALANIYOR (eski eşik kaçırıyordu)',
    s.supheli === true && s.durum === 'SUPHELI_KAT', s);
  t('kaç kat olduğu söyleniyor', typeof s.kat === 'number' && s.kat > 40, s);
  // Cümledeki iki sayı AYNI tabana oturmalı: 30 günlük okuma 30 günlük
  // beklentiyle kıyaslanmalı. Aylık ortalamayla anlatınca 1 günlük bir okuma
  // "ayda ~5.630 sayfa basıyor, 480 katı" gibi kendi içinde tutarsız görünüyordu.
  t('kıyas AYNI süre üzerinden anlatılıyor', /30 günde ~3\.000 sayfa/.test(s.aciklama), s.aciklama);
  t('beklenen sayfa sayısı veri olarak da dönüyor', s.beklenen === 3000 && s.gun === 30, s);
  t('olası sebep söyleniyor (yanlış cihaz / hatalı okuma)',
    /yanlış cihaz/i.test(s.aciklama) && /hatalı okuma/i.test(s.aciklama), s.aciklama);
}
{
  // Geçmiş olmasa bile inanılmaz büyük sayı
  const s = anomaliDegerlendir(MUTLAK_TAVAN + 1, 30, []);
  t('geçmiş yokken bile mutlak tavan koruyor',
    s.supheli === true && s.durum === 'SUPHELI_MUTLAK', s);
}
{
  // Kısa aralık: 2 günde 20.000 sayfa — aylık toplam normal görünse de hız anormal
  const s = anomaliDegerlendir(20000, 2, KUCUK_OFIS);
  t('KISA aralıktaki büyük artış hıza göre yakalanıyor', s.supheli === true, s);
}

{
  // Matbaa makinesi kendi normalinin 3 katına fırlamış — hem tavanın üstünde
  // hem kendi normalinin belirgin üstünde. Bu YAKALANMALI, yoksa tavanı
  // geçmişin arkasına almak gerçek anomaliyi de körleştirmiş olurdu.
  const s = anomaliDegerlendir(750000, 30, MATBAA);
  t('çok basan makine bile KENDİ normalinin 3 katına çıkınca yakalanıyor',
    s.supheli === true, s);
}

console.log('\nKIYAS TABANI SAĞLAM OLMALI\n');
{
  const h = normalHizBul(KUCUK_OFIS);
  t('normal hız cihazın kendi geçmişinden çıkıyor', Math.round(h) === 100, h);
}
{
  // Geçmişte TEK bozuk okuma var — ortalama olsaydı taban şişer ve
  // gerçek anomali normal görünürdü. Ortanca bunu yutmalı.
  const bozuk = [ok(120, 10000), ok(90, 13000), ok(75, 900000), ok(60, 903000), ok(30, 906000)];
  const h = normalHizBul(bozuk);
  t('geçmişteki TEK bozuk okuma kıyas tabanını şişirmiyor (ortanca)', h < 500, h);
  const s = anomaliDegerlendir(150000, 30, bozuk);
  t('bozuk geçmişe rağmen yeni anomali yine yakalanıyor', s.supheli === true, s);
}
{
  // Sıfırlama/cihaz değişimi geçmişte varsa negatif fark kıyasa girmemeli
  const sifirlanmis = [ok(120, 500000), ok(90, 503000), ok(60, 2000), ok(30, 5000)];
  const h = normalHizBul(sifirlanmis);
  t('geçmişteki sayaç sıfırlanması kıyası bozmuyor', h !== null && h < 500, h);
}
{
  // Aynı gün iki okuma — hız hesabı sonsuza gitmemeli
  const ayniGun = [ok(60, 10000), ok(60, 10500), ok(30, 13000), ok(0, 16000)];
  const h = normalHizBul(ayniGun);
  t('aynı gün gelen ikinci okuma hızı bozmuyor', h !== null && Number.isFinite(h) && h < 1000, h);
}
{
  const s = anomaliDegerlendir(3000, 30, KUCUK_OFIS);
  t('normal durumda da kıyas sayıları bildiriliyor',
    s.normalHiz !== null && s.kat !== null, s);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
