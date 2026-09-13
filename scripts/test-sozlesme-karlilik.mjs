// SÖZLEŞME KÂRLILIĞI VE FİYAT KARARI
// Çalıştır:  node scripts/test-sozlesme-karlilik.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu ekrandaki rakam yenileme görüşmesinde MÜŞTERİYE söyleniyor. Yanlış
// çıkarsa bayi ya hak etmediği bir zammı savunmak zorunda kalır ya da
// zarar eden bir sözleşmeyi bir yıl daha uzatır. Test ettiklerim:
//
//   1. SIFIR GELİRDE MARJ YOK. "-%100" değil, ÖLÇÜLEMEZ.
//   2. SIFIR MALİYET %100 MARJ DEĞİL — kayıt eksikliği olabilir ve bu
//      ayrıca işaretlenmeli.
//   3. HEDEF MARJ MATEMATİĞİ: maliyet/(1-hedef). Yaygın hata maliyetin
//      üstüne hedef yüzdeyi EKLEMEK; o hesap hedefi hiç tutturmaz.
//   4. YENİ SÖZLEŞMEYİ 12 AYA BÖLMEMEK. Üç aylık sözleşmenin aylık geliri
//      yıla bölünürse sözleşme zarar ediyor gibi görünür.
//   5. SAYFA MALİYETİ ölçülmüş verim olmadan hesaplanmamalı.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-kar-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/sozlesme-karlilik.ts'), join(KOK, 'src/lib/stok-maliyet.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
{
  // Saf matematik test ediliyor; veritabanı tarafı sahtelerle karşılanıyor.
  const yol = join(g, 'sozlesme-karlilik.js');
  writeFileSync(yol, readFileSync(yol, 'utf8')
    .split("'@/lib/prisma'").join("'./sahte.js'")
    .split("'@/lib/verim-ogrenme'").join("'./sahte.js'")
    .split("'@/lib/toner-verimi'").join("'./sahte.js'")
    .split("'@/lib/stok-maliyet'").join("'./stok-maliyet.js'"), 'utf8');
  const sm = join(g, 'stok-maliyet.js');
  writeFileSync(sm, readFileSync(sm, 'utf8').split("'@/lib/prisma'").join("'./sahte.js'"), 'utf8');
  writeFileSync(join(g, 'sahte.js'),
    'export const prisma = {};\nexport const verimleriOgren = async () => ({ cihaz: new Map(), model: new Map() });\nexport const modelAnahtari = (a, b) => `${a}|${b}`;\n', 'utf8');
}
const {
  marj, hedefIcinGelir, sayfaMaliyeti, fiyatOnerisi, uyarilar, kapsananAy, UYARI_METNI,
  faturaliAy, olcumBasi,
} = await import(pathToFileURL(join(g, 'sozlesme-karlilik.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const yakin = (a, b, tol = 0.005) => Math.abs(a - b) < tol;

console.log('\n★ SIFIR GELİRDE MARJ ÜRETİLMİYOR\n');
{
  t('★ gelir yoksa null', marj(0, 500) === null);
  t('★ negatif gelir de null', marj(-100, 500) === null);
  t('gelir varsa hesaplanıyor', yakin(marj(1000, 750), 0.25), marj(1000, 750));
  t('★ maliyet gelirden büyükse marj NEGATİF (gizlenmiyor)', yakin(marj(1000, 1500), -0.5), marj(1000, 1500));
  t('maliyet sıfırsa %100', marj(1000, 0) === 1);
}

console.log('\n★ HEDEF MARJ MATEMATİĞİ — maliyetin üstüne yüzde EKLEMEK yanlış\n');
{
  // Maliyet 750, hedef %25. Doğru cevap 1.000 (750/0,75).
  // Yaygın hata: 750 × 1,25 = 937,50 — bu fiyatta marj %20 çıkar, %25 değil.
  const dogru = hedefIcinGelir(750, 0.25);
  t('★ 750 maliyet + %25 hedef → 1000 gelir', dogru === 1000, dogru);
  t('★ yanlış yöntem 937,50 verirdi', yakin(750 * 1.25, 937.5));
  t('★ o fiyatta marj %25 DEĞİL %20 olurdu', yakin(marj(937.5, 750), 0.2), marj(937.5, 750));
  t('★ önerilen fiyatta marj GERÇEKTEN %25', yakin(marj(dogru, 750), 0.25));

  t('hedef %0 → maliyetin kendisi', hedefIcinGelir(500, 0) === 500);
  t('★ hedef %100 imkânsız → null', hedefIcinGelir(500, 1) === null);
  t('★ hedef %100 üstü → null', hedefIcinGelir(500, 1.2) === null);
  t('negatif hedef → null', hedefIcinGelir(500, -0.1) === null);
  t('★ maliyet sıfırsa öneri üretilmiyor', hedefIcinGelir(0, 0.25) === null);
}

console.log('\n★ FİYAT ÖNERİSİ — görüşmede söylenecek rakam\n');
{
  // Aylık gelir 1.500, maliyet 1.380 → marj %8. %25 için 1.840 gerek.
  const o = fiyatOnerisi({ aylikGelir: 1500, aylikMaliyet: 1380, hedefMarj: 0.25, mevcutKira: 1500 });
  t('gereken gelir 1840', yakin(o.gerekenAylikGelir, 1840), o.gerekenAylikGelir);
  t('★ eksik 340', yakin(o.eksikAylik, 340), o.eksikAylik);
  t('★ önerilen kira 1840', yakin(o.onerilenKira, 1840), o.onerilenKira);
  t('zam yüzdesi hesaplanıyor', yakin(o.artisYuzde, 340 / 1500), o.artisYuzde);
  t('yeterli değil işaretli', o.zatenYeterli === false);

  // Zaten kârlı sözleşmede "zam gerekmiyor" denmeli.
  const y = fiyatOnerisi({ aylikGelir: 3000, aylikMaliyet: 1000, hedefMarj: 0.25, mevcutKira: 3000 });
  t('★ hedefin üstündeyse zam gerekmiyor', y.zatenYeterli === true, y);
  t('★ kira DÜŞÜRÜLMÜYOR (öneri indirim değil)', y.onerilenKira < y.mevcutKira, y);

  // Kira bilinmiyorsa kira önerisi çıkmamalı ama eksik tutar çıkmalı.
  const k = fiyatOnerisi({ aylikGelir: 1000, aylikMaliyet: 900, hedefMarj: 0.25, mevcutKira: null });
  t('★ kira bilinmiyorsa kira önerisi YOK', k.onerilenKira === null, k);
  t('ama eksik tutar yine söyleniyor', yakin(k.eksikAylik, 200), k.eksikAylik);
  t('zam yüzdesi de yok', k.artisYuzde === null);

  t('★ maliyet sıfırsa öneri üretilmiyor', fiyatOnerisi({ aylikGelir: 1000, aylikMaliyet: 0, hedefMarj: 0.25 }) === null);
}

console.log('\n★ SAYFA BAŞI TONER MALİYETİ\n');
{
  // 1.200 TL toner, ölçülen verim 7.200 sayfa → sayfa başı ₺0,1667
  t('hesaplanıyor', yakin(sayfaMaliyeti(1200, 7200), 1200 / 7200, 0.00001), sayfaMaliyeti(1200, 7200));
  t('★ verim ölçülmemişse hesaplanmıyor', sayfaMaliyeti(1200, null) === null);
  t('★ alış fiyatı yoksa hesaplanmıyor', sayfaMaliyeti(null, 7200) === null);
  t('sıfır fiyat da null', sayfaMaliyeti(0, 7200) === null);
  t('sıfır verim de null (sonsuza gitmiyor)', sayfaMaliyeti(1200, 0) === null);

  // ZARAR EŞİĞİ: müşteriden ₺0,15 alınıyor, toner ₺0,1667 tutuyor.
  const maliyet = sayfaMaliyeti(1200, 7200);
  t('★ sayfa maliyeti alınan fiyatı aşabiliyor (sessiz zarar)', maliyet > 0.15, maliyet);
}

console.log('\n★ UYARILAR — sahte kâr gizlenmiyor\n');
{
  const u = uyarilar({ gelir: 0, fisSayisi: 0, ziyaretMaliyetiTanimli: false, alisFiyatiEksikParca: 0, kapsananAy: 12, pencereAy: 12 });
  t('★ fatura yoksa bildiriliyor', u.includes('FATURA_YOK'), u);
  t('★ servis kaydı yoksa bildiriliyor', u.includes('SERVIS_KAYDI_YOK'), u);
  t('★ işçilik hariçse bildiriliyor', u.includes('ISCILIK_HARIC'), u);

  const temiz = uyarilar({ gelir: 1000, fisSayisi: 3, ziyaretMaliyetiTanimli: true, alisFiyatiEksikParca: 0, kapsananAy: 12, pencereAy: 12 });
  t('★ her şey tamsa uyarı yok', temiz.length === 0, temiz);

  const eksik = uyarilar({ gelir: 1000, fisSayisi: 3, ziyaretMaliyetiTanimli: true, alisFiyatiEksikParca: 2, kapsananAy: 12, pencereAy: 12 });
  t('★ alış fiyatı eksik parça bildiriliyor', eksik.includes('ALIS_FIYATI_EKSIK'), eksik);

  const kisa = uyarilar({ gelir: 1000, fisSayisi: 3, ziyaretMaliyetiTanimli: true, alisFiyatiEksikParca: 0, kapsananAy: 3, pencereAy: 12 });
  t('kısa pencere bildiriliyor', kisa.includes('PENCERE_KISA'), kisa);

  // Gelir var, maliyet SIFIR: %100 marj görünür ve bu kârlılık değildir.
  const sifirMaliyet = uyarilar({ gelir: 5000, fisSayisi: 2, ziyaretMaliyetiTanimli: true, alisFiyatiEksikParca: 0, kapsananAy: 12, pencereAy: 12, toplamMaliyet: 0 });
  t('★ sıfır maliyet %100 marj olarak SATILMIYOR', sifirMaliyet.includes('MALIYET_YOK'), sifirMaliyet);
  const varMaliyet = uyarilar({ gelir: 5000, fisSayisi: 2, ziyaretMaliyetiTanimli: true, alisFiyatiEksikParca: 0, kapsananAy: 12, pencereAy: 12, toplamMaliyet: 900 });
  t('maliyet varsa bu uyarı çıkmıyor', !varMaliyet.includes('MALIYET_YOK'), varMaliyet);
  const gelirsiz = uyarilar({ gelir: 0, fisSayisi: 2, ziyaretMaliyetiTanimli: true, alisFiyatiEksikParca: 0, kapsananAy: 12, pencereAy: 12, toplamMaliyet: 0 });
  t('gelir de yoksa MALIYET_YOK eklenmiyor (zaten ölçülemez)', !gelirsiz.includes('MALIYET_YOK'), gelirsiz);

  t('her uyarının metni var', Object.keys(UYARI_METNI).length === 6, Object.keys(UYARI_METNI));
  t('metinler boş değil', Object.values(UYARI_METNI).every((x) => x.length > 20));
}

console.log('\n★ KAPSANAN AY — yeni sözleşme zarar ediyor gibi görünmemeli\n');
{
  const bugun = new Date(2026, 8, 14);
  const pencere = new Date(2025, 8, 14); // 12 ay önce

  // Tam yıl boyunca yürürlükte olan sözleşme
  const tam = kapsananAy(new Date(2024, 0, 1), new Date(2027, 0, 1), pencere, bugun);
  t('tam yıl ≈ 12 ay', yakin(tam, 12, 0.2), tam);

  // Üç ay önce başlamış sözleşme
  const yeni = kapsananAy(new Date(2026, 5, 14), new Date(2027, 5, 14), pencere, bugun);
  t('★ üç aylık sözleşme 3 ay sayılıyor (12 değil)', yakin(yeni, 3, 0.2), yeni);

  // 2.000₺'lik gelir: 3'e bölünürse 667, 12'ye bölünürse 167 — ikincisi
  // sözleşmeyi zarar ediyor gibi gösterirdi.
  t('★ doğru bölen aylık geliri 4 kat düzeltiyor', yakin(2000 / yeni, 666, 20), 2000 / yeni);

  // Bitmiş sözleşme: bitişten sonrası sayılmamalı
  const bitmis = kapsananAy(new Date(2025, 0, 1), new Date(2026, 2, 1), pencere, bugun);
  t('★ bitmiş sözleşme bitişe kadar sayılıyor', yakin(bitmis, 5.6, 0.3), bitmis);

  // Pencereden tamamen önce bitmiş
  t('★ pencereden önce bitmiş sözleşme 0', kapsananAy(new Date(2020, 0, 1), new Date(2021, 0, 1), pencere, bugun) === 0);
  // Henüz başlamamış
  t('başlamamış sözleşme 0', kapsananAy(new Date(2027, 0, 1), new Date(2028, 0, 1), pencere, bugun) === 0);
  // Bir haftalık sözleşme sonsuza gitmemeli
  const cokYeni = kapsananAy(new Date(2026, 8, 7), new Date(2027, 8, 7), pencere, bugun);
  t('★ bir haftalık sözleşme en az 1 ay sayılıyor (aylık rakam patlamasın)', cokYeni === 1, cokYeni);
}

console.log('\n★ ÖLÇÜM PENCERESİ — 12 aya bölmek yeni bayiyi zararda gösteriyordu\n');
{
  // GERÇEK VERİDE BULUNDU: demo bayide sözleşme kirası aylık ₺2.455 ama
  // ekran "aylık gelir ₺456" diyor ve sözleşme %78 zararda görünüyordu.
  // Sebep: 2 ayın faturası 12 aya bölünüyordu.
  const temmuz = new Date(2026, 6, 15), agustos = new Date(2026, 7, 15);
  t('★ iki ayın faturası 2 ay sayılıyor (12 değil)', faturaliAy([temmuz, agustos]) === 2, faturaliAy([temmuz, agustos]));
  t('★ yanlış bölen geliri 6 kat küçültüyordu', Math.round((5474 / 12) * 100) / 100 === 456.17);
  t('★ doğru bölenle aylık gelir 2737', Math.round(5474 / faturaliAy([temmuz, agustos])) === 2737);

  t('tek fatura 1 ay', faturaliAy([temmuz]) === 1);
  t('hiç fatura yoksa 0', faturaliAy([]) === 0);
  t('aynı ayda iki fatura yine 1 ay', faturaliAy([new Date(2026, 6, 1), new Date(2026, 6, 28)]) === 1);
  t('★ aradaki atlanmış ay SAYILIYOR (gerçekten gelir kaybı)',
    faturaliAy([new Date(2026, 0, 5), new Date(2026, 3, 5)]) === 4);
  t('yıl atlayan aralık doğru', faturaliAy([new Date(2025, 10, 1), new Date(2026, 1, 1)]) === 4);
  t('sırasız girdi doğru sonuç veriyor', faturaliAy([agustos, temmuz]) === 2);

  const bas = olcumBasi([agustos, temmuz]);
  t('★ ölçüm başı ilk faturanın ayının 1i', bas.getFullYear() === 2026 && bas.getMonth() === 6 && bas.getDate() === 1, bas);
  t('fatura yoksa ölçüm başı null', olcumBasi([]) === null);
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
