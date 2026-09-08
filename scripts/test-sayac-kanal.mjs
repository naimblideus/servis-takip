// SAYAÇ KANALI SAĞLIĞI — "köprü durdu mu?"
// Çalıştır:  node scripts/test-sayac-kanal.mjs
//
// NEDEN BU TEST
// Bu uyarı bayiyi cihaz aramaktan alıkoyup KENDİ kurulumuna baktırıyor.
// Yanlış verirsek bayi durmayan bir kanalı saatlerce kurcalar; hiç
// vermezsek kanal haftalarca kapalı kalır ve her hafta faturalanamayan bir
// ay demektir. Eşik bayinin KENDİ ritminden çıkıyor — 400 cihazlı bayide
// e-posta her gün gelir, 3 cihazlı bayide ayda bir. Sabit gün sayısı
// birinde geç kalır, ötekinde her ay yanlış alarm verir.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-kanal-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/sayac-kanal.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

const { kanalDurumu, kanalUyarisi, ASGARI_ORNEK, ASGARI_SESSIZLIK_GUN, KAT_ESIGI } =
  await import(pathToFileURL(join(g, 'sayac-kanal.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const SIMDI = new Date('2026-09-08T10:00:00Z');
const gun = (n) => new Date(SIMDI.getTime() - n * 86400000);
/** `aralik` gün arayla `adet` rapor; sonuncusu `sonGunOnce` gün önce. */
const seri = (adet, aralik, sonGunOnce) =>
  Array.from({ length: adet }, (_, i) => gun(sonGunOnce + (adet - 1 - i) * aralik));

console.log('\nYANLIŞ ALARM VERMEMELİ\n');
{
  const s = kanalDurumu([], SIMDI);
  t('hiç e-posta gelmemişse uyarı yok (kanal kurulmamış)',
    s.durum === 'KURULMAMIS' && kanalUyarisi(s) === false, s);
}
{
  // Yeni kurulmuş kanal: 2 rapor gelmiş, biri epey eski. Ritim bilinmiyor.
  const s = kanalDurumu([gun(60), gun(45)], SIMDI);
  t(`${ASGARI_ORNEK} rapordan azsa karar verilmiyor (yeni kurulum)`,
    s.durum === 'YETERSIZ_VERI' && kanalUyarisi(s) === false, s);
  t('kaç rapor gerektiği söyleniyor', /en az \d+ rapor/.test(s.aciklama), s.aciklama);
}
{
  // Ayda bir rapor alan küçük bayi, son rapor 25 gün önce. NORMAL.
  const s = kanalDurumu(seri(6, 30, 25), SIMDI);
  t('ayda bir rapor alan bayide 25 gün sessizlik normal', s.durum === 'CALISIYOR', s);
}
{
  // Her gün rapor alan büyük bayi, son rapor 4 gün önce. NORMAL.
  const s = kanalDurumu(seri(20, 1, 4), SIMDI);
  t('her gün rapor alan bayide 4 gün sessizlik normal', s.durum === 'CALISIYOR', s);
}
{
  // Her gün rapor alan bayi, 8 gün sessiz. Kendi ritmine göre 8 kat ama
  // mutlak taban 10 günün altında — dalgalanma payı korunuyor.
  const s = kanalDurumu(seri(20, 1, 8), SIMDI);
  t(`${ASGARI_SESSIZLIK_GUN} günlük mutlak taban altında alarm yok (tatil/hafta sonu)`,
    s.durum === 'CALISIYOR', s);
}
{
  // Bütün raporlar aynı anda gelmiş (tek toplu rapor) — aralık ölçülemez
  const ayni = [gun(20), gun(20), gun(20), gun(20), gun(20)];
  const s = kanalDurumu(ayni, SIMDI);
  t('hepsi aynı anda gelmişse ritim ölçülemiyor, alarm da yok',
    kanalUyarisi(s) === false, s);
}

console.log('\nGERÇEK KESİNTİYİ YAKALAMALI\n');
{
  // Her gün rapor alan bayi, 21 gündür sessiz — köprü durmuş.
  const s = kanalDurumu(seri(20, 1, 21), SIMDI);
  t('her gün rapor alan bayide 21 gün sessizlik = DURDU', s.durum === 'DURDU', s);
  t('bayiye gösteriliyor', kanalUyarisi(s) === true);
  t('kaç gündür sessiz olduğu yazıyor', /21 gündür/.test(s.aciklama), s.aciklama);
  t('normalde kaç günde bir geldiği yazıyor', /normalde 1 günde bir/.test(s.aciklama), s.aciklama);
  t('bayiyi cihaz aramaktan alıkoyuyor',
    /tek tek cihazları değil/.test(s.aciklama), s.aciklama);
}
{
  // Ayda bir rapor alan bayi, 100 gündür sessiz — ritminin 3 katından fazla.
  const s = kanalDurumu(seri(6, 30, 100), SIMDI);
  t('ayda bir alan bayide 100 gün sessizlik = DURDU', s.durum === 'DURDU', s);
  t('eşik bayinin KENDİ ritminden çıkıyor', s.tipikGun === 30, s);
}
{
  // Eşiğin hemen üstü / hemen altı — sınır davranışı net olmalı
  const alt = kanalDurumu(seri(10, 7, 20), SIMDI);   // tipik 7 → eşik 21
  const ust = kanalDurumu(seri(10, 7, 22), SIMDI);
  t(`${KAT_ESIGI} kat eşiğinin ALTINDA alarm yok`, alt.durum === 'CALISIYOR', alt);
  t(`${KAT_ESIGI} kat eşiğinin ÜSTÜNDE alarm var`, ust.durum === 'DURDU', ust);
}

console.log('\nÖLÇÜM SAĞLAM OLMALI\n');
{
  // Ritmi bir kez bozan tek uzun boşluk (bayi tatildeydi) tipiği kaydırmamalı
  const karisik = [gun(126), gun(119), gun(112), gun(46), gun(39), gun(32), gun(25)];
  const s = kanalDurumu(karisik, SIMDI);
  // Ortalama olsaydı tipik ~17 güne çıkar, eşik 51 güne fırlar ve 25 günlük
  // sessizlik normal görünürdü. Ortanca tek boşluğu yutuyor, eşik 21'de kalıyor.
  t('tek uzun boşluk tipik aralığı şişirmiyor (ortanca)', s.tipikGun === 7, s);
  t('şişmeyen eşik sayesinde 25 gün sessizlik DURDU sayılıyor', s.durum === 'DURDU', s);
}
{
  // Sırasız gelen tarihler
  const sirasiz = [gun(4), gun(20), gun(12), gun(8), gun(16)];
  const s = kanalDurumu(sirasiz, SIMDI);
  t('sırasız tarih dizisi doğru sıralanıyor', s.gecenGun === 4 && s.durum === 'CALISIYOR', s);
}
{
  const s = kanalDurumu(seri(8, 3, 2), SIMDI);
  t('çalışırken de son rapor kaç gün önce geldiği bildiriliyor',
    s.gecenGun === 2 && /2 gün önce/.test(s.aciklama), s);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
