// SAYAÇ DURGUNLUĞU — "sayaç geliyor ama artmıyor"
// Çalıştır:  node scripts/test-sayac-durgunluk.mjs
//
// NEDEN BU TEST
// Bu sinyal bayiyi TELEFONA sarıldıracak. İki kez boşuna aratırsak bir daha
// bakmaz ve özellik ölür. O yüzden asıl test edilen şey "yakalıyor mu"
// değil, YANLIŞ ALARM VERMİYOR MU: yeni kurulan cihaz, tek okuması olan
// cihaz, az ama düzenli basan müşteri, tatil ayı — hiçbiri işaretlenmemeli.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-durgun-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/sayac-durgunluk.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

const { durgunlukDegerlendir, dikkatGerektirir, ASGARI_GUN } =
  await import(pathToFileURL(join(g, 'sayac-durgunluk.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

// Gün ofsetiyle okuma üret — bugünden geriye.
const BUGUN = new Date('2026-09-08T10:00:00Z').getTime();
const ok = (gunOnce, siyah, renkli = 0) => ({
  readingDate: new Date(BUGUN - gunOnce * 86400000),
  counterBlack: siyah, counterColor: renkli,
});

console.log('\nYANLIŞ ALARM VERMEMELİ\n');
{
  const s = durgunlukDegerlendir([]);
  t('okuma yoksa karar verilmiyor', s.durum === 'YETERSIZ_VERI', s);
}
{
  const s = durgunlukDegerlendir([ok(10, 5000)]);
  t('TEK okuması olan cihaz işaretlenmiyor', s.durum === 'YETERSIZ_VERI', s);
}
{
  // Yeni kurulan cihaz: iki okuma ama arada 20 gün var
  const s = durgunlukDegerlendir([ok(20, 1000), ok(0, 1000)]);
  t(`aralık ${ASGARI_GUN} günden kısaysa karar verilmiyor (yeni cihaz)`,
    s.durum === 'YETERSIZ_VERI', s);
  t('kullanıcıya kaç gün gerektiği söyleniyor', /en az \d+ gün/.test(s.aciklama), s.aciklama);
}
{
  // AZ ama düzenli basan müşteri — küçük ofis, ayda 300 sayfa. DURGUN DEĞİL.
  const s = durgunlukDegerlendir([ok(90, 10000), ok(60, 10300), ok(30, 10600), ok(0, 10900)]);
  t('az ama DÜZENLİ basan müşteri normal sayılıyor', s.durum === 'NORMAL', s);
}
{
  // Kullanım artıyor — kesinlikle alarm yok
  const s = durgunlukDegerlendir([ok(90, 10000), ok(60, 12000), ok(30, 15000), ok(0, 19000)]);
  t('kullanımı ARTAN cihaz normal', s.durum === 'NORMAL', s);
}
{
  // Tek aylık dalgalanma — geçmişi 3 okumadan az, düşüş kararı verilmemeli
  const s = durgunlukDegerlendir([ok(60, 10000), ok(0, 10050)]);
  t('geçmişi yetersizken DÜŞÜŞ kararı verilmiyor (dalgalanma değil)',
    s.durum !== 'DUSUS', s);
}

console.log('\nGERÇEK DURGUNLUĞU YAKALAMALI\n');
{
  // Sayaç geliyor, rakam hiç değişmiyor — makine kullanılmıyor
  const s = durgunlukDegerlendir([ok(90, 45000), ok(60, 45000), ok(30, 45000), ok(0, 45000)]);
  t('90 gündür HİÇ artmayan sayaç DURGUN', s.durum === 'DURGUN', s);
  t('kaç gündür durduğu söyleniyor', /90 gündür/.test(s.aciklama), s.aciklama);
  t('bayiye gösterilecek olarak işaretleniyor', dikkatGerektirir(s) === true);
  t('üç olası sebep de anlatılıyor (kullanılmıyor/bozuk/taşınmış)',
    /kullanılmıyor/.test(s.aciklama) && /bozuk/.test(s.aciklama) && /taşınmış/.test(s.aciklama), s.aciklama);
}
{
  // Renkli hareket varsa DURGUN değil — iki kanal birlikte sayılıyor
  const s = durgunlukDegerlendir([ok(90, 45000, 100), ok(0, 45000, 900)]);
  t('siyah durmuş ama RENKLİ basılmışsa durgun sayılmıyor', s.durum !== 'DURGUN', s);
}

console.log('\nDÜŞÜŞÜ YAKALAMALI\n');
{
  // Aylık ~3.000 basan müşteri son ayda 100'e düşmüş
  const s = durgunlukDegerlendir([
    ok(120, 10000), ok(90, 13000), ok(60, 16000), ok(30, 19000), ok(0, 19100),
  ]);
  t('kendi ortalamasının çok altına düşen cihaz DÜŞÜŞ', s.durum === 'DUSUS', s);
  t('yüzde kaç düştüğü söyleniyor', /%\d+ altına/.test(s.aciklama), s.aciklama);
  t('kıyas tabanı cihazın KENDİ geçmişi (marka ortalaması değil)',
    typeof s.gecmisGunlukOrtalama === 'number' && s.gecmisGunlukOrtalama > 0, s);
  t('bayiye gösterilecek', dikkatGerektirir(s) === true);
}
{
  // Hafif düşüş (yarıya inmiş) — eşiğin üstünde, alarm YOK.
  // Bayiyi her dalgalanmada aratmak özelliği öldürür.
  const s = durgunlukDegerlendir([
    ok(120, 10000), ok(90, 13000), ok(60, 16000), ok(30, 19000), ok(0, 20500),
  ]);
  t('HAFİF düşüş alarm üretmiyor (yalnız sert düşüş)', s.durum === 'NORMAL', s);
}

console.log('\nNORMAL DURUM GÖSTERİLMİYOR\n');
{
  const s = durgunlukDegerlendir([ok(90, 10000), ok(60, 13000), ok(30, 16000), ok(0, 19000)]);
  t('normal cihaz bayinin listesine düşmüyor', dikkatGerektirir(s) === false, s);
  t('yine de günlük ortalama bildiriliyor (bilgi olarak)', s.gunlukOrtalama > 0, s);
}
{
  const s = durgunlukDegerlendir([ok(10, 100)]);
  t('yetersiz veri de listeye düşmüyor', dikkatGerektirir(s) === false, s);
}

console.log('\nSAYAÇ SIRASIZ GELSE DE ÇALIŞIYOR\n');
{
  // Okumalar karışık sırada verilse de sonuç aynı olmalı
  const karisik = [ok(0, 45000), ok(90, 45000), ok(30, 45000)];
  const s = durgunlukDegerlendir(karisik);
  t('sırasız okuma dizisi doğru sıralanıyor', s.durum === 'DURGUN', s);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
