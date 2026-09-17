// TEKNİSYEN KARNESİ — SAF HESAP
// Çalıştır:  node scripts/test-teknisyen.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Bu ekran bir insanı ölçüyor. Yanlış sayı üretmenin bedeli burada başka
// ekranlardan ağır: haksız bir "tekrar çağrı" ya da az veriden çıkarılmış bir
// oran, doğrudan birinin hakkında hüküm olur.
//
// Testin asıl konusu bu yüzden HÜKÜM VERMEDİĞİMİZ yerler:
//   · daha bekleme süresi dolmamış iş "ilk seferde çözüldü" sayılmamalı,
//   · kategorisiz fiş ölçüye girmemeli,
//   · sonrasında kategorisiz ziyaret varsa hüküm belirsiz kalmalı,
//   · az işten oran yayımlanmamalı,
//   · atanmamış fiş asla puanlanmamalı.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-teknisyen-'));
let mod;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/teknisyen.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck',
  ], { stdio: 'pipe' });
  mod = await import(pathToFileURL(join(g, 'teknisyen.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { fisYargisi, ortanca, karneCikar, TEKRAR_GUN, EN_AZ_FIS } = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const BUGUN = new Date(Date.UTC(2026, 8, 17));
const gunOnce = (n) => new Date(BUGUN.getTime() - n * 86400000);

let sayac = 0;
/** Kısa fiş kurucu — varsayılanı: kapanmış, ölçülebilir, arıza fişi. */
const fis = (ek = {}) => ({
  id: `f${++sayac}`,
  ticketNumber: `TSK-${sayac}`,
  teknisyenId: 'tek-1',
  teknisyenAdi: 'Ali',
  cihazId: 'c1',
  cihaz: 'Kyocera TASKalfa X',
  musteri: 'Müşteri A',
  kategori: 'FUSER',
  arizaMi: true,
  acilis: gunOnce(90),
  cozum: gunOnce(89),
  acik: false,
  kapanisYaklasik: false,
  iptal: false,
  sureOlculemez: false,
  mudahaleDk: 60,
  cozumDk: 120,
  pencerede: true,
  ...ek,
});

console.log('\nTeknisyen karnesi — saf hesap\n');

// ── HÜKÜM: TEKRAR ÇAĞRI ──────────────────────────────────────────────────
{
  const ilk = fis({ cozum: gunOnce(80) });
  const geri = fis({ acilis: gunOnce(75), cozum: gunOnce(74) });
  const y = fisYargisi(ilk, [ilk, geri], BUGUN);
  t('aynı cihaz + aynı kategori + pencere içi = tekrar çağrı', y.yargi === 'TEKRAR_GELDI', y);
  t('tekrar çağrının fiş numarası veriliyor', y.tekrarFisNo === geri.ticketNumber, y);
  t('aradaki gün hesaplanıyor', y.tekrarGun === 5, y);
}
{
  const ilk = fis({ cozum: gunOnce(80), kategori: 'FUSER' });
  const baska = fis({ acilis: gunOnce(75), kategori: 'PAPER_JAM' });
  t('★ FARKLI kategori tekrar sayılmaz', fisYargisi(ilk, [ilk, baska], BUGUN).yargi === 'ILK_SEFERDE');
}
{
  const ilk = fis({ cozum: gunOnce(80), cihazId: 'c1' });
  const baskaCihaz = fis({ acilis: gunOnce(75), cihazId: 'c2' });
  // Motor cihaz bazlı listeyle çağrılır; başka cihazın fişi listeye girmez.
  t('★ BAŞKA cihazın aynı arızası tekrar sayılmaz', fisYargisi(ilk, [ilk], BUGUN).yargi === 'ILK_SEFERDE', baskaCihaz.id);
}
{
  const ilk = fis({ cozum: gunOnce(80) });
  const gec = fis({ acilis: gunOnce(80 - TEKRAR_GUN - 1) });
  t('★ pencere DIŞINDA geri dönüş tekrar sayılmaz', fisYargisi(ilk, [ilk, gec], BUGUN).yargi === 'ILK_SEFERDE');
}
{
  const ilk = fis({ cozum: gunOnce(80) });
  const tamSinir = fis({ acilis: new Date(ilk.cozum.getTime() + TEKRAR_GUN * 86400000) });
  t('pencerenin tam sınırı tekrar sayılır', fisYargisi(ilk, [ilk, tamSinir], BUGUN).yargi === 'TEKRAR_GELDI');
}
{
  const ilk = fis({ cozum: gunOnce(80) });
  const bakim = fis({ acilis: gunOnce(75), kategori: 'PERIODIC_MAINTENANCE', arizaMi: false });
  t('★ periyodik bakım ziyareti tekrar sayılmaz', fisYargisi(ilk, [ilk, bakim], BUGUN).yargi === 'ILK_SEFERDE');
}
{
  const ilk = fis({ cozum: gunOnce(80) });
  const iptal = fis({ acilis: gunOnce(75), iptal: true });
  t('iptal edilmiş geri dönüş tekrar sayılmaz', fisYargisi(ilk, [ilk, iptal], BUGUN).yargi === 'ILK_SEFERDE');
}
{
  const ilk = fis({ cozum: gunOnce(80) });
  const once = fis({ acilis: gunOnce(85), cozum: gunOnce(84) });
  t('★ ÖNCE açılmış fiş tekrar sayılmaz', fisYargisi(ilk, [ilk, once], BUGUN).yargi === 'ILK_SEFERDE');
}

// ── HÜKÜM VERİLMEYEN HALLER ──────────────────────────────────────────────
{
  const yeni = fis({ cozum: gunOnce(3) });
  const y = fisYargisi(yeni, [yeni], BUGUN);
  t('★ bekleme süresi dolmamış iş "ilk seferde" sayılmaz', y.yargi === 'BEKLEMEDE', y);
}
{
  const tam = fis({ cozum: gunOnce(TEKRAR_GUN + 1) });
  t('bekleme süresi dolmuşsa hüküm veriliyor', fisYargisi(tam, [tam], BUGUN).yargi === 'ILK_SEFERDE');
}
{
  const f = fis({ kategori: null, arizaMi: false });
  const y = fisYargisi(f, [f], BUGUN);
  t('★ kategorisiz fiş ölçüye girmez', y.yargi === 'KAPSAM_DISI' && y.sebep === 'KATEGORI_YOK', y);
}
{
  const ilk = fis({ cozum: gunOnce(80) });
  const kategorisiz = fis({ acilis: gunOnce(75), kategori: null, arizaMi: false });
  const y = fisYargisi(ilk, [ilk, kategorisiz], BUGUN);
  t('★ sonrasında kategorisiz ziyaret varsa hüküm BELİRSİZ', y.yargi === 'BELIRSIZ' && y.sebep === 'SONRAKI_KATEGORI_YOK', y);
}
{
  const ilk = fis({ cozum: gunOnce(80) });
  const gercekTekrar = fis({ acilis: gunOnce(78) });
  const kategorisiz = fis({ acilis: gunOnce(75), kategori: null, arizaMi: false });
  t('kesin tekrar, belirsizliğe göre önceliklidir',
    fisYargisi(ilk, [ilk, gercekTekrar, kategorisiz], BUGUN).yargi === 'TEKRAR_GELDI');
}
{
  const f = fis({ cozum: null, acik: true });
  const y = fisYargisi(f, [f], BUGUN);
  t('★ hâlâ açık iş ölçüye girmez', y.yargi === 'KAPSAM_DISI' && y.sebep === 'ACIK', y);
}
{
  // Kapanmış ama kapanış anı hiç bilinmiyor: pencere kurulamaz.
  const f = fis({ cozum: null, acik: false });
  const y = fisYargisi(f, [f], BUGUN);
  t('★ kapanış anı bilinmeyen fiş hüküm almaz', y.yargi === 'KAPSAM_DISI' && y.sebep === 'KAPANIS_BILINMIYOR', y);
}
{
  // Yaklaşık kapanış anı hükme YETER; ekran sayısını yazsın diye sayılır.
  const f = fis({ cozum: gunOnce(80), kapanisYaklasik: true });
  const r = karneCikar([f], BUGUN);
  t('★ yaklaşık kapanışlı fiş hüküm alıyor', r.karneler[0].ilkSeferde === 1, r.karneler[0]);
  t('★ yaklaşık hüküm sayısı tutuluyor', r.ozet.yaklasik === 1, r.ozet);
}
{
  const f = fis({ iptal: true });
  t('iptal fiş ölçüye girmez', fisYargisi(f, [f], BUGUN).sebep === 'IPTAL');
}
{
  const f = fis({ kategori: 'INSTALLATION', arizaMi: false });
  const y = fisYargisi(f, [f], BUGUN);
  t('★ kurulum arıza değil, ölçüye girmez', y.yargi === 'KAPSAM_DISI' && y.sebep === 'ARIZA_DEGIL', y);
}

// ── ORTANCA ──────────────────────────────────────────────────────────────
t('ortanca tek sayıda ortadaki', ortanca([10, 30, 20]) === 20);
t('ortanca çift sayıda ikisinin ortası', ortanca([10, 20, 30, 40]) === 25);
t('★ ortanca uç değerden etkilenmiyor', ortanca([10, 20, 30, 10000]) === 25);
t('boş listede ortanca yok', ortanca([]) === null);

// ── KARNE ────────────────────────────────────────────────────────────────
{
  // Ali: 6 kapanmış arıza, 1 tanesi geri gelmiş → 5/6.
  const fisler = [];
  for (let i = 0; i < 6; i++) {
    fisler.push(fis({ cihazId: `c${i}`, cozum: gunOnce(80 - i), mudahaleDk: 30 + i, cozumDk: 100 + i }));
  }
  fisler.push(fis({ cihazId: 'c0', acilis: gunOnce(78), cozum: gunOnce(77), pencerede: false }));
  const r = karneCikar(fisler, BUGUN);
  const ali = r.karneler[0];
  t('teknisyen karnesi çıkıyor', r.karneler.length === 1 && ali.teknisyenAdi === 'Ali', r.karneler.length);
  t('tekrar sayılıyor', ali.tekrar === 1, ali);
  t('ilk seferde sayılıyor', ali.ilkSeferde === 5, ali);
  t('★ oran = ilk seferde / ölçülen', Math.abs(ali.ilkSeferdeYuzde - 500 / 6) < 1e-9, ali.ilkSeferdeYuzde);
  t('★ pencere dışı fiş karnede sayılmıyor', ali.fis === 6, ali.fis);
  t('tekrar listesi işin kendisini veriyor', r.tekrarlar.length === 1 && r.tekrarlar[0].cihaz.includes('Kyocera'), r.tekrarlar);
  t('süre ortancaları hesaplanıyor', ali.cozumOrtancaDk === 103 && ali.mudahaleOrtancaDk === 33, [ali.mudahaleOrtancaDk, ali.cozumOrtancaDk]);
  t('özet oranı da üretiyor', Math.abs(r.ozet.ilkSeferdeYuzde - 500 / 6) < 1e-9, r.ozet);
}
{
  // Üç işten ikisi geri gelmiş: oran YAYIMLANMAZ.
  const fisler = [
    fis({ cihazId: 'a', cozum: gunOnce(80) }),
    fis({ cihazId: 'a', acilis: gunOnce(78), cozum: gunOnce(77), pencerede: false }),
    fis({ cihazId: 'b', cozum: gunOnce(80) }),
    fis({ cihazId: 'b', acilis: gunOnce(78), cozum: gunOnce(77), pencerede: false }),
    fis({ cihazId: 'c', cozum: gunOnce(80) }),
  ];
  const k = karneCikar(fisler, BUGUN).karneler[0];
  t('★ AZ İŞ: oran yayımlanmıyor', k.ilkSeferdeYuzde === null && k.oranYok === 'AZ_IS', k);
  t('az işte de ham sayılar duruyor', k.tekrar === 2 && k.ilkSeferde === 1, k);
  t('eşik bilgisi dışa veriliyor', EN_AZ_FIS === 5);
}
{
  // ÖLÇEK: bicim.ts yuzde() 0-100 bekler. Kesir döndürülürse ekran "%100"
  // yerine "%1" yazar — bu test tam olarak o hatayı yakalamak için var.
  const fisler = [];
  for (let i = 0; i < 5; i++) fisler.push(fis({ cihazId: `o${i}`, cozum: gunOnce(80) }));
  fisler.push(fis({ cihazId: 'o0', acilis: gunOnce(78), cozum: gunOnce(77), pencerede: false }));
  const k = karneCikar(fisler, BUGUN).karneler[0];
  t('★ yüzde 0-100 ÖLÇEĞİNDE (4/5 = 80)', k.ilkSeferdeYuzde === 80, k.ilkSeferdeYuzde);
}
{
  const fisler = [fis({ teknisyenId: null, teknisyenAdi: null, cozum: gunOnce(80) })];
  const r = karneCikar(fisler, BUGUN);
  t('★ atanmamış fiş teknisyen listesine girmiyor', r.karneler.length === 0, r.karneler);
  t('★ atanmamış fiş ayrı satırda ve puansız', r.atanmamis?.fis === 1 && r.atanmamis?.ilkSeferdeYuzde === null, r.atanmamis);
  t('atanmamış fiş özet toplamında görünüyor', r.ozet.atanmamis === 1 && r.ozet.fis === 1, r.ozet);
}
{
  const fisler = [
    fis({ teknisyenId: 'a', teknisyenAdi: 'Ali', cihazId: 'x', cozum: gunOnce(80) }),
    fis({ teknisyenId: 'a', teknisyenAdi: 'Ali', cihazId: 'x', acilis: gunOnce(78), cozum: gunOnce(77), pencerede: false }),
    fis({ teknisyenId: 'v', teknisyenAdi: 'Veli', cihazId: 'y', cozum: gunOnce(80) }),
  ];
  const r = karneCikar(fisler, BUGUN, [{ id: 'a', ad: 'Ali' }, { id: 'v', ad: 'Veli' }, { id: 'z', ad: 'Zeynep' }]);
  t('★ en çok tekrarı olan üstte', r.karneler[0].teknisyenAdi === 'Ali', r.karneler.map((k) => k.teknisyenAdi));
  t('★ dönemde iş almamış teknisyen listede kalıyor',
    r.karneler.some((k) => k.teknisyenAdi === 'Zeynep' && k.fis === 0), r.karneler.map((k) => [k.teknisyenAdi, k.fis]));
  t('iş almamış teknisyende oran yok', r.karneler.find((k) => k.teknisyenAdi === 'Zeynep').oranYok === 'OLCUM_YOK');
}
{
  const fisler = [
    fis({ sureOlculemez: true, cozum: gunOnce(80), cozumDk: 999 }),
    fis({ cihazId: 'q', cozum: gunOnce(80), cozumDk: 200 }),
  ];
  const k = karneCikar(fisler, BUGUN).karneler[0];
  t('★ türetilmiş geçmişin süresi ortancaya girmiyor', k.cozumOrtancaDk === 200 && k.sureOlculen === 1, k);
  t('ama fişi sayılıyor', k.fis === 2, k.fis);
}
{
  const fisler = [
    fis({ cozum: null, acik: true, cihazId: 'w' }),
    fis({ kategori: 'CONSUMABLE', arizaMi: false, cihazId: 'e' }),
    fis({ kategori: null, arizaMi: false, cihazId: 'r' }),
  ];
  const k = karneCikar(fisler, BUGUN).karneler[0];
  t('açık iş sayılıyor', k.acik === 1, k);
  t('planlı ziyaret ayrı sayılıyor', k.planli === 1 && k.ariza === 1, k);
  t('kategorisiz fiş ayrı sayılıyor', k.kategorisiz === 1, k);
  t('★ hiçbiri orana girmiyor', k.ilkSeferdeYuzde === null && k.oranYok === 'OLCUM_YOK', k);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
