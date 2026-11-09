// "O AN" — ödeyenler ilk 7 günde ne yaptı + haftalık tek sayı (saf; veritabanı ve sunucu gerekmez).
// Çalıştır:  node scripts/test-aktivasyon-an.mjs
//
// NEDEN BU TEST
// Bu ekran kurulumda neyi kesip neyi tutacağımıza karar verdiriyor. Hesap
// yanlış gruba düşerse (denemesi süren hesap "ödemedi" sayılırsa) tablo
// yanlış işi "o an" diye gösterir; hafta İstanbul saatine göre değil de UTC'ye
// göre bölünürse Pazar gecesi açılan hesap yanlış haftaya yazılır.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const g = mkdtempSync(join(tmpdir(), 'aktivasyon-an-'));
let k;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      join(KOK, 'src/lib/aktivasyon-an.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları ayrıca tsc ile denetleniyor */ }
  k = await import(pathToFileURL(join(g, 'aktivasyon-an.js')).href);
} catch (e) {
  console.log('✗ derlenemedi:', e?.message);
  process.exit(1);
}

const simdi = new Date('2026-11-12T12:00:00+03:00'); // Perşembe
const gun = (n) => new Date(simdi.getTime() - n * 86_400_000);
const sonra = (n) => new Date(simdi.getTime() + n * 86_400_000);
const hesap = (h) => ({ acilis: gun(30), denemeBitis: gun(16), plan: 'trial', odedi: false, ilk7: {}, ...h });

// ── GRUP ──
t('ödemesi kayıtlı → ödeyen', k.grupBul(hesap({ odedi: true, plan: 'professional' }), simdi) === 'ODEYEN');
t('denemesi bitmiş, ödememiş → ödemeyen', k.grupBul(hesap({}), simdi) === 'ODEMEYEN');
t('hâlâ denemede → belirsiz (ödemedi sayılmaz)', k.grupBul(hesap({ acilis: gun(10), denemeBitis: sonra(4) }), simdi) === 'BELIRSIZ');
t('elle pakete alınmış, ödemesi yazılmamış → belirsiz', k.grupBul(hesap({ plan: 'professional' }), simdi) === 'BELIRSIZ');
t('ödedi ama ilk 7 günü dolmadı → belirsiz', k.grupBul(hesap({ acilis: gun(3), odedi: true }), simdi) === 'BELIRSIZ');
t('deneme bitişi yok → belirsiz', k.grupBul(hesap({ denemeBitis: null }), simdi) === 'BELIRSIZ');

// ── EŞİK ──
t('9 cihaz → "cihaz ekledi" evet', k.isYapti({ ilk7: { cihaz: 9 } }, 'CIHAZ'));
t('9 cihaz → "10+ cihaz" hayır', !k.isYapti({ ilk7: { cihaz: 9 } }, 'CIHAZ_10'));
t('10 cihaz → "10+ cihaz" evet', k.isYapti({ ilk7: { cihaz: 10 } }, 'CIHAZ_10'));
t('tek kullanıcı (açan kişi) → ekip yok', !k.isYapti({ ilk7: { kullanici: 1 } }, 'EKIP'));
t('iki kullanıcı → ekip var', k.isYapti({ ilk7: { kullanici: 2 } }, 'EKIP'));
t('sayı hiç yoksa → yapmadı', !k.isYapti({ ilk7: {} }, 'SAYAC'));
t('iş kodu doğrulama', k.isKoduMu('SAYAC') && !k.isKoduMu('sayac') && !k.isKoduMu(undefined) && !k.isKoduMu('DROP'));

