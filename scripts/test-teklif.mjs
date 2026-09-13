// TEKLİF MOTORU — aday müşteriye fiyat çıkarmak
// Çalıştır:  node scripts/test-teklif.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Buradan çıkan rakam MÜŞTERİYE söyleniyor ve bir yıl bağlayıcı oluyor.
// İki yönlü pahalı: düşük fiyat verirsen bir yıl zarar eden sözleşme,
// uydurma tasarruf vaadi verirsen tutamayacağın bir söz. Test ettiklerim:
//
//   1. ÖLÇÜLMEMİŞ MODELDE FİYAT ÖNERİLMEZ. Uydurma maliyetten çıkan fiyat,
//      zarar eden sözleşmenin ta kendisidir.
//   2. MÜŞTERİNİN BUGÜNÜ BİLİNMİYORSA TASARRUF HESAPLANMAZ — bir makinesi
//      bile eksikse toplam tasarruf iddiası kurulamaz.
//   3. HEDEF MARJ MATEMATİĞİ: maliyet ÷ (1 − marj). Maliyetin üstüne yüzde
//      EKLEMEK hedefi hiç tutturmuyor.
//   4. RENKLİ SAYFA VARSA renkli maliyeti de ölçülmüş olmalı; yarım
//      maliyetle fiyat çıkarmak zararın en kolay yolu.
//   5. ELLE GİRİLEN FİYAT hesaplananı yener — bayi pazarlığı bilir.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-tkf-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/teklif.ts'), join(KOK, 'src/lib/toner-verimi.ts'),
    join(KOK, 'src/lib/device-brands.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
{
  const yol = join(g, 'teklif.js');
  writeFileSync(yol, readFileSync(yol, 'utf8')
    .split("'@/lib/prisma'").join("'./sahte.js'")
    .split("'@/lib/verim-ogrenme'").join("'./sahte.js'")
    .split("'@/lib/toner-verimi'").join("'./toner-verimi.js'")
    .split("'@/lib/sozlesme-karlilik'").join("'./sahte.js'"), 'utf8');
  const tv = join(g, 'toner-verimi.js');
  writeFileSync(tv, readFileSync(tv, 'utf8')
    .split("'@/lib/prisma'").join("'./sahte.js'")
    .split("'@/lib/device-brands'").join("'./device-brands.js'"), 'utf8');
  writeFileSync(join(g, 'sahte.js'), [
    'export const prisma = {};',
    'export const verimleriOgren = async () => ({ cihaz: new Map(), model: new Map() });',
    'export const populasyonVerimleri = async () => new Map();',
    'export const sayfaMaliyeti = (f, v) => (f > 0 && v > 0 ? f / v : null);',
    'export const VARSAYILAN_HEDEF_MARJ = 0.25;',
    '',
  ].join('\n'), 'utf8');
}
const { satirHesapla, teklifOzeti, satirAnahtari } =
  await import(pathToFileURL(join(g, 'teklif.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const yakin = (a, b, tol = 0.011) => Math.abs(a - b) < tol;

const satir = (ek = {}) => ({
  marka: 'Kyocera', model: 'M2540', adet: 1,
  aylikSayfaSb: 5000, aylikSayfaRenkli: 0,
  mevcutAylikTutar: null, onerilenKira: null,
  onerilenSayfaSb: null, onerilenSayfaRenkli: null, ...ek,
});
// 5.000 sayfa × ₺0,10 = ₺500 maliyet
const MALIYET = { sb: 0.1, renkli: 0.25, gozlem: 6 };

console.log('\n★ ÖLÇÜLMEMİŞ MODELDE FİYAT ÖNERİLMİYOR\n');
{
  const yok = satirHesapla(satir(), undefined, 0.25);
  t('★ maliyet yoksa teklif ÜRETİLMİYOR', yok.teklifAylik === null, yok);
  t('kaynağı da yok', yok.teklifKaynagi === null);
  t('ölçülmediği işaretli', yok.maliyetOlculdu === false);
  t('★ marj da hesaplanmıyor', yok.bizimMarj === null, yok);

  const sifir = satirHesapla(satir(), { sb: 0, renkli: null, gozlem: 0 }, 0.25);
  t('sıfır maliyet ölçüm sayılmıyor', sifir.maliyetOlculdu === false && sifir.teklifAylik === null, sifir);
}

console.log('\n★ RENKLİ SAYFA VARSA RENKLİ MALİYETİ DE ŞART\n');
{
  // Renkli basılıyor ama renkli maliyeti ölçülmemiş: yarım maliyetle
  // fiyat çıkarmak, renkli sayfaları bedavaya vermek olurdu.
  const yarim = satirHesapla(
    satir({ aylikSayfaRenkli: 2000 }),
    { sb: 0.1, renkli: null, gozlem: 3 },
    0.25,
  );
  t('★ renkli ölçülmemişse satır ölçülmemiş sayılıyor', yarim.maliyetOlculdu === false, yarim);
  t('★ fiyat önerilmiyor', yarim.teklifAylik === null, yarim);

  const tam = satirHesapla(satir({ aylikSayfaRenkli: 2000 }), MALIYET, 0.25);
  t('ikisi de ölçülüyse hesaplanıyor', tam.maliyetOlculdu === true, tam);
  // 5.000×0,10 + 2.000×0,25 = 500 + 500 = 1.000
  t('★ renkli maliyet hesaba giriyor (1000)', yakin(tam.bizimAylikMaliyet, 1000), tam.bizimAylikMaliyet);
  t('renkli sayfa toplamda sayılıyor', tam.aylikSayfa === 7000, tam.aylikSayfa);

  // Renkli basılmıyorsa renkli ölçümü ARANMIYOR.
  const monoOk = satirHesapla(satir({ aylikSayfaRenkli: 0 }), { sb: 0.1, renkli: null, gozlem: 3 }, 0.25);
  t('★ renkli basmıyorsa renkli ölçümü aranmıyor', monoOk.maliyetOlculdu === true, monoOk);
}

console.log('\n★ HEDEF MARJ — maliyetin üstüne yüzde EKLEMEK yanlış\n');
{
  const h = satirHesapla(satir(), MALIYET, 0.25);
  t('maliyet 500', yakin(h.bizimAylikMaliyet, 500), h.bizimAylikMaliyet);
  t('★ teklif 666,67 (500 ÷ 0,75)', yakin(h.teklifAylik, 666.67), h.teklifAylik);
  t('★ yanlış yöntem 625 verirdi', yakin(500 * 1.25, 625));
  t('★ o fiyatta marj %25 DEĞİL %20 olurdu', yakin((625 - 500) / 625, 0.2));
  t('★ önerilen fiyatta marj GERÇEKTEN %25', yakin(h.bizimMarj, 0.25), h.bizimMarj);
  t('kaynağı HESAPLANDI', h.teklifKaynagi === 'HESAPLANDI');
  t('sayfa fiyatına çevriliyor', yakin(h.teklifSayfaSb, 666.67 / 5000, 0.0001), h.teklifSayfaSb);

  // Hedef %0: maliyetine satmak.
  t('hedef %0 → maliyetine', yakin(satirHesapla(satir(), MALIYET, 0).teklifAylik, 500));
  // Hedef %100 imkânsız.
  t('★ hedef %100 → fiyat üretilmiyor', satirHesapla(satir(), MALIYET, 1).teklifAylik === null);
}

console.log('\n★ ELLE GİRİLEN FİYAT HESAPLANANI YENİYOR\n');
{
  const elle = satirHesapla(satir({ onerilenSayfaSb: 0.2 }), MALIYET, 0.25);
  t('★ elle girilen kullanılıyor (5000 × 0,20 = 1000)', yakin(elle.teklifAylik, 1000), elle.teklifAylik);
  t('kaynağı ELLE', elle.teklifKaynagi === 'ELLE');
  t('★ marj elle fiyattan hesaplanıyor', yakin(elle.bizimMarj, 0.5), elle.bizimMarj);

  const kira = satirHesapla(satir({ onerilenKira: 800 }), MALIYET, 0.25);
  t('kira da elle girilebiliyor', yakin(kira.teklifAylik, 800), kira.teklifAylik);

  const ikisi = satirHesapla(satir({ onerilenKira: 300, onerilenSayfaSb: 0.1 }), MALIYET, 0.25);
  t('kira + sayfa birlikte (300 + 500)', yakin(ikisi.teklifAylik, 800), ikisi.teklifAylik);

  // ZARARINA TEKLİF GİZLENMİYOR: bayi maliyetin altına inerse marj negatif.
  const zarar = satirHesapla(satir({ onerilenSayfaSb: 0.05 }), MALIYET, 0.25);
  t('★ maliyetin altındaki teklifte marj NEGATİF (gizlenmiyor)', zarar.bizimMarj < 0, zarar.bizimMarj);
}

console.log('\n★ ADET ÇARPANI\n');
{
  const uc = satirHesapla(satir({ adet: 3 }), MALIYET, 0.25);
  t('★ maliyet adetle çarpılıyor (1500)', yakin(uc.bizimAylikMaliyet, 1500), uc.bizimAylikMaliyet);
  t('sayfa da çarpılıyor (15.000)', uc.aylikSayfa === 15000, uc.aylikSayfa);
  t('teklif de çarpılıyor (2000)', yakin(uc.teklifAylik, 2000), uc.teklifAylik);
  t('sıfır/negatif adet en az 1 sayılıyor', satirHesapla(satir({ adet: 0 }), MALIYET, 0.25).adet === 1);
}

console.log('\n★ MÜŞTERİNİN BUGÜNÜ VE TASARRUF\n');
{
  const h = satirHesapla(satir({ mevcutAylikTutar: 1200 }), MALIYET, 0.25);
  t('mevcut sayfa maliyeti 0,24', yakin(h.mevcutSayfaMaliyeti, 0.24, 0.0001), h.mevcutSayfaMaliyeti);
  t('★ tasarruf 533,33', yakin(h.aylikTasarruf, 533.33), h.aylikTasarruf);

  const bilinmiyor = satirHesapla(satir(), MALIYET, 0.25);
  t('★ bugünü bilinmiyorsa sayfa maliyeti hesaplanmıyor', bilinmiyor.mevcutSayfaMaliyeti === null);
  t('★ tasarruf da hesaplanmıyor', bilinmiyor.aylikTasarruf === null);
  t('sıfır ödeme "bilinmiyor" sayılıyor',
    satirHesapla(satir({ mevcutAylikTutar: 0 }), MALIYET, 0.25).mevcutAylik === null);

  // Bizimki PAHALIYSA bu da gizlenmiyor.
  const pahali = satirHesapla(satir({ mevcutAylikTutar: 400 }), MALIYET, 0.25);
  t('★ bizimki pahalıysa tasarruf NEGATİF (gizlenmiyor)', pahali.aylikTasarruf < 0, pahali.aylikTasarruf);
}

console.log('\n★ ÖZET — BİR SATIR EKSİKSE TOPLAM İDDİA KURULMUYOR\n');
{
  const tamHepsi = [
    satirHesapla(satir({ mevcutAylikTutar: 1200 }), MALIYET, 0.25),
    satirHesapla(satir({ marka: 'HP', model: 'M404', mevcutAylikTutar: 800, aylikSayfaSb: 3000 }), MALIYET, 0.25),
  ];
  const o = teklifOzeti(tamHepsi);
  t('makine sayısı 2', o.makineSayisi === 2);
  t('aylık sayfa 8000', o.aylikSayfa === 8000, o.aylikSayfa);
  t('mevcut toplam 2000', yakin(o.mevcutAylik, 2000), o.mevcutAylik);
  // 666,67 + 400 = 1066,67
  t('teklif toplam 1066,67', yakin(o.teklifAylik, 1066.67), o.teklifAylik);
  t('★ yıllık tasarruf ~11.200', yakin(o.yillikTasarruf, 11200, 0.5), o.yillikTasarruf);
  t('tasarruf yüzdesi hesaplanıyor', yakin(o.tasarrufYuzde, 933.33 / 2000), o.tasarrufYuzde);
  t('★ toplam marj %25', yakin(o.bizimMarj, 0.25), o.bizimMarj);

  // BİR satırda bugünkü ödeme eksik → TOPLAM TASARRUF İDDİASI YOK.
  const eksik = [tamHepsi[0], satirHesapla(satir({ marka: 'HP', model: 'M404' }), MALIYET, 0.25)];
  const oe = teklifOzeti(eksik);
  t('★ bir satır eksikse mevcut toplam null', oe.mevcutAylik === null, oe.mevcutAylik);
  t('★ tasarruf iddiası kurulmuyor', oe.aylikTasarruf === null && oe.yillikTasarruf === null, oe);
  t('kaç satırın eksik olduğu söyleniyor', oe.mevcutBilinmeyenSatir === 1, oe.mevcutBilinmeyenSatir);
  t('ama teklif toplamı yine çıkıyor', oe.teklifAylik !== null, oe.teklifAylik);

  // Bir satırın fiyatı çıkmıyorsa TOPLAM TEKLİF de çıkmamalı: eksik
  // toplamı müşteriye "aylık şu kadar" diye vermek yanlış olurdu.
  const fiyatsiz = [tamHepsi[0], satirHesapla(satir({ marka: 'Yeni', model: 'X' }), undefined, 0.25)];
  const of = teklifOzeti(fiyatsiz);
  t('★ bir satır fiyatsızsa TOPLAM TEKLİF yok', of.teklifAylik === null, of.teklifAylik);
  t('kaç satırın fiyatsız olduğu söyleniyor', of.teklifsizSatir === 1, of.teklifsizSatir);
  t('ölçülmeyen satır sayısı da var', of.olculmeyenSatir === 1, of.olculmeyenSatir);
  t('★ toplam marj da uydurulmuyor', of.bizimMarj === null, of.bizimMarj);

  t('boş teklifte sayılar sıfır/null', (() => {
    const b = teklifOzeti([]);
    return b.makineSayisi === 0 && b.aylikSayfa === 0 && b.teklifAylik === 0;
  })());
}

console.log('\nMODEL ANAHTARI\n');
{
  t('marka+model birleşiyor', satirAnahtari('Kyocera', 'M2540') === 'KYOCERA|M2540');
  t('★ yazım farkı aynı anahtara düşüyor', satirAnahtari('kyocera', 'm-2540') === satirAnahtari('KYOCERA', 'M 2540'));
  t('boş değerler patlatmıyor', satirAnahtari('', '') === '?|?');
  // TÜRKÇE BÜYÜKHARF TUZAĞI: 'Ricoh'.toLocaleUpperCase('tr') → 'RİCOH',
  // 'RICOH' ise 'RICOH' kalır. İki yazım ayrı gruba düşseydi bir cihazda
  // ölçülen verim diğerine geçmezdi. Çıktı dizesi değil, AYNI YERE
  // DÜŞMELERİ sınanıyor.
  t('★ RICOH ile Ricoh AYNI anahtara düşüyor',
    satirAnahtari('RICOH', 'IM 350') === satirAnahtari('Ricoh', 'IM 350'),
    [satirAnahtari('RICOH', 'IM 350'), satirAnahtari('Ricoh', 'IM 350')]);
  t('★ ricoh (küçük) de aynı yere',
    satirAnahtari('ricoh', 'im 350') === satirAnahtari('Ricoh', 'IM 350'));
  t('★ marka kanonikleşiyor (hp = HP = Hewlett Packard)',
    satirAnahtari('hp', 'M404') === satirAnahtari('HP', 'M404'));
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
