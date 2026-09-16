// TANITIM SAYFASI — İngilizce sürüm bütünlüğü
// Çalıştır:  node scripts/test-landing-en.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Tanıtım sayfası TEK kaynaktan (marketing/landing/nextus-servis.html) iki dile
// üretiliyor. Bu kurgunun üç sessiz bozulma yolu var; üçü de müşteri gözüyle
// görülene kadar fark edilmez:
//
//   1. TÜRKÇE KAYNAK DEĞİŞİR, SÖZLÜK DEĞİŞMEZ — yeni cümle İngilizce sayfada
//      Türkçe görünür. Avrupalı ziyaretçi için "bu ürün bize yazılmamış"
//      demektir; en pahalı yarım çeviri, satış sayfasındaki çeviridir.
//   2. ÜRETİLMİŞ DOSYA BAYAT KALIR — HTML düzenlenir ama
//      `node marketing/landing/build-landing.js` koşturulmaz. Canlıya eski
//      sayfa çıkar ve git diff'i temiz göründüğü için kimse anlamaz.
//   3. FİYAT İKİ SAYFADA AYRIŞIR — İngilizce sayfada taban ücret ya da aşım
//      bedeli farklı kalır. Bu artık çeviri hatası değil, YANLIŞ FİYAT
//      göstermektir.
//
// Sayı biçimi de burada kilitli: Türkçe "₺1.500" ile İngilizce "₺1,500"
// karışırsa 1.500'ü "bir nokta beş" okuyan bir ziyaretçi fiyatı bin kat
// yanlış anlar.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { ingilizceYap, SOZLUK } = require(join(KOK, 'marketing/landing/en/cevir.js'));

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const KAYNAK = join(KOK, 'marketing/landing/nextus-servis.html');
const html = readFileSync(KAYNAK, 'utf8');
const govde = html.match(/<body>([\s\S]*?)<script>/)[1];
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ SÖZLÜK KAPISI');
// ───────────────────────────────────────────────────────────────────────────
let en;
try {
  en = ingilizceYap(govde, js);
} catch (e) {
  // Guard'lı değişimlerden biri tutmadı: kaynaktaki bir JS satırı değişmiş.
  console.log(`  ✗ ingilizceYap çalışmadı\n      ${e.message}`);
  console.log('\n0 geçti, 1 kaldı\n');
  process.exit(1);
}
t('kaynaktaki her metnin İngilizcesi var', en.eksik.length === 0, en.eksik.slice(0, 8));
t('sözlük dolu (500+ kayıt)', Object.keys(SOZLUK).length > 500, Object.keys(SOZLUK).length);

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ GÖRÜNÜR METİNDE TÜRKÇE KALINTI');
// ───────────────────────────────────────────────────────────────────────────
// Yalnız Türkçeye özgü harfler aranır: "Service" gibi iki dilde de aynı yazılan
// kelimeler kalıntı değildir. Yorum satırları geliştirici notu, elenir.
const TR_HARF = /[ğĞıİşŞçÇöÖüÜ]/;
// Bilerek Türkçe kalanlar: dil seçici etiketi, kurucunun adı, örnek ekrandaki
// rota şehri, Türk vergi idaresinin kısaltması.
const IZIN = ['Türkçe', 'Kadıköy', 'Mehmet Naim Çetin', 'GİB'];
const izinli = (s) => IZIN.some((i) => s.includes(i));

const yorumsuz = en.govde.replace(/<!--[\s\S]*?-->/g, '');
const kalinti = [];
for (const m of yorumsuz.matchAll(/>([^<>]+)</g)) {
  const s = m[1].trim();
  if (s && TR_HARF.test(s) && !izinli(s)) kalinti.push(s);
}
for (const attr of ['placeholder', 'aria-label', 'title', 'alt', 'data-label']) {
  for (const m of yorumsuz.matchAll(new RegExp(`(?<![-\\w])${attr}="([^"]+)"`, 'g'))) {
    const s = m[1].trim();
    if (s && TR_HARF.test(s) && !izinli(s)) kalinti.push(`${attr}="${s}"`);
  }
}
t('gövdede görünür Türkçe metin yok', kalinti.length === 0, kalinti.slice(0, 8));