// ── TABLO ──
// 4 ödeyenin hepsi sayaç okuttu; 6 ödemeyenden yalnız 1'i. Herkes giriş yaptı.
const odeyenler = [0, 1, 2, 3].map((i) => hesap({ odedi: true, ilk7: { giris: 3, okuma: 5, kullanici: i < 2 ? 2 : 1 } }));
const odemeyenler = [0, 1, 2, 3, 4, 5].map((i) => hesap({ ilk7: { giris: 1, okuma: i === 0 ? 1 : 0 } }));
const surenler = [hesap({ acilis: gun(5), denemeBitis: sonra(9), ilk7: { giris: 1 } })];
const tb = k.odeyenlerTablosu([...odeyenler, ...odemeyenler, ...surenler], simdi);
t('n doğru: 4 ödeyen, 6 ödemeyen, süren hesap dışarıda', tb.odeyenN === 4 && tb.odemeyenN === 6, tb);
t('o an = sayaç okuttu', tb.an === 'SAYAC', tb.an);
const sayac = tb.satirlar.find((s) => s.kod === 'SAYAC');
t('sayaç: %100 / %17 / +83', sayac.odeyen === 100 && sayac.odemeyen === 17 && sayac.fark === 83, sayac);
t('en büyük fark en üstte', tb.satirlar[0].kod === 'SAYAC');
const giris = tb.satirlar.find((s) => s.kod === 'GIRIS');
t('herkesin yaptığı iş ayırmaz: fark 0', giris.fark === 0, giris);
t('ekip: %50 / %0', tb.satirlar.find((s) => s.kod === 'EKIP').odeyen === 50);
t('farklar büyükten küçüğe', tb.satirlar.every((s, i, a) => i === 0 || a[i - 1].fark >= s.fark));

const odeyensiz = k.odeyenlerTablosu(odemeyenler, simdi);
t('ödeyen yok → an yok, yüzde boş, iş sırası korunur', odeyensiz.an === null && odeyensiz.satirlar[0].odeyen === null && odeyensiz.satirlar[0].kod === 'GIRIS' && odeyensiz.satirlar[0].fark === null);
const ayirmayan = k.odeyenlerTablosu([hesap({ odedi: true, ilk7: { giris: 1 } }), hesap({ ilk7: { giris: 1 } })], simdi);
t('hiçbir iş ödeyeni ayırmıyorsa an yok', ayirmayan.an === null, ayirmayan.satirlar[0]);
t('boş liste patlamaz', k.odeyenlerTablosu([], simdi).an === null);

// ── HAFTA (İstanbul, Pazartesi başlar) ──
t('Pazar 23:30 İstanbul → o haftanın Pazartesi', k.haftaBasi(new Date('2026-11-08T23:30:00+03:00')) === '2026-11-02');
t('Pazartesi 00:30 İstanbul (UTC hâlâ Pazar) → yeni hafta', k.haftaBasi(new Date('2026-11-09T00:30:00+03:00')) === '2026-11-09');
t('Perşembe → aynı haftanın Pazartesi', k.haftaBasi(simdi) === '2026-11-09');
t('yıl dönümü: 1 Ocak 2027 Cuma → 28 Aralık 2026', k.haftaBasi(new Date('2027-01-01T10:00:00+03:00')) === '2026-12-28');

const kohort = [
  hesap({ acilis: new Date('2026-11-03T10:00:00+03:00'), ilk7: { okuma: 2 } }),
  hesap({ acilis: new Date('2026-11-04T15:00:00+03:00'), ilk7: {} }),
  hesap({ acilis: new Date('2026-11-10T09:00:00+03:00'), ilk7: { okuma: 1 } }),
  hesap({ acilis: new Date('2026-08-01T09:00:00+03:00'), ilk7: { okuma: 1 } }), // 8 haftadan eski
];
const hf = k.haftalikOran(kohort, 'SAYAC', simdi);
t('8 hafta, bu hafta en sağda', hf.length === 8 && hf[7].hafta === '2026-11-09' && hf[0].hafta === '2026-09-21', hf.map((h) => h.hafta));
const gecen = hf.find((h) => h.hafta === '2026-11-02');
t('geçen hafta: 2 açıldı, 1 vardı, %50, 7 gün doldu', gecen.acilan === 2 && gecen.varan === 1 && gecen.yuzde === 50 && !gecen.suruyor, gecen);
t('bu hafta: 7 günü dolmamış hesap → sürüyor', hf[7].acilan === 1 && hf[7].suruyor);
t('boş hafta: yüzde yok', hf[0].acilan === 0 && hf[0].yuzde === null);
t('8 haftadan eski hesap sayılmaz', hf.reduce((a, h) => a + h.acilan, 0) === 3);
t('tek sayı = 7 günü dolmuş son hafta', k.sonBitenHafta(hf)?.hafta === '2026-11-02');
t('hepsi sürüyorsa tek sayı yok', k.sonBitenHafta([{ hafta: 'x', acilan: 2, varan: 1, yuzde: 50, suruyor: true }]) === null);

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
