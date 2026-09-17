// TOPLU CİHAZ AYARI — SAF PLAN
// Çalıştır:  node scripts/test-toplu-ayar.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Toplu yazma, sistemdeki en tehlikeli işlemlerden biri: tek tıkla yüzlerce
// cihazın pazarlıkla girilmiş değeri silinebilir ve geri alınamaz.
//
// Testin konusu bu yüzden NE YAZMADIĞIMIZ:
//   · varsayılan "yalnız boşları doldur" gerçekten doluyu koruyor mu,
//   · ezme açıkken kaç cihazın ezileceği DOĞRU sayılıyor mu (ekran bu
//     sayıyı onay kutusunda gösteriyor),
//   · "kiraya dahil sayfa" satılmış cihaza yazılmıyor mu,
//   · boş bırakılan alana dokunulmuyor mu.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-topluayar-'));
let mod;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/toplu-ayar.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck',
  ], { stdio: 'pipe' });
  mod = await import(pathToFileURL(join(g, 'toplu-ayar.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { ayarPlani, AYAR_ALANLARI, KIRA_ALANLARI } = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

let sayac = 0;
const cihaz = (ek = {}) => ({
  id: `c${++sayac}`,
  etiket: `Kyocera TASKalfa · S${sayac}`,
  musteri: 'Müşteri',
  kiralik: true,
  includedBlack: null,
  includedColor: null,
  pmIntervalPages: null,
  pmIntervalMonths: null,
  ...ek,
});
const istek = (ek = {}) => ({ degerler: { includedBlack: 2000 }, yalnizBos: true, yalnizKiralik: true, ...ek });

console.log('\nToplu cihaz ayarı — saf plan\n');

// ── BOŞ ALANI DOLDURMA ───────────────────────────────────────────────────
{
  const p = ayarPlani([cihaz()], istek());
  t('boş alan dolduruluyor', p.satirlar.length === 1 && p.satirlar[0].degisim.includedBlack.yeni === 2000, p);
  t('eski değer null olarak taşınıyor', p.satirlar[0].degisim.includedBlack.eski === null, p.satirlar[0]);
  t('ezilecek sayısı sıfır', p.ezilecek === 0, p.ezilecek);
}

// ── ★ DOLU ALANI EZMEME ──────────────────────────────────────────────────
{
  const p = ayarPlani([cihaz({ includedBlack: 5000 })], istek());
  t('★ dolu alan varsayılan olarak EZİLMİYOR', p.satirlar.length === 0, p.satirlar);
  t('★ atlama sebebi "dolu" diye sayılıyor', p.atlanan.DOLU === 1, p.atlanan);
}
{
  const p = ayarPlani([cihaz({ includedBlack: 5000 })], istek({ yalnizBos: false }));
  t('★ ezme açıkken dolu alan yazılıyor', p.satirlar.length === 1, p.satirlar);
  t('★ ezilecek cihaz SAYILIYOR (onay kutusunda gösterilen sayı)', p.ezilecek === 1, p.ezilecek);
  t('eski değer korunuyor', p.satirlar[0].degisim.includedBlack.eski === 5000, p.satirlar[0]);
}
{
  // Sıfır "tanımlanmamış" sayılır: paket sıfırken doldurmak ezme değildir.
  const p = ayarPlani([cihaz({ includedBlack: 0 })], istek());
  t('★ sıfır değer "dolu" sayılmıyor', p.satirlar.length === 1 && p.ezilecek === 0, p);
}

// ── AYNI DEĞER ───────────────────────────────────────────────────────────
{
  const p = ayarPlani([cihaz({ includedBlack: 2000 })], istek({ yalnizBos: false }));
  t('★ değer zaten aynıysa cihaz plana girmiyor', p.satirlar.length === 0, p.satirlar);
  t('sebebi "aynı" diye sayılıyor', p.atlanan.AYNI === 1, p.atlanan);
}

// ── KİRALIK OLMAYAN ──────────────────────────────────────────────────────
{
  const p = ayarPlani([cihaz({ kiralik: false })], istek());
  t('★ yalnız kiralık seçiliyken satılmış cihaz atlanıyor',
    p.satirlar.length === 0 && p.atlanan.KIRALIK_DEGIL === 1, p);
}
{
  // Kiralık süzgeci kapalı ama alan kiraya özel: yine yazılmaz.
  const p = ayarPlani([cihaz({ kiralik: false })], istek({ yalnizKiralik: false }));
  t('★ "kiraya dahil sayfa" satılmış cihaza YAZILMIYOR', p.satirlar.length === 0, p.satirlar);
}
{
  // Bakım eşiği satılmış cihazda da anlamlı — bakım sözleşmesi ayrı satılır.
  const p = ayarPlani(
    [cihaz({ kiralik: false })],
    istek({ degerler: { pmIntervalPages: 150000 }, yalnizKiralik: false }),
  );
  t('★ bakım eşiği satılmış cihaza da yazılabiliyor',
    p.satirlar.length === 1 && p.satirlar[0].degisim.pmIntervalPages.yeni === 150000, p);
}

// ── BOŞ BIRAKILAN ALAN ───────────────────────────────────────────────────
{
  const p = ayarPlani(
    [cihaz({ includedColor: 500, pmIntervalMonths: 6 })],
    istek({ degerler: { includedBlack: 2000 } }),
  );
  const d = p.satirlar[0].degisim;
  t('★ boş bırakılan alana dokunulmuyor',
    Object.keys(d).length === 1 && d.includedBlack !== undefined, d);
}
{
  const p = ayarPlani([cihaz()], istek({ degerler: {} }));
  t('hiç değer verilmezse hiç değişiklik yok', p.satirlar.length === 0, p.satirlar);
}
{
  const p = ayarPlani([cihaz()], istek({ degerler: { includedBlack: -5 } }));
  t('★ eksi değer plana girmiyor', p.satirlar.length === 0, p.satirlar);
}
{
  // Sıfır GEÇERLİ bir değerdir: "paket yok" demek.
  const p = ayarPlani([cihaz({ includedBlack: 3000 })], istek({ degerler: { includedBlack: 0 }, yalnizBos: false }));
  t('★ sıfır yazılabiliyor ("paket yok")',
    p.satirlar.length === 1 && p.satirlar[0].degisim.includedBlack.yeni === 0, p.satirlar);
}

// ── ÇOK ALAN, ÇOK CİHAZ ──────────────────────────────────────────────────
{
  const cihazlar = [
    cihaz(),                                   // hepsi boş → hepsi yazılır
    cihaz({ includedBlack: 9000 }),            // biri dolu → yalnız öteki yazılır
    cihaz({ kiralik: false }),                 // atlanır
    cihaz({ includedBlack: 2000, pmIntervalPages: 150000 }), // ikisi de aynı → atlanır
  ];
  const p = ayarPlani(cihazlar, istek({ degerler: { includedBlack: 2000, pmIntervalPages: 150000 } }));
  t('çok cihazlı planda yalnız değişecekler listede', p.satirlar.length === 2, p.satirlar.map((s) => s.id));
  t('★ dolu alanı olan cihazda ÖTEKİ alan yine yazılıyor',
    Object.keys(p.satirlar[1].degisim).length === 1 && p.satirlar[1].degisim.pmIntervalPages, p.satirlar[1]);
  t('taranan cihaz sayısı doğru', p.taranan === 4, p.taranan);
  t('atlama sebepleri ayrı ayrı sayılıyor',
    p.atlanan.KIRALIK_DEGIL === 1 && p.atlanan.AYNI === 1, p.atlanan);
}

// ── SABİTLER ─────────────────────────────────────────────────────────────
t('dört alan tanımlı', AYAR_ALANLARI.length === 4, AYAR_ALANLARI);
t('kiraya özel alanlar belli', KIRA_ALANLARI.length === 2 && KIRA_ALANLARI.includes('includedBlack'), KIRA_ALANLARI);

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