/**
 * Betikteki dize sabitleri — yorum satırları elenerek.
 * Yorumları elemek ŞART: bu dosyada uzun Türkçe açıklama blokları var ve
 * içlerindeki kesme işaretleri dize sınırı sanılıp yarım kalan "dizeler"
 * üretiyor. Aranan şey ekrana yazılan metin, geliştirici notu değil.
 */
function jsDizeleri(kod) {
  const out = [];
  let blok = false;
  for (const ham of kod.split('\n')) {
    const sat = ham.trim();
    if (blok) { if (sat.includes('*/')) blok = false; continue; }
    if (sat.startsWith('/*')) { if (!sat.includes('*/')) blok = true; continue; }
    if (sat.startsWith('//') || sat.startsWith('*')) continue;
    for (const m of sat.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'/g)) out.push(m[1]);
    for (const m of sat.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)) out.push(m[1]);
  }
  return out;
}
const jsKalinti = jsDizeleri(en.js).filter((s) => TR_HARF.test(s) && !izinli(s));
t('script dizelerinde Türkçe metin yok', jsKalinti.length === 0, jsKalinti.slice(0, 8));

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ SAYI VE PARA BİÇİMİ');
// ───────────────────────────────────────────────────────────────────────────
t("TR binlik ayırıcı '.'", js.includes("(?!\\d))/g, '.')"));
t("EN binlik ayırıcı ','", en.js.includes("(?!\\d))/g, ',')"));
t("EN'de binlik '.' kalmadı", !en.js.includes("(?!\\d))/g, '.')"));
t("EN'de ondalık virgüle çevrilmiyor", !en.js.includes(".replace('.', ',')"));
t('EN yüzde sayının arkasında', en.js.includes("missPct + '%'") && !en.js.includes("'%' + missPct"));
t('para birimi iki sayfada da ₺', en.js.includes("'₺'") && js.includes("'₺'"));

// Gövdedeki sabit sayılar (ilk boyama ve JS kapalıyken ekranda duran değerler).
const trBicimliSayi = [...yorumsuz.matchAll(/>([^<>]+)</g)]
  .map((m) => m[1].trim())
  // TR biçim: binlik "1.500" · ondalık "2,1" (virgülden sonra iki basamak
  // gelirse bu İngilizce binliktir: "1,500") · önde yüzde "%10".
  .filter((s) => s && !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(s) && /\d\.\d{3}|\d,\d(?!\d\d)|%\s?\d/.test(s));
