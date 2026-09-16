// TONER KARNESİ — ölçülen verimin hükmü
// Çalıştır:  node scripts/test-verim-karnesi.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu ekrandaki sayı satın alma ve sözleşme fiyatı kararını değiştiriyor.
// "Bu model kutudan %30 az basıyor" cümlesi bayiyi marka değiştirmeye ya da
// fiyat artırmaya götürür; yanlışsa pahalıya mal olur. Test ettiklerim:
//
//   1. VERİM DÜŞÜŞÜ MALİYETE AYNI ORANDA YANSIMIYOR — ters orantı.
//      %30 az verim = %43 fazla maliyet. Aynı sayıyı yazmak sessiz hatadır.
//   2. ÖLÇÜLMEMİŞE HÜKÜM YOK — eksik veriden yüzde üretilmiyor.
//   3. SIFIRA BÖLÜNMÜYOR.
//   4. SIRALAMA ETKİYE GÖRE: çok cihazlı model üstte.
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-karne-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/verim-karnesi.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

const {
  sapmaYuzde, maliyetEtkisiYuzde, sayfaBasiMaliyet, karneSatiri, karneSirasi, karneOzeti,
} = await import(pathToFileURL(join(g, 'verim-karnesi.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const yakin = (a, b, tol = 0.05) => a !== null && Math.abs(a - b) < tol;

const temel = {
  anahtar: 'HP|P1102', marka: 'HP', model: 'P1102', cihaz: 10,
  kutuSb: null, kutuRenkli: null, olculenSb: null, olculenRenkli: null,
  gozlemSb: 0, gozlemRenkli: 0, maliyetSb: null, maliyetRenkli: null,
};

console.log('\n★ VERİM DÜŞÜŞÜ MALİYETE TERS ORANTILI YANSIYOR\n');
{
  // Kutu 6000 der, sahada 4200 çıkar: verim %30 düşük.
  t('sapma %-30', yakin(sapmaYuzde(6000, 4200), -30), sapmaYuzde(6000, 4200));
  // Maliyet 6000/4200 = 1.4286 → %42.9 ARTAR. %30 yazmak sessiz hata olurdu.
  t('★ maliyet etkisi %42.9 (30 DEĞİL)', yakin(maliyetEtkisiYuzde(6000, 4200), 42.9, 0.1),
    maliyetEtkisiYuzde(6000, 4200));

  t('verim fazlaysa sapma artı', yakin(sapmaYuzde(4000, 5000), 25));
  t('★ fazla verimde maliyet DÜŞÜYOR (eksi)', maliyetEtkisiYuzde(4000, 5000) < 0,
    maliyetEtkisiYuzde(4000, 5000));
  t('verim eşitse sapma 0', sapmaYuzde(5000, 5000) === 0);
  t('verim eşitse maliyet etkisi 0', maliyetEtkisiYuzde(5000, 5000) === 0);
}

console.log('\n★ ÖLÇÜLMEMİŞE HÜKÜM YOK\n');
{
  t('kutu değeri yoksa sapma null', sapmaYuzde(null, 4200) === null);
  t('ölçüm yoksa sapma null', sapmaYuzde(6000, null) === null);
  t('★ ikisi de yoksa null', sapmaYuzde(null, null) === null);
  t('sıfır kutu değeri null (bölme yok)', sapmaYuzde(0, 4200) === null);
  t('★ sıfır ölçüm null — sonsuz maliyet üretilmiyor', maliyetEtkisiYuzde(6000, 0) === null);
  t('eksi değer null', sapmaYuzde(-100, 4200) === null);
}

console.log('\n★ SAYFA BAŞI MALİYET\n');
{
  t('1200 TL / 6000 sayfa = 0.20', yakin(sayfaBasiMaliyet(1200, 6000), 0.2, 0.0001));
  t('★ verim düşünce maliyet artıyor', sayfaBasiMaliyet(1200, 4200) > sayfaBasiMaliyet(1200, 6000));
  t('fiyat yoksa null', sayfaBasiMaliyet(null, 6000) === null);
  t('verim yoksa null', sayfaBasiMaliyet(1200, null) === null);
  t('★ sıfır verim null (sonsuza bölünmüyor)', sayfaBasiMaliyet(1200, 0) === null);
  t('kuruş hassasiyeti korunuyor', sayfaBasiMaliyet(1000, 7000) === 0.1429, sayfaBasiMaliyet(1000, 7000));
}

console.log('\n★ SATIR HÜKMÜ\n');
{
  const az = karneSatiri({ ...temel, kutuSb: 6000, olculenSb: 4200, gozlemSb: 5, maliyetSb: 0.28 });
  t('ölçüldü işaretli', az.olculdu === true);
  t('★ özet "AZ" diyor', /AZ/.test(az.ozet), az.ozet);
  t('özet ölçülen değeri yazıyor', /4\.200/.test(az.ozet), az.ozet);
  t('yeterli gözlemde GOZLEM_AZ uyarısı yok', !az.uyarilar.includes('GOZLEM_AZ'), az.uyarilar);

  const tekGozlem = karneSatiri({ ...temel, olculenSb: 4200, gozlemSb: 1, maliyetSb: 0.28 });
  t('★ tek gözlemde GOZLEM_AZ uyarısı', tekGozlem.uyarilar.includes('GOZLEM_AZ'), tekGozlem.uyarilar);
  t('kutu değeri yoksa uyarı veriyor', tekGozlem.uyarilar.includes('KUTU_DEGERI_YOK'), tekGozlem.uyarilar);

  const fiyatsiz = karneSatiri({ ...temel, kutuSb: 6000, olculenSb: 5800, gozlemSb: 4 });
  t('★ fiyat yoksa FIYAT_YOK uyarısı', fiyatsiz.uyarilar.includes('FIYAT_YOK'), fiyatsiz.uyarilar);
  t('uyumlu verimde "uyumlu" diyor', /uyumlu/.test(fiyatsiz.ozet), fiyatsiz.ozet);

  const olcumsuz = karneSatiri({ ...temel });
  t('ölçüm yoksa olculdu false', olcumsuz.olculdu === false);
  t('★ ölçüm yokken uyarı yığılmıyor', olcumsuz.uyarilar.length === 0, olcumsuz.uyarilar);
  t('ölçümsüz satır ne yapılacağını söylüyor', /kendiliğinden öğrenilir/.test(olcumsuz.ozet), olcumsuz.ozet);
}

console.log('\n★ SIRALAMA ETKİYE GÖRE\n');
{
  const cok = karneSatiri({ ...temel, anahtar: 'A', cihaz: 25, olculenSb: 5000, gozlemSb: 3 });
  const az = karneSatiri({ ...temel, anahtar: 'B', cihaz: 2, olculenSb: 5000, gozlemSb: 3 });
  const olcumsuz = karneSatiri({ ...temel, anahtar: 'C', cihaz: 40 });

  t('★ çok cihazlı model önce', karneSirasi(cok, az) < 0);
  t('★ ÖLÇÜLEN, 40 cihazlı ölçülmemişin bile ÖNÜNDE', karneSirasi(az, olcumsuz) < 0);
  const sirali = [olcumsuz, az, cok].sort(karneSirasi).map(s => s.anahtar);
  t('tam sıra A,B,C', JSON.stringify(sirali) === JSON.stringify(['A', 'B', 'C']), sirali);
}

console.log('\n★ ÖZET\n');
{
  const satirlar = [
    karneSatiri({ ...temel, anahtar: 'A', cihaz: 25, kutuSb: 6000, olculenSb: 4200, gozlemSb: 5, maliyetSb: 0.28 }),
    karneSatiri({ ...temel, anahtar: 'B', marka: 'Canon', model: 'LBP', cihaz: 10, kutuSb: 3000, olculenSb: 2950, gozlemSb: 4, maliyetSb: 0.41 }),
    karneSatiri({ ...temel, anahtar: 'C', cihaz: 5 }),
  ];
  const o = karneOzeti(satirlar);
  t('model sayısı 3', o.model === 3);
  t('ölçülen model 2', o.olculenModel === 2);
  t('toplam cihaz 40', o.cihaz === 40);
  t('★ kapsanan cihaz 35 (ölçümsüz model sayılmıyor)', o.kapsananCihaz === 35, o.kapsananCihaz);
  t('★ kutudan az basan 1 model (-%30)', o.kutudanAz === 1, o.kutudanAz);
  t('★ en pahalı model Canon LBP (0.41)', o.enPahali?.model === 'LBP' && o.enPahali?.maliyet === 0.41, o.enPahali);

  t('boş listede özet patlamıyor', karneOzeti([]).model === 0);
  t('boş listede en pahalı null', karneOzeti([]).enPahali === null);
}

console.log('\n★ SINIR: %10 EŞİĞİ\n');
{
  // Ölçüm gürültüsünü "bu model kötü" diye okumamak için eşik var.
  const tam10 = karneSatiri({ ...temel, kutuSb: 1000, olculenSb: 900, gozlemSb: 5 });
  t('★ tam %-10 "AZ" sayılıyor', /AZ/.test(tam10.ozet), tam10.ozet);
  const dokuz = karneSatiri({ ...temel, kutuSb: 1000, olculenSb: 910, gozlemSb: 5 });
  t('★ %-9 "uyumlu" — gürültü alarm üretmiyor', /uyumlu/.test(dokuz.ozet), dokuz.ozet);
  t('özet sayıyı yuvarlıyor (%9.9 değil %10)',
    !/%9\.\d/.test(tam10.ozet), tam10.ozet);
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
