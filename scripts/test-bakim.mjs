// PERİYODİK BAKIM PLANI — eşikler ve "bilmiyorum" halleri
// Çalıştır:  node scripts/test-bakim.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Fotokopi bakımı takvimle değil SAYAÇLA gelir. Bu hesabın iki yönde de
// yanlış olması pahalıdır:
//
//   ERKEN söylerse bayi boşuna parça takar ve yola çıkar.
//   GEÇ söylerse bakım kaçar; kaçan bakım arızaya, arıza da sözleşmedeki
//   müdahale süresinin tutturulamamasına döner.
//
// Asıl tehlike ise ÜÇÜNCÜSÜ: bilinmeyeni "zamanı gelmedi" diye göstermek.
// Politikası girilmemiş ya da ilk bakım referansı olmayan cihaz yeşil
// görünürse bayi o makineyi hiç planlamaz ve makine habersiz ölür.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-bakim-'));
let mod, toner;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/bakim.ts'), join(KOK, 'src/lib/toner.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck',
  ], { stdio: 'pipe' });
  mod = await import(pathToFileURL(join(g, 'bakim.js')).href);
  toner = await import(pathToFileURL(join(g, 'toner.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { bakimDurumu, bakimOzeti, bakimSira, politikaVar, YAKLASTI_GUN } = mod;
const { dailyRate } = toner;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const gun = (n) => new Date(Date.UTC(2026, 8, 17) - n * 86400000);
const BUGUN = new Date(Date.UTC(2026, 8, 17));
const girdi = (p) => ({
  sonBakimTarihi: null, sonBakimSayaci: null, guncelSayac: null,
  gunlukHiz: null, bugun: BUGUN, ...p,
});

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ POLİTİKA YOKSA "ZAMANI GELMEDİ" DEMİYORUZ');
// ───────────────────────────────────────────────────────────────────────────
{
  t('politikaVar: ikisi de boş → false', politikaVar({ sayfaAraligi: null, ayAraligi: null }) === false);
  t('politikaVar: sayfa aralığı varsa → true', politikaVar({ sayfaAraligi: 150000, ayAraligi: null }) === true);
  t('politikaVar: sıfır aralık politika sayılmaz', politikaVar({ sayfaAraligi: 0, ayAraligi: 0 }) === false);

  const s = bakimDurumu({ sayfaAraligi: null, ayAraligi: null }, girdi({ guncelSayac: 500000 }));
  t('★ politikasız cihaz BİLİNMİYOR (PLANLI değil)', s.durum === 'BILINMIYOR' && s.sebep === 'POLITIKA_YOK', s);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ BAŞLANGIÇ REFERANSI OLMADAN SAYFA HESABI YOK');
// ───────────────────────────────────────────────────────────────────────────
{
  // Sayfa politikası var, son bakım sayacı yok → hesaplanamaz.
  const s = bakimDurumu({ sayfaAraligi: 150000, ayAraligi: null },
    girdi({ guncelSayac: 500000, gunlukHiz: 300 }));
  t('★ ilk bakım referansı yoksa BİLİNMİYOR', s.durum === 'BILINMIYOR' && s.sebep === 'BASLANGIC_YOK', s);

  // Sayaç hiç okunmamış.
  const s2 = bakimDurumu({ sayfaAraligi: 150000, ayAraligi: null },
    girdi({ sonBakimSayaci: 300000, guncelSayac: null }));
  t('★ sayaç okunmamışsa BİLİNMİYOR', s2.durum === 'BILINMIYOR' && s2.sebep === 'SAYAC_YOK', s2);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ SAYFA EŞİĞİ');
// ───────────────────────────────────────────────────────────────────────────
const POL = { sayfaAraligi: 150000, ayAraligi: null };
{
  const uzak = bakimDurumu(POL, girdi({
    sonBakimSayaci: 300000, guncelSayac: 320000, gunlukHiz: 300,
  }));
  t('20.000 basılmış → planlı', uzak.durum === 'PLANLI', uzak.durum);
  t('kalan sayfa 130.000', uzak.sayfaKalan === 130000, uzak.sayfaKalan);
  t('kalan gün 433 (130000/300)', uzak.gunKalan === 433, uzak.gunKalan);
  t('tahmini tarih üretiliyor', typeof uzak.tahminiTarih === 'string');

  const yakin = bakimDurumu(POL, girdi({
    sonBakimSayaci: 300000, guncelSayac: 447000, gunlukHiz: 300,
  }));
  // 3.000 sayfa kaldı, günde 300 → 10 gün.
  t('★ 10 gün kalan YAKLAŞTI', yakin.durum === 'YAKLASTI' && yakin.gunKalan === 10, yakin);

  const gecti_ = bakimDurumu(POL, girdi({
    sonBakimSayaci: 300000, guncelSayac: 455000, gunlukHiz: 300,
  }));
  t('★ eşik aşıldı → GECİKTİ', gecti_.durum === 'GECIKTI' && gecti_.sebep === 'SAYFA', gecti_);
  t('aşılan sayfa eksi gösteriliyor', gecti_.sayfaKalan === -5000, gecti_.sayfaKalan);

  // Tam sınır: kalan 0 → geçmiş sayılır (bakım kiti dolmuştur).
  const sinir = bakimDurumu(POL, girdi({ sonBakimSayaci: 300000, guncelSayac: 450000, gunlukHiz: 300 }));
  t('tam eşikte GECİKTİ', sinir.durum === 'GECIKTI', sinir.durum);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ HIZ BİLİNMİYORSA TARİH SÖYLEMİYORUZ');
// ───────────────────────────────────────────────────────────────────────────
{
  const s = bakimDurumu(POL, girdi({ sonBakimSayaci: 300000, guncelSayac: 320000, gunlukHiz: null }));
  t('★ hız yoksa gün ve tarih null', s.gunKalan === null && s.tahminiTarih === null, s);
  t('kalan sayfa yine de söyleniyor', s.sayfaKalan === 130000);
  t('durum planlı', s.durum === 'PLANLI');

  // Hız yokken "yaklaştı" kararı ORANLA verilir: aralığın %10'u kaldıysa.
  const yakin = bakimDurumu(POL, girdi({ sonBakimSayaci: 300000, guncelSayac: 440000, gunlukHiz: null }));
  t('★ hız yokken %10 kaldıysa YAKLAŞTI', yakin.durum === 'YAKLASTI' && yakin.gunKalan === null, yakin);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ SÜRE EŞİĞİ');
// ───────────────────────────────────────────────────────────────────────────
{
  const pol = { sayfaAraligi: null, ayAraligi: 12 };
  const yeni = bakimDurumu(pol, girdi({ sonBakimTarihi: gun(60) }));
  t('2 ay önce bakım yapılmış → planlı', yeni.durum === 'PLANLI', yeni);
  t('geçen ay 1', yeni.gecenAy === 1, yeni.gecenAy);

  const gecmis = bakimDurumu(pol, girdi({ sonBakimTarihi: gun(400) }));
  t('★ 13 ay geçmiş → GECİKTİ (AY)', gecmis.durum === 'GECIKTI' && gecmis.sebep === 'AY', gecmis);

  const yakin = bakimDurumu(pol, girdi({ sonBakimTarihi: gun(340) }));
  t('★ 11 ay geçmiş → YAKLAŞTI', yakin.durum === 'YAKLASTI' && yakin.sebep === 'AY', yakin);

  const referanssiz = bakimDurumu(pol, girdi({ sonBakimTarihi: null }));
  t('★ süre politikasında da referans şart', referanssiz.durum === 'BILINMIYOR', referanssiz);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ İKİ EŞİK BİRLİKTE — HANGİSİ ÖNCE DOLARSA');
// ───────────────────────────────────────────────────────────────────────────
{
  const pol = { sayfaAraligi: 150000, ayAraligi: 12 };

  // Az basan makine: sayfa uzak ama süre dolmuş.
  const azBasan = bakimDurumu(pol, girdi({
    sonBakimTarihi: gun(400), sonBakimSayaci: 300000, guncelSayac: 310000, gunlukHiz: 25,
  }));
  t('★ az basan makinede SÜRE tetikliyor', azBasan.durum === 'GECIKTI' && azBasan.sebep === 'AY', azBasan);

  // Çok basan makine: süre yeni ama sayfa dolmuş.
  const cokBasan = bakimDurumu(pol, girdi({
    sonBakimTarihi: gun(60), sonBakimSayaci: 300000, guncelSayac: 460000, gunlukHiz: 2500,
  }));
  t('★ çok basan makinede SAYFA tetikliyor', cokBasan.durum === 'GECIKTI' && cokBasan.sebep === 'SAYFA', cokBasan);

  // İkisi de dolmuşsa SAYFA yazılır: bakımı asıl tetikleyen aşınmadır.
  const ikisi = bakimDurumu(pol, girdi({
    sonBakimTarihi: gun(400), sonBakimSayaci: 300000, guncelSayac: 460000, gunlukHiz: 400,
  }));
  t('ikisi de dolduysa sebep SAYFA', ikisi.sebep === 'SAYFA', ikisi.sebep);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ HIZ, TONER TAHMİNİYLE AYNI KAYNAKTAN');
// ───────────────────────────────────────────────────────────────────────────
{
  // İki ekranın aynı cihaz için farklı tarih söylememesi için hız tek yerden.
  const okumalar = [
    { readingDate: '2026-08-17T00:00:00Z', counterBlack: 300000, counterColor: 0 },
    { readingDate: '2026-09-16T00:00:00Z', counterBlack: 309000, counterColor: 0 },
  ];
  const hiz = dailyRate(okumalar, 'black');
  t('günlük hız 300 sayfa', Math.round(hiz) === 300, hiz);

  const s = bakimDurumu(POL, girdi({ sonBakimSayaci: 300000, guncelSayac: 309000, gunlukHiz: hiz }));
  t('★ aynı hızla bakım tahmini üretiliyor', s.gunKalan === 470, s.gunKalan);

  t('tek okumada hız yok', dailyRate([okumalar[0]], 'black') === null);
  t('aynı gün iki okumada hız yok', dailyRate([
    { readingDate: '2026-09-16T08:00:00Z', counterBlack: 1, counterColor: 0 },
    { readingDate: '2026-09-16T12:00:00Z', counterBlack: 100, counterColor: 0 },
  ], 'black') === null);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ SIRALAMA VE ÖZET');
// ───────────────────────────────────────────────────────────────────────────
{
  const geciken = bakimDurumu(POL, girdi({ sonBakimSayaci: 300000, guncelSayac: 460000, gunlukHiz: 300 }));
  const yaklasan = bakimDurumu(POL, girdi({ sonBakimSayaci: 300000, guncelSayac: 448000, gunlukHiz: 300 }));
  const planli = bakimDurumu(POL, girdi({ sonBakimSayaci: 300000, guncelSayac: 310000, gunlukHiz: 300 }));
  const bilinmeyen = bakimDurumu({ sayfaAraligi: null, ayAraligi: null }, girdi({}));

  t('★ geciken en başa sıralanıyor', bakimSira(geciken) < bakimSira(yaklasan));
  t('yaklaşan planlıdan önce', bakimSira(yaklasan) < bakimSira(planli));
  t('★ bilinmeyen en sonda ama listede', bakimSira(bilinmeyen) > bakimSira(planli));

  const o = bakimOzeti([geciken, yaklasan, yaklasan, planli, bilinmeyen]);
  t('özet: 1 geciken', o.geciken === 1, o);
  t('özet: 2 yaklaşan', o.yaklasan === 2);
  t('özet: 1 planlı', o.planli === 1);
  t('★ özet: politikasız cihaz ayrı sayılıyor', o.politikasiz === 1, o.politikasiz);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
