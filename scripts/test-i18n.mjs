// DİL KATMANI — sözlük bütünlüğü ve biçimlendirme
// Çalıştır:  node scripts/test-i18n.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Yarım çevrilmiş arayüz, hiç çevrilmemişten kötüdür: Avrupalı bir bayi üç
// ekran İngilizce, dördüncüsü Türkçe görünce ürünün kendisine yazılmadığını
// anlar. TypeScript eksik anahtarı yakalıyor ama şunları yakalamıyor:
//
//   1. İNGİLİZCE SÖZLÜKTE TÜRKÇE METİN — anahtar var, değer kopyala-yapıştır
//      kalmış ("Kaydet" yazıyor). Derleme geçer, ekran Türkçe kalır.
//   2. MENÜDE ÇEVİRİSİZ SAYFA — Sidebar'a yeni href eklenmiş, sözlüğe
//      yazılmamış. Yol adı olduğu gibi ekranda kalır.
//   3. BİÇİMLENDİRME — ₺1.234,56 ile €1,234.56 farkı; 16.09 ile 16/09 farkı.
//      Yanlış olursa Alman bayi 09/16'yı ay 9 gün 16 diye okur.
import { mkdtempSync, existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-i18n-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/i18n/tr.ts'), join(KOK, 'src/lib/i18n/en.ts'),
    join(KOK, 'src/lib/i18n/sozluk.ts'), join(KOK, 'src/lib/bicim.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
// tsc uzantısız bırakıyor; Node ESM uzantı ister.
for (const d of ['i18n/sozluk.js']) {
  const yol = join(g, d);
  writeFileSync(yol, readFileSync(yol, 'utf8').replace("from './tr'", "from './tr.js'").replace("from './en'", "from './en.js'"), 'utf8');
}

const { tr } = await import(pathToFileURL(join(g, 'i18n/tr.js')).href);
const { en } = await import(pathToFileURL(join(g, 'i18n/en.js')).href);
const { sozluk, dilMi, DILLER } = await import(pathToFileURL(join(g, 'i18n/sozluk.js')).href);
const { para, sayi, yuzde, tarih, tarihSaat, kisaTarih, paraBirimiMi, birimSimgesi, bicimYap, altBirim } = await import(pathToFileURL(join(g, 'bicim.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

/** Sözlük ağacındaki her yaprağı "a.b.c" yoluyla gez. */
function yapraklar(obj, yol = '') {
  const out = [];
  // Dizi elemanı METİNSE yapraktır. Eskiden dizi elemanına da yapraklar()
  // uygulanıyordu; metin Object.entries ile KARAKTERLERİNE bölünüyor ve
  // "2058 metin var" gibi saçma bir sayı çıkıyordu — İngilizce çeviri
  // Türkçesinden bir harf kısa olunca "eksik anahtar" sanılıyordu.
  const yaprakMi = (v) => v === null || typeof v !== 'object';
  for (const [k, v] of Object.entries(obj)) {
    const p = yol ? `${yol}.${k}` : k;
    if (Array.isArray(v)) {
      v.forEach((e, i) => {
        if (yaprakMi(e)) out.push([`${p}[${i}]`, e]);
        else out.push(...yapraklar(e, `${p}[${i}]`));
      });
    } else if (!yaprakMi(v)) out.push(...yapraklar(v, p));
    else out.push([p, v]);
  }
  return out;
}
const oku = (obj, yol) => yol.split(/\.|\[|\]\.?/).filter(Boolean)
  .reduce((o, k) => (o == null ? undefined : o[k]), obj);

console.log('\n★ SÖZLÜK BÜTÜNLÜĞÜ\n');
{
  const trY = yapraklar(tr), enY = yapraklar(en);
  t(`tr sözlüğünde ${trY.length} metin var`, trY.length > 100, trY.length);
  const eksik = trY.filter(([p]) => { const v = oku(en, p); return typeof v !== 'string' || !v.trim(); }).map(([p]) => p);
  t('★ tr\'deki HER anahtar en\'de dolu', eksik.length === 0, eksik.slice(0, 8));
  const fazla = enY.filter(([p]) => oku(tr, p) === undefined).map(([p]) => p);
  t('★ en\'de fazladan anahtar yok (yazım hatası tuzağı)', fazla.length === 0, fazla.slice(0, 8));

  // Türkçeye özgü harf İngilizce metinde geçiyorsa çeviri unutulmuştur.
  // Özel adlar (Türkçe, Nextus) muaf.
  const MUAF = new Set(['dil.tr']);
  const turkceKalan = enY
    .filter(([p, v]) => !MUAF.has(p) && /[şğıöüçŞĞİÖÜÇ]/.test(String(v)))
    .map(([p, v]) => `${p}: ${v}`);
  t('★ İngilizce sözlükte Türkçe harf kalmadı', turkceKalan.length === 0, turkceKalan.slice(0, 6));

  // Aynı anahtar iki dilde birebir aynıysa ya özel ad ya unutulmuş çeviri.
  const AYNI_OLABILIR = new Set(['dil.tr', 'dil.en', 'menu./dashboard', 'menu./whatsapp', 'giris.epostaYer',
  'genel.excelIndir', 'durum.oncelik.NORMAL', 'fisDetay.whatsapp', 'ariza.INSTALLATION',
  'cihazHizli.markaYer', 'cihazHizli.modelYer', 'fisYeni.model', 'fisPanel.notYer',
  'stok.markaYer', 'stok.model', 'stok.modelYer', 'faturalar.link',
  // Saf noktalama — çevrilecek kelime yok.
  'musteriMesaji.faturaDonem', 'musteriMesaji.odemeTarih',
  // Marka/model örnekleri — çevrilecek kelime yok.
  'cihaz.markaYer', 'cihaz.modelYer',
  // Uygulama adı — çevrilmez.
  'ikiAdim.adim1Vurgu',
  // 'SN' seri numarasinin iki dilde de kullanilan kisaltmasi.
  'etiket.seri',
  // 'Test' iki dilde de ayni kelime.
  'eFatura.testVurgu',
  // Urun adi ve saf noktalama.
  'icmal.firmaVarsayilan', 'icmal.tarihArasi',
  // Urun adi — cevrilmez.
  'dokum.firmaVarsayilan',
  'barkodEtiket.seri',
  // Sutun basligi 'Model' — iki dilde de ayni kelime.
  'teklif.sutunModel',
  // Veritabani terimi (upsert) — cevrilmez.
  'iceAktar.uyari2Son',
  // 'Disk' ve 'WhatsApp' iki dilde de ayni yazilir.
  'nobetci.ad.DISK', 'nobetci.ad.WHATSAPP',
  // 'Slug' URL terimi — Turkcesi de slug.
  'superAdmin.yeni.slug', 'superAdmin.detay.alanSlug',
  // 'Plan' iki dilde de ayni kelime.
  'superAdmin.eskiPanel.plan']);
  const ayni = trY.filter(([p, v]) => !AYNI_OLABILIR.has(p) && String(v).length > 3 && oku(en, p) === v).map(([p]) => p);
  t('★ tr ile en birebir aynı metin yok (özel adlar dışında)', ayni.length === 0, ayni.slice(0, 8));
}

console.log('\n★ MENÜDEKİ HER SAYFANIN ÇEVİRİSİ VAR\n');
{
  const kaynak = readFileSync(join(KOK, 'src/components/Sidebar.tsx'), 'utf8');
  const hrefler = [...kaynak.matchAll(/^\s*href: '([^']+)'/gm)].map((m) => m[1]);
  t(`Sidebar'da ${hrefler.length} menü maddesi bulundu`, hrefler.length >= 30, hrefler.length);
  const cevirisiz = hrefler.filter((h) => typeof tr.menu[h] !== 'string' || typeof en.menu[h] !== 'string');
  t('★ her href iki sözlükte de var', cevirisiz.length === 0, cevirisiz);
}

console.log('\n★ DİL SEÇİMİ\n');
{
  t('DILLER tr ve en', JSON.stringify(DILLER) === JSON.stringify(['tr', 'en']));
  t('dilMi("en") true', dilMi('en') === true);
  t('★ dilMi("de") false — desteklenmeyen dil kabul edilmiyor', dilMi('de') === false);
  t('dilMi(undefined) false', dilMi(undefined) === false);
  t('★ bilinmeyen dilde Türkçe döner (boş ekran değil)', sozluk('xx').genel.kaydet === 'Kaydet');
  t('sozluk("en") İngilizce', sozluk('en').genel.kaydet === 'Save');
}

console.log('\n★ PARA BİÇİMİ\n');
{
  const trTry = para(1234.56, { dil: 'tr', birim: 'TRY' });
  t('★ tr/TRY: ₺1.234,56', trTry.includes('₺') && trTry.includes('1.234,56'), trTry);
  const enEur = para(1234.56, { dil: 'en', birim: 'EUR' });
  t('★ en/EUR: €1,234.56', enEur.includes('€') && enEur.includes('1,234.56'), enEur);
  const trEur = para(1234.56, { dil: 'tr', birim: 'EUR' });
  t('tr/EUR: Türkçe ayraç, euro işareti', trEur.includes('€') && trEur.includes('1.234,56'), trEur);
  t('kesir 4: sayfa maliyeti', para(0.0779, { dil: 'tr', birim: 'TRY', kesir: 4 }).includes('0,0779'),
    para(0.0779, { dil: 'tr', birim: 'TRY', kesir: 4 }));
  t('★ bilinmeyen birim TRY\'ye düşer', para(10, { dil: 'tr', birim: 'XYZ' }).includes('₺'),
    para(10, { dil: 'tr', birim: 'XYZ' }));
  t('metin sayı kabul ediliyor (Decimal → string)', para('99.5', { dil: 'en', birim: 'GBP' }).includes('99.50'));
  t('★ null "—" (NaN ₺ değil)', para(null, { dil: 'tr' }) === '—');
  t('NaN "—"', para(Number.NaN, { dil: 'tr' }) === '—');
  t('paraBirimiMi("EUR")', paraBirimiMi('EUR') === true);
  t('paraBirimiMi("TL") false — ISO kodu değil', paraBirimiMi('TL') === false);
  // Alan etiketi "Tutar (₺)" — ISO kodu değil simge gösterilir.
  t('★ birimSimgesi tr/TRY ₺', birimSimgesi('tr', 'TRY') === '₺', birimSimgesi('tr', 'TRY'));
  t('★ birimSimgesi en/EUR €', birimSimgesi('en', 'EUR') === '€', birimSimgesi('en', 'EUR'));
  t('birimSimgesi bilinmeyen birim ₺', birimSimgesi('en', 'XYZ') === '₺', birimSimgesi('en', 'XYZ'));
}

// Sayfa maliyeti liranın binde biri mertebesinde; "₺0,0779" ile "₺0,3148"
// arasındaki farkı gözle yakalamak zor. Bayi alt birimle konuşuyor ve o
// gösterim İngilizceye geçerken kaybolmamalı — yalnız birimi değişmeli.
console.log('\n★ ALT BİRİM (kuruş / cent)\n');
{
  t('★ tr/TRY: 7,79 kr', altBirim(0.0779, { dil: 'tr', birim: 'TRY' }) === '7,79 kr',
    altBirim(0.0779, { dil: 'tr', birim: 'TRY' }));
  t('★ en/EUR: 7.79 c', altBirim(0.0779, { dil: 'en', birim: 'EUR' }) === '7.79 c',
    altBirim(0.0779, { dil: 'en', birim: 'EUR' }));
  t('en/GBP peni', altBirim(0.0779, { dil: 'en', birim: 'GBP' }) === '7.79 p',
    altBirim(0.0779, { dil: 'en', birim: 'GBP' }));
  t('tr/EUR: Türkçe ayraç, cent birimi', altBirim(0.0779, { dil: 'tr', birim: 'EUR' }) === '7,79 c',
    altBirim(0.0779, { dil: 'tr', birim: 'EUR' }));
  t('bilinmeyen birim kuruşa düşer', altBirim(0.1, { dil: 'tr', birim: 'XYZ' }) === '10,00 kr',
    altBirim(0.1, { dil: 'tr', birim: 'XYZ' }));
  t('★ null "—" (NaN kr değil)', altBirim(null, { dil: 'tr', birim: 'TRY' }) === '—');
  t('b.altBirim birime bağlı', bicimYap('en', 'GBP').altBirim(0.3148) === '31.48 p',
    bicimYap('en', 'GBP').altBirim(0.3148));
}

console.log('\n★ BAĞLI BİÇİMLENDİRİCİ (useBicim / sunucuBicimi ortak)\n');
{
  const b = bicimYap('en', 'EUR');
  t('★ b.para birime bağlı', b.para(1234.56).includes('€'), b.para(1234.56));
  t('b.sayi dile bağlı', b.sayi(12345) === '12,345', b.sayi(12345));
  t('b.tarih gün/ay/yıl', b.tarih(new Date(2026, 8, 16)) === '16/09/2026', b.tarih(new Date(2026, 8, 16)));
  t('b.simge €', b.simge === '€', b.simge);
  const tl = bicimYap('tr');
  t('★ birim verilmezse TRY', tl.birim === 'TRY' && tl.simge === '₺', [tl.birim, tl.simge]);
}

console.log('\n★ SAYI VE YÜZDE\n');
{
  t('tr: 12.345', sayi(12345, 'tr') === '12.345', sayi(12345, 'tr'));
  t('en: 12,345', sayi(12345, 'en') === '12,345', sayi(12345, 'en'));
  t('kesir 2 tr: 1.234,50', sayi(1234.5, 'tr', 2) === '1.234,50', sayi(1234.5, 'tr', 2));
  t('★ tr yüzde: %12', yuzde(12, 'tr') === '%12', yuzde(12, 'tr'));
  t('★ en yüzde: 12%', yuzde(12, 'en') === '12%', yuzde(12, 'en'));
  t('yüzde kesir: %12,5', yuzde(12.5, 'tr', 1) === '%12,5', yuzde(12.5, 'tr', 1));
}

console.log('\n★ TARİH — AVRUPA GÜN/AY/YIL\n');
{
  const d = new Date(2026, 8, 16, 14, 5); // 16 Eylül 2026 14:05 yerel
  t('★ tr: 16.09.2026', tarih(d, 'tr') === '16.09.2026', tarih(d, 'tr'));
  t('★ en: 16/09/2026 (gün önce — en-US 09/16 olurdu)', tarih(d, 'en') === '16/09/2026', tarih(d, 'en'));
  t('tr saat: 16.09.2026 14:05', tarihSaat(d, 'tr') === '16.09.2026 14:05', tarihSaat(d, 'tr'));
  t('★ en saat 24 saat: 14:05 (2:05 pm değil)', /14:05/.test(tarihSaat(d, 'en')) && !/pm/i.test(tarihSaat(d, 'en')), tarihSaat(d, 'en'));
  t('kısa tr: 16.09', kisaTarih(d, 'tr') === '16.09', kisaTarih(d, 'tr'));
  t('kısa en: 16/09', kisaTarih(d, 'en') === '16/09', kisaTarih(d, 'en'));
  t('ISO metin kabul', tarih('2026-09-16T10:00:00', 'tr') === '16.09.2026');
  t('★ geçersiz tarih "—"', tarih('bu tarih değil', 'tr') === '—');
  t('null "—"', tarih(null, 'en') === '—');
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
