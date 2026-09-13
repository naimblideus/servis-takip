// KDV ÖZETİ — bayinin her ay başka programı açma sebebi
// Çalıştır:  node scripts/test-kdv-ozeti.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu rakam muhasebeciye gidiyor ve ona göre para ödeniyor. Yanlış olursa
// bayi ya eksik beyan eder ya fazla öder. Test ettiklerim:
//
//   1. KDV DAHİL TUTARDAN AYIRMA doğru olmalı — bayi fişteki toplam rakamı
//      yazıyor, ikinci bir hesap yapmıyor.
//   2. ORAN YOKSA UYDURULMAMALI. %20 varsayıp ayırmak, yanlış beyana giden
//      bir rakam üretmek demek.
//   3. KDV'Sİ GİRİLMEMİŞ GİDER SESSİZCE ATLANMAMALI. Atlanırsa bayiye
//      olduğundan YÜKSEK bir "ödenecek KDV" gösterilir; adedi söylenmeli.
//   4. ALIŞ SATIŞTAN BÜYÜKSE devreden KDV çıkar, eksi "ödenecek" değil.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-kdv-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/kdv.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const { kdvAyir, kdvOzeti } = await import(pathToFileURL(join(g, 'kdv.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

console.log('\n★ KDV DAHİL TUTARDAN AYIRMA\n');
{
  t('1.180 ₺ · %18 → 180 ₺', kdvAyir(1180, 18) === 180, kdvAyir(1180, 18));
  t('1.200 ₺ · %20 → 200 ₺', kdvAyir(1200, 20) === 200, kdvAyir(1200, 20));
  t('1.100 ₺ · %10 → 100 ₺', kdvAyir(1100, 10) === 100, kdvAyir(1100, 10));
  t('%0 → 0 (istisna kalem)', kdvAyir(500, 0) === 0, kdvAyir(500, 0));
  t('kuruş yuvarlanıyor', kdvAyir(100, 20) === 16.67, kdvAyir(100, 20));
}
{
  t('★ oran yoksa AYIRMA YOK (null)', kdvAyir(1180, null) === null);
  t('★ oran tanımsızsa ayırma yok', kdvAyir(1180, undefined) === null);
  t('geçersiz oran ayırmıyor', kdvAyir(1180, 'abc') === null && kdvAyir(1180, -5) === null && kdvAyir(1180, 150) === null);
  t('geçersiz tutar ayırmıyor', kdvAyir(NaN, 20) === null);
}

const fatura = (ek = {}) => ({
  invoiceNumber: 'F-1', invoiceDate: new Date(2026, 7, 15),
  subtotal: 1000, vatRate: 20, vatAmount: 200, totalAmount: 1200, ...ek,
});
const gider = (ek = {}) => ({
  description: 'Toner alımı', date: new Date(2026, 7, 10),
  amount: 1200, vatRate: 20, vatAmount: null, ...ek,
});

console.log('\nÖZET — SATIŞ EKSİ ALIŞ\n');
{
  const o = kdvOzeti('2026-08', [fatura(), fatura({ invoiceNumber: 'F-2' })], [gider()]);
  t('satış KDV 400', o.satis.kdv === 400, o.satis);
  t('satış matrahı 2.000', o.satis.matrah === 2000, o.satis);
  t('alış KDV 200 (dahil tutardan ayrıldı)', o.alis.kdv === 200, o.alis);
  t('alış matrahı 1.000', o.alis.matrah === 1000, o.alis);
  t('★ ödenecek 200', o.odenecek === 200 && o.devreden === 0, o);
}
{
  // ★ Alış satıştan büyükse ÖDENECEK eksi olmaz, DEVREDEN olur.
  const o = kdvOzeti('2026-08', [fatura()], [gider({ amount: 6000 })]);
  t('★ alış fazlaysa ödenecek 0', o.odenecek === 0, o);
  t('★ devreden KDV çıkıyor (800)', o.devreden === 800, o);
  t('fark eksi işaretli', o.fark === -800, o);
}
{
  const o = kdvOzeti('2026-08', [], []);
  t('boş dönemde her şey sıfır', o.satis.kdv === 0 && o.alis.kdv === 0 && o.odenecek === 0, o);
}

console.log('\n★ KDV\'Sİ GİRİLMEMİŞ GİDER SESSİZCE ATLANMIYOR\n');
{
  const o = kdvOzeti('2026-08', [fatura()], [
    gider(),
    gider({ description: 'Kira', amount: 5000, vatRate: null }),
    gider({ description: 'Yakıt', amount: 800, vatRate: null }),
  ]);
  t('yalnız KDV\'si bilinen gider sayılıyor', o.alis.adet === 1 && o.alis.kdv === 200, o.alis);
  t('★ atlananların adedi söyleniyor (2)', o.kdvsizGider.adet === 2, o.kdvsizGider);
  t('★ atlananların tutarı söyleniyor (5.800)', o.kdvsizGider.tutar === 5800, o.kdvsizGider);
  t('ödenecek atlananları saymıyor', o.odenecek === 0, o);
}
{
  // Kayıtta KDV tutarı ELLE yazılıysa o kullanılmalı (oran değil).
  const o = kdvOzeti('2026-08', [], [gider({ amount: 1000, vatRate: 20, vatAmount: 137.5 })]);
  t('★ elle yazılan KDV tutarı oranın önüne geçiyor', o.alis.kdv === 137.5, o.alis);
}
{
  // KDV'si sıfır yazılmış gider (istisna) ATLANMIŞ sayılmamalı.
  const o = kdvOzeti('2026-08', [], [gider({ amount: 500, vatRate: 0 })]);
  t('★ %0 KDV atlanmış sayılmıyor', o.kdvsizGider.adet === 0 && o.alis.adet === 1, o);
  t('matrahı tam tutar', o.alis.matrah === 500, o.alis);
}

console.log('\nORAN ORAN AYRIŞMA (beyanname satırları)\n');
{
  const o = kdvOzeti('2026-08', [
    fatura({ vatRate: 20, subtotal: 1000, vatAmount: 200, totalAmount: 1200 }),
    fatura({ invoiceNumber: 'F-2', vatRate: 10, subtotal: 500, vatAmount: 50, totalAmount: 550 }),
    fatura({ invoiceNumber: 'F-3', vatRate: 20, subtotal: 2000, vatAmount: 400, totalAmount: 2400 }),
  ], []);
  t('iki oran ayrı satır', o.satisOranlari.length === 2, o.satisOranlari);
  t('küçük orandan büyüğe sıralı', o.satisOranlari[0].oran === 10, o.satisOranlari);
  t('%20 matrahı toplanmış (3.000)', o.satisOranlari[1].matrah === 3000, o.satisOranlari);
  t('%20 KDV toplanmış (600)', o.satisOranlari[1].kdv === 600, o.satisOranlari);
  t('oran toplamı genel KDV ile tutuyor',
    o.satisOranlari.reduce((x, r) => x + r.kdv, 0) === o.satis.kdv, o);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
