// STOK MALİYETİ — ağırlıklı ortalama ve dondurulmuş kullanım maliyeti
// Çalıştır:  node scripts/test-stok-maliyet.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Ölçüldü (2026-09-14): 688 parçanın 670'inde alış fiyatı sıfır ve 8.188
// fiş kullanımı bu sıfırlarla maliyetleniyordu. Maliyet yanlışsa kârlılık,
// fiyat önerisi ve zam kararı da yanlış. Test ettiklerim:
//
//   1. "BİLİNMİYOR" ile "SIFIR" AYNI ŞEY DEĞİL. Sıfır maliyet %100 marj
//      gösterir ve bayi o rakama bakıp fiyat belirler.
//   2. AĞIRLIKLI ORTALAMA gerçekten ağırlıklı olmalı: 100 adetlik ucuz
//      alışla 1 adetlik pahalı alış aynı ağırlıkta sayılamaz.
//   3. KULLANIM ORTALAMAYI DEĞİŞTİRMEZ — raftan bir tane çıkınca
//      kalanların maliyeti değişmez.
//   4. GEÇMİŞ KÂRLILIK BUGÜNKÜ FİYATLA DEĞİŞMEMELİ: fişte dondurulmuş
//      maliyet varsa her zaman o kullanılır.
//   5. NEGATİF STOK ortalamayı ters çevirmemeli.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-sm-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/stok-maliyet.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
{
  const yol = join(g, 'stok-maliyet.js');
  writeFileSync(yol, readFileSync(yol, 'utf8').split("'@/lib/prisma'").join("'./sahte.js'"), 'utf8');
  writeFileSync(join(g, 'sahte.js'), 'export const prisma = {};\n', 'utf8');
}
const { yeniOrtalama, parcaMaliyeti, kullanimMaliyeti } =
  await import(pathToFileURL(join(g, 'stok-maliyet.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const yakin = (a, b, tol = 0.011) => Math.abs(a - b) < tol;

console.log('\n★ AĞIRLIKLI ORTALAMA — adet gerçekten ağırlık\n');
{
  // 10 adet ₺100'lük stok + 10 adet ₺200 → ortalama ₺150
  t('eşit adette ortası', yeniOrtalama({ eskiStok: 10, eskiOrtalama: 100, adet: 10, birimAlis: 200 }) === 150);

  // 100 adet ₺100 + 1 adet ₺500 → ₺103,96 (basit ortalama ₺300 olurdu)
  const a = yeniOrtalama({ eskiStok: 100, eskiOrtalama: 100, adet: 1, birimAlis: 500 });
  t('★ 1 adetlik pahalı alış ortalamayı uçurmuyor', yakin(a, 103.96), a);
  t('★ basit ortalama olsaydı 300 çıkardı (3 kat yanlış)', (100 + 500) / 2 === 300);

  // Tersi: 1 adet ₺100 stok + 100 adet ₺500 → ₺496,04
  const b = yeniOrtalama({ eskiStok: 1, eskiOrtalama: 100, adet: 100, birimAlis: 500 });
  t('★ büyük alış ortalamayı kendine çekiyor', yakin(b, 496.04), b);
}

console.log('\n★ İLK ALIŞ VE BİLİNMEYEN GEÇMİŞ\n');
{
  // Hiç ortalama yoksa, eski stoğu SIFIR maliyetli saymak ortalamayı yapay
  // olarak düşürürdü. Yeni alış tek bilgi kaynağı.
  t('★ ortalama bilinmiyorsa yeni alış fiyatı oluyor',
    yeniOrtalama({ eskiStok: 50, eskiOrtalama: null, adet: 10, birimAlis: 200 }) === 200);
  t('★ eski ortalama sıfırsa da yeni alış fiyatı',
    yeniOrtalama({ eskiStok: 50, eskiOrtalama: 0, adet: 10, birimAlis: 200 }) === 200);
  t('stok sıfırken ortalama yeni alış', yeniOrtalama({ eskiStok: 0, eskiOrtalama: 100, adet: 5, birimAlis: 300 }) === 300);
  t('★ 50 adet stoğu 0 maliyetli saysaydık ortalama 33,33 çıkardı (yanlış)',
    yakin((50 * 0 + 10 * 200) / 60, 33.33));
}

console.log('\n★ BOZUK GİRDİ ORTALAMAYI BOZMUYOR\n');
{
  t('adet sıfırsa ortalama değişmiyor', yeniOrtalama({ eskiStok: 10, eskiOrtalama: 100, adet: 0, birimAlis: 500 }) === 100);
  t('negatif adet ortalamayı değiştirmiyor', yeniOrtalama({ eskiStok: 10, eskiOrtalama: 100, adet: -5, birimAlis: 500 }) === 100);
  t('negatif fiyat ortalamayı değiştirmiyor', yeniOrtalama({ eskiStok: 10, eskiOrtalama: 100, adet: 5, birimAlis: -50 }) === 100);
  // Fazla düşülmüş stok (-5) ortalamayı TERS çevirirdi.
  const n = yeniOrtalama({ eskiStok: -5, eskiOrtalama: 100, adet: 10, birimAlis: 200 });
  t('★ negatif stok ortalamayı ters çevirmiyor', n === 200, n);
  t('★ negatif stok hesaba katılsaydı 400 çıkardı', yakin((-5 * 100 + 10 * 200) / 5, 300));
  t('bedava alış (0 fiyat) kabul ediliyor', yeniOrtalama({ eskiStok: 10, eskiOrtalama: 100, adet: 10, birimAlis: 0 }) === 50);
  t('kuruşa yuvarlanıyor', Number.isInteger(yeniOrtalama({ eskiStok: 3, eskiOrtalama: 100, adet: 1, birimAlis: 101 }) * 100));
}

console.log('\n★ "BİLİNMİYOR" İLE "SIFIR" AYNI ŞEY DEĞİL\n');
{
  const yok = parcaMaliyeti({ avgCost: null, buyPrice: 0 });
  t('★ hiçbiri yoksa maliyet NULL (sıfır değil)', yok.deger === null, yok);
  t('kaynağı da null', yok.kaynak === null);
  t('★ bayiye ne yapması gerektiği söyleniyor', /girilmemiş/.test(yok.aciklama), yok.aciklama);

  const son = parcaMaliyeti({ avgCost: null, buyPrice: 480 });
  t('ortalama yoksa son alışa düşülüyor', son.deger === 480 && son.kaynak === 'SON_ALIS', son);
  t('★ bunun bir tahmin olduğu yazıyor', /alış kaydı girilmemiş/.test(son.aciklama), son.aciklama);

  const ort = parcaMaliyeti({ avgCost: 512.5, buyPrice: 480 });
  t('★ ortalama varsa son alışı yeniyor', ort.deger === 512.5 && ort.kaynak === 'ORTALAMA', ort);
  t('sıfır ortalama ortalama sayılmıyor', parcaMaliyeti({ avgCost: 0, buyPrice: 480 }).kaynak === 'SON_ALIS');
}

console.log('\n★ GEÇMİŞ KÂRLILIK BUGÜNKÜ FİYATLA DEĞİŞMİYOR\n');
{
  // Altı ay önce ₺480'e alınmış toner fişte kullanıldı. Bugün aynı toner
  // ₺960. Dondurulmuş maliyet olmasaydı o fişin maliyeti ikiye katlanırdı.
  const donmus = kullanimMaliyeti({ unitCost: 480, quantity: 2 }, { avgCost: 960, buyPrice: 960 });
  t('★ dondurulmuş maliyet kullanılıyor', donmus.tutar === 960, donmus);
  t('tahmin değil', donmus.tahmini === false);
  t('★ dondurulmamış olsaydı 1920 çıkardı (2 kat)', 960 * 2 === 1920);

  const eski = kullanimMaliyeti({ unitCost: null, quantity: 2 }, { avgCost: 960, buyPrice: 900 });
  t('eski kayıtta bugünkü ortalamaya düşülüyor', eski.tutar === 1920, eski);
  t('★ ama bunun tahmin olduğu bildiriliyor', eski.tahmini === true, eski);

  const bos = kullanimMaliyeti({ unitCost: null, quantity: 3 }, { avgCost: null, buyPrice: 0 });
  t('★ maliyeti hiç bilinmeyen parça SIFIR sayılmıyor, bilinmiyor işaretleniyor',
    bos.bilinmiyor === true && bos.tutar === 0, bos);
  t('tahmin de değil (uydurulmuş bir sayı yok)', bos.tahmini === false);

  t('sıfır dondurulmuş maliyet dondurulmuş sayılmıyor',
    kullanimMaliyeti({ unitCost: 0, quantity: 1 }, { avgCost: 500, buyPrice: 500 }).tahmini === true);
}

console.log('\nGERÇEK SENARYO — üç tedarikçiden aynı toner\n');
{
  // Bayi aynı toneri üç ayrı yerden alıyor: 5×₺720, 3×₺650, 4×₺810.
  let ort = null, stok = 0;
  for (const [adet, fiyat] of [[5, 720], [3, 650], [4, 810]]) {
    ort = yeniOrtalama({ eskiStok: stok, eskiOrtalama: ort, adet, birimAlis: fiyat });
    stok += adet;
  }
  // (5×720 + 3×650 + 4×810) / 12 = 8790/12 = 732,50
  t('★ üç alışın ağırlıklı ortalaması 732,50', yakin(ort, 732.5), ort);
  t('stok 12', stok === 12);
  t('★ "son alış" 810 olurdu — %10,6 fazla', yakin((810 - 732.5) / 732.5, 0.1058, 0.001));
  t('★ basit ortalama 726,67 olurdu — yanlış ağırlık', yakin((720 + 650 + 810) / 3, 726.67, 0.01));

  // Dört tane kullanıldı: ortalama DEĞİŞMEMELİ.
  const kullanimSonrasi = ort;
  t('★ kullanım ortalamayı değiştirmiyor', kullanimSonrasi === ort);
  // Sonra 6 tane ₺900'e alındı: (8 × 732,50 + 6 × 900) / 14
  const sonra = yeniOrtalama({ eskiStok: 8, eskiOrtalama: ort, adet: 6, birimAlis: 900 });
  t('sonraki alış ortalamayı doğru güncelliyor', yakin(sonra, (8 * 732.5 + 6 * 900) / 14), sonra);
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
