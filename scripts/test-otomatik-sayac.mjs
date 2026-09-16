// CİHAZDAN OTOMATİK SAYAÇ — cihaz başına durum
// Çalıştır:  node scripts/test-otomatik-sayac.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu ekran bayinin iş listesi olacak. Yanlış hüküm verirse iki yönde de
// pahalı: "durdu" diyemezsek faturalanmayan sayfalar sessizce birikir,
// gereksiz "durdu" dersek bayi çalışan cihazların peşinde koşar ve bir
// süre sonra listeye hiç bakmaz. Test ettiklerim:
//
//   1. TEK GÖNDERİMDEN ARALIK UYDURULMUYOR — bir ölçümün aralığı yoktur.
//   2. ORTANCA KULLANILIYOR: tek gecikmiş rapor eşiği bozmamalı.
//   3. SIK GÖNDEREN CİHAZ 45 GÜN BEKLEMİYOR — haftalık gönderen üç hafta
//      sustuysa bu zaten arızadır.
//   4. YENİ KURULAN CİHAZ "DURDU" SAYILMIYOR — daha durmaya vakti olmadı.
//   5. İŞ SIRASI: önce para kaybettiren DURDU, sonra KURULMADI.
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-otosayac-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/otomatik-sayac.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

const {
  cihazDurumu, araligiOlc, sessizlikEsigi, filoOzeti, siraAnahtari, ortanca, gunFarki,
  VARSAYILAN_SESSIZLIK_GUN, EN_AZ_ESIK_GUN,
} = await import(pathToFileURL(join(g, 'otomatik-sayac.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const SIMDI = new Date('2026-09-16T12:00:00');
const gunOnce = (n) => new Date(SIMDI.getTime() - n * 86_400_000);

console.log('\n★ HİÇ GÖNDERMEYEN CİHAZ\n');
{
  const d = cihazDurumu([], SIMDI);
  t('durum KURULMADI', d.durum === 'KURULMADI', d);
  t('son gönderim null', d.sonGonderim === null);
  t('★ gönderim yokken aralık UYDURULMUYOR', d.araGun === null);
  t('sessiz gün null (sayacak bir şey yok)', d.sessizGun === null);
}

console.log('\n★ TEK GÖNDERİMDEN ARALIK ÇIKARILMIYOR\n');
{
  t('★ tek tarihten aralık null', araligiOlc([gunOnce(10)]) === null);
  t('boş listeden aralık null', araligiOlc([]) === null);
  t('iki tarihten aralık ölçülüyor', araligiOlc([gunOnce(40), gunOnce(10)]) === 30);
  t('aynı gün iki gönderim aralık üretmiyor', araligiOlc([gunOnce(5), gunOnce(5)]) === null);
  t('sırasız girdi doğru aralık veriyor', araligiOlc([gunOnce(10), gunOnce(70), gunOnce(40)]) === 30);
}

console.log('\n★ ORTANCA — TEK GECİKMİŞ RAPOR EŞİĞİ BOZMUYOR\n');
{
  // Aylık gönderen cihaz bir kez 90 gün gecikmiş. Ortalama 45'e fırlardı,
  // ortanca 30'da kalır.
  const tarihler = [gunOnce(210), gunOnce(180), gunOnce(150), gunOnce(60), gunOnce(30)];
  t('★ ortanca 30 (ortalama 45 olurdu)', araligiOlc(tarihler) === 30, araligiOlc(tarihler));
  t('ortanca tek sayıda doğru', ortanca([10, 30, 50]) === 30);
  t('ortanca çift sayıda ortalama alıyor', ortanca([10, 20, 30, 40]) === 25);
  t('boş dizide ortanca null', ortanca([]) === null);
}

console.log('\n★ EŞİK — SIK GÖNDEREN CİHAZ 45 GÜN BEKLEMİYOR\n');
{
  t('aralık bilinmiyorsa 45 gün', sessizlikEsigi(null) === VARSAYILAN_SESSIZLIK_GUN);
  t('★ haftalık gönderen 14 günde durmuş sayılır', sessizlikEsigi(7) === EN_AZ_ESIK_GUN, sessizlikEsigi(7));
  t('aylık gönderen için 45 (2×30 kırpılır)', sessizlikEsigi(30) === 45);
  t('★ çok seyrek gönderende eşik 45i AŞMIYOR', sessizlikEsigi(90) === 45, sessizlikEsigi(90));
  t('iki haftalık gönderende 28 gün', sessizlikEsigi(14) === 28);
  t('★ çok sık gönderende taban 14 (3 günde bir → 14, 6 değil)', sessizlikEsigi(3) === 14);
}

console.log('\n★ ÇALIŞAN CİHAZ\n');
{
  const d = cihazDurumu([gunOnce(62), gunOnce(31), gunOnce(2)], SIMDI);
  t('durum OTOMATIK', d.durum === 'OTOMATIK', d);
  t('gönderim sayısı 3', d.gonderimSayisi === 3);
  t('aralık ~30', d.araGun === 30 || d.araGun === 31, d.araGun);
  t('açıklama gün söylüyor', /2 gün önce/.test(d.aciklama), d.aciklama);

  const bugun = cihazDurumu([gunOnce(0)], SIMDI);
  t('bugün gönderen için özel cümle', bugun.aciklama === 'Bugün gönderdi.', bugun.aciklama);
}

console.log('\n★ YENİ KURULAN CİHAZ "DURDU" SAYILMIYOR\n');
{
  // Dün ilk raporunu gönderdi. Aralığı bilinmiyor ama durmaya vakti olmadı.
  const d = cihazDurumu([gunOnce(1)], SIMDI);
  t('★ dün kurulan cihaz OTOMATIK', d.durum === 'OTOMATIK', d);
  const kirkDort = cihazDurumu([gunOnce(44)], SIMDI);
  t('44 gün sessiz hâlâ OTOMATIK (sınırın altı)', kirkDort.durum === 'OTOMATIK', kirkDort);
  const kirkAlti = cihazDurumu([gunOnce(46)], SIMDI);
  t('★ 46 gün sessiz DURDU', kirkAlti.durum === 'DURDU', kirkAlti);
}

console.log('\n★ DURAN CİHAZ — ASIL PARA KAYBI\n');
{
  const d = cihazDurumu([gunOnce(200), gunOnce(170), gunOnce(140)], SIMDI);
  t('durum DURDU', d.durum === 'DURDU', d);
  t('sessiz gün 140', d.sessizGun === 140, d.sessizGun);
  t('★ açıklama hem aralığı hem sessizliği söylüyor',
    /30 günde bir/.test(d.aciklama) && /140 gündür/.test(d.aciklama), d.aciklama);

  const tekSefer = cihazDurumu([gunOnce(90)], SIMDI);
  t('★ bir kez gönderip kesilen ayrı cümle alıyor',
    /bir kez gönderip kesildi/.test(tekSefer.aciklama), tekSefer.aciklama);
}

console.log('\n★ FİLO ÖZETİ\n');
{
  const o = filoOzeti(['OTOMATIK', 'OTOMATIK', 'DURDU', 'KURULMADI', 'KURULMADI', 'KURULMADI']);
  t('toplam 6', o.toplam === 6);
  t('otomatik 2', o.otomatik === 2);
  t('durdu 1', o.durdu === 1);
  t('kurulmadı 3', o.kurulmadi === 3);
  t('★ oran %33', o.oran === 33, o.oran);
  t('cihaz yoksa oran null (sıfıra bölme yok)', filoOzeti([]).oran === null);
  t('hepsi otomatikse %100', filoOzeti(['OTOMATIK']).oran === 100);
}

console.log('\n★ İŞ SIRASI — ÖNCE PARA KAYBETTİREN\n');
{
  const durdu = cihazDurumu([gunOnce(200), gunOnce(170)], SIMDI);
  const durduDahaUzun = cihazDurumu([gunOnce(400), gunOnce(370)], SIMDI);
  const kurulmadi = cihazDurumu([], SIMDI);
  const otomatik = cihazDurumu([gunOnce(1)], SIMDI);

  t('★ DURDU, KURULMADIdan önce', siraAnahtari(durdu) < siraAnahtari(kurulmadi));
  t('★ KURULMADI, OTOMATIKten önce', siraAnahtari(kurulmadi) < siraAnahtari(otomatik));
  t('★ uzun süredir susan önce gelir', siraAnahtari(durduDahaUzun) < siraAnahtari(durdu));

  const sirali = [otomatik, kurulmadi, durdu, durduDahaUzun]
    .sort((a, b) => siraAnahtari(a) - siraAnahtari(b)).map((d) => d.durum);
  t('tam sıra doğru', JSON.stringify(sirali) === JSON.stringify(['DURDU', 'DURDU', 'KURULMADI', 'OTOMATIK']), sirali);
}

console.log('\n★ BOZUK GİRDİ PATLATMIYOR\n');
{
  t('geçersiz tarih atılıyor', cihazDurumu(['bu tarih değil'], SIMDI).durum === 'KURULMADI');
  t('metin tarih kabul ediliyor', cihazDurumu(['2026-09-15T10:00:00'], SIMDI).durum === 'OTOMATIK');
  t('★ gelecek tarihli okuma eksi gün üretmiyor', gunFarki(new Date(SIMDI.getTime() + 86_400_000), SIMDI) === 0);
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