t('EN gövdesinde TR biçimli sayı kalmadı', trBicimliSayi.length === 0, trBicimliSayi.slice(0, 8));

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ FİYAT İKİ DİLDE AYNI');
// ───────────────────────────────────────────────────────────────────────────
// Fiyat sayıları çeviriye KONU DEĞİL: ayrışırlarsa bir dil yanlış fiyat gösterir.
const sayilar = (s) => (s.match(/base: \d+|included: \d+|PER_DEVICE = \d+|YEARLY_MONTHS = \d+|RECOVERY = [\d.]+/g) || []).join('|');
t('taban/dahil/aşım/yıllık/kurtarma sabitleri birebir aynı', sayilar(js) === sayilar(en.js), {
  tr: sayilar(js), en: sayilar(en.js),
});
t('aşım bedeli tek sabit (paket başına değil)', /PER_DEVICE = 25\b/.test(en.js));
const dataBase = (s) => (s.match(/data-base="\d+"/g) || []).join('|');
const dataInc = (s) => (s.match(/data-included="\d+"/g) || []).join('|');
t('fiyat kartlarındaki data-base aynı', dataBase(govde) === dataBase(en.govde), {
  tr: dataBase(govde), en: dataBase(en.govde),
});
t('fiyat kartlarındaki data-included aynı', dataInc(govde) === dataInc(en.govde));

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ DİL SEÇİCİ');
// ───────────────────────────────────────────────────────────────────────────
t('TR sayfada /en bağlantısı var (nav)', govde.includes('href="/en" class="btn btn-ghost btn-sm dil-sec"'));
t('TR sayfada /en bağlantısı var (mobil menü)', govde.includes('href="/en" class="nav-link-m"'));
t('EN sayfada TR bağlantısı var (nav)', en.govde.includes('>TR</a>') && en.govde.includes('hreflang="tr"'));
t('EN sayfada TR bağlantısı var (mobil menü)', en.govde.includes('>Türkçe</a>'));
t('EN sayfada /en bağlantısı kalmadı', !en.govde.includes('href="/en"'));

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ İLETİŞİM BAĞLANTILARI');
// ───────────────────────────────────────────────────────────────────────────
t('EN WhatsApp mesajlarında Türkçe kalmadı', !/wa\.me\/\d+\?text=Merhaba/.test(en.govde),
  (en.govde.match(/wa\.me\/\d+\?text=Merhaba[^"]{0,40}/g) || []).slice(0, 3));
t('EN formu talebi ayrı etiketler', en.js.includes("|| 'landing-en'"));
t('telefon numarası değişmedi', (en.govde.match(/905526961703/g) || []).length === (govde.match(/905526961703/g) || []).length);
t('EN telefon uluslararası biçimde', !/0552 696 17 03/.test(en.govde) && /\+90 552 696 17 03/.test(en.govde));

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ ÜRETİLMİŞ DOSYALAR GÜNCEL');
// ───────────────────────────────────────────────────────────────────────────
// Kaynak HTML değişip build koşturulmazsa canlıya eski sayfa çıkar.
// Aynı kaçış kuralı build-landing.js'teki ile: ters bölü, backtick, ${.
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const oku = (p) => { try { return readFileSync(join(KOK, p), 'utf8'); } catch { return ''; } };
const trTsx = oku('src/app/_landing/Landing.tsx');
const enTsx = oku('src/app/_landing/LandingEn.tsx');
const stil = oku('src/app/_landing/landing-stil.ts');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/@font-face\s*\{[^}]*base64[^}]*\}/g, '');

t('Landing.tsx kaynakla aynı gövdeyi taşıyor', trTsx.includes(esc(govde)));
t('LandingEn.tsx üretilen İngilizce gövdeyi taşıyor', enTsx.includes(esc(en.govde)));
t('LandingEn.tsx üretilen İngilizce betiği taşıyor', enTsx.includes(esc(en.js)));
t('landing-stil.ts kaynak CSS ile aynı', stil.includes(esc(css)));
t('CSS iki bileşende kopyalanmıyor', !trTsx.includes('const CSS = ') && !enTsx.includes('const CSS = '));
t('TR bileşeni lang="tr" veriyor', trTsx.includes('<div lang="tr"'));
t('EN bileşeni lang="en" veriyor', enTsx.includes('<div lang="en"'));

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ /en ROTASI');
// ───────────────────────────────────────────────────────────────────────────
const enSayfa = oku('src/app/en/page.tsx');
const trSayfa = oku('src/app/page.tsx');
const araKatman = oku('src/middleware.ts');
t('/en sayfası LandingEn kullanıyor', enSayfa.includes('LandingEn'));
t('/en sayfası hreflang alternatifleri veriyor', /languages:\s*\{[^}]*en:\s*'\/en'/.test(enSayfa));
t('/ sayfası hreflang alternatifleri veriyor', /languages:\s*\{[^}]*en:\s*'\/en'/.test(trSayfa));
t('/en girişli kullanıcıyı panele atıyor', /pathname === '\/en'/.test(araKatman));
t('/en middleware eşleşmesinde', /'\/en',/.test(araKatman));

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
