// Landing HTML -> Next.js client component üreteci (TR + EN).
//
// Çalıştır:  node marketing/landing/build-landing.js   (repo kökünden)
// Kaynak:    marketing/landing/nextus-servis.html   ← TEK KAYNAK (Türkçe)
// Sözlük:    marketing/landing/en/sozluk.json       ← TR → EN karşılıkları
// Çıktı:     src/app/_landing/landing-stil.ts       ← iki sayfanın ortak CSS'i
//            src/app/_landing/Landing.tsx           ← "/" rotası
//            src/app/_landing/LandingEn.tsx         ← "/en" rotası
//
// TEK KAYNAK nextus-servis.html'dir. Servora dönemine ait eski index.html
// SİLİNDİ (2026-08): üretime hiç girmiyordu, cihaz başına fiyat mantığı yoktu
// ve hangi dosyanın canlı olduğu konusunda kafa karıştırıyordu.
//
// İNGİLİZCESİ AYRI BİR HTML DOSYASI DEĞİL. İki dilli pazarlama sayfaları en çok
// şöyle bozulur: TR'ye bir bölüm eklenir, EN dosyası aylarca eski kalır. Burada
// İngilizce gövde her build'de Türkçe kaynaktan üretilir; sözlükte karşılığı
// olmayan tek bir cümle kalsa bile build DURUR (aşağıdaki "eksik" kapısı).
//
// FONTLAR: Kaynak HTML tek dosya olarak (file://) da açılabilsin diye fontları
// base64 @font-face ile gömüyor (~500 KB). Next sürümünde bu gereksiz ağırlık:
// aynı fontlar <link> ile getiriliyor. Bu yüzden base64 @font-face blokları
// çıkarılır — font-family bildirimleri ve sistem yedekleri olduğu gibi kalır.
const fs = require('fs');
const path = require('path');
const { ingilizceYap } = require('./en/cevir');

const root = path.resolve(__dirname, '..', '..');
const SRC = 'marketing/landing/nextus-servis.html';
const html = fs.readFileSync(path.join(root, SRC), 'utf8');

// Canlı fiyatlandırmanın kazara silinmesine karşı kapı.
// Kaynakta cihaz başına fiyat modeli yoksa üretim yapma: taban ücret (data-base),
// pakete dahil cihaz (data-included) ve tek sabit aşım bedeli (PER_DEVICE) şart.
// PER_DEVICE'ın TEK bir sabit olması bilinçli: paket başına ayrı birim fiyat
// verilseydi belirli bir cihaz sayısının üstünde üst paket alt paketten ucuza düşerdi.
if (!html.includes('data-base') || !html.includes('data-included') || !html.includes('PER_DEVICE')) {
  console.error('\n⛔ DURDURULDU — kaynakta cihaz başına fiyatlandırma yok.');
  console.error('   Aranan: data-base + data-included + PER_DEVICE sabiti.');
  console.error('   Bu script çalışsaydı Landing.tsx içindeki canlı fiyat modelini silecekti.\n');
  process.exit(1);
}

let css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const body = html.match(/<body>([\s\S]*?)<script>/)[1];
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// base64 gömülü @font-face bloklarını çıkar (yalnızca gömülü olanları).
const oncekiBoyut = css.length;
css = css.replace(/@font-face\s*\{[^}]*base64[^}]*\}/g, '');
const kazanc = oncekiBoyut - css.length;

// ── İngilizce sürüm ────────────────────────────────────────────────────────
// Sözlükte karşılığı olmayan metin kaldıysa üretim durur: aksi halde İngilizce
// sayfaya sessizce Türkçe cümle sızar ve bunu ilk fark eden müşteri olur.
const en = ingilizceYap(body, js);
if (en.eksik.length) {
  console.error(`\n⛔ DURDURULDU — ${en.eksik.length} metnin İngilizcesi yok.`);
  console.error('   marketing/landing/en/sozluk.json dosyasına ekleyin:\n');
  for (const t of en.eksik) console.error('   ' + JSON.stringify(t));
  console.error('');
  process.exit(1);
}

// Template-literal içine güvenli gömme: ters bölü, backtick ve ${ kaçışla.
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const BASLIK =
  `// ⚙️ OTOMATİK ÜRETİLDİ — elle düzenlemeyin! Kaynak: ${SRC}\n` +
  '// Yeniden üret:  node marketing/landing/build-landing.js\n';

// CSS iki sayfada da birebir aynı: ayrı modüle alınır ki pakette tek kopya kalsın.
const stilOut = `${BASLIK}export const LANDING_CSS = \`${esc(css)}\`;\n`;

/**
 * @param {string} ad     bileşen adı
 * @param {string} dil    <div lang="…"> — CSS'teki büyük harf dönüşümü buna bakar
 *                        (Türkçe'de "i" → "İ", İngilizce'de "i" → "I")
 * @param {string} govde  HTML gövdesi
 * @param {string} betik  sayfa içi JS
 */
const bilesen = (ad, dil, govde, betik) => `import Script from "next/script";
import { LANDING_CSS } from "./landing-stil";

${BASLIK}// JS bilerek string olarak tutulur (next/script ile çalışır) → tsc/eslint denetlemez,
// böylece "next build" TS hatasıyla kırılmaz.
const BODY = \`${esc(govde)}\`;
const JS = \`${esc(betik)}\`;

export default function ${ad}() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <div lang="${dil}" dangerouslySetInnerHTML={{ __html: BODY }} />
      <Script id="stk-landing-${dil}" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JS }} />
    </>
  );
}
`;

const yaz = (goreli, icerik) => fs.writeFileSync(path.join(root, goreli), icerik, 'utf8');

yaz('src/app/_landing/landing-stil.ts', stilOut);
yaz('src/app/_landing/Landing.tsx', bilesen('Landing', 'tr', body, js));
yaz('src/app/_landing/LandingEn.tsx', bilesen('LandingEn', 'en', en.govde, en.js));

const kb = (s) => (s.length / 1024).toFixed(0);
console.log(`✓ Landing.tsx + LandingEn.tsx üretildi (${SRC})`);
console.log(`  CSS ${kb(css)} KB (ortak) · gömülü fontlardan kazanç ${(kazanc / 1024).toFixed(0)} KB`);
console.log(`  TR  gövde ${kb(body)} KB · JS ${kb(js)} KB`);
console.log(`  EN  gövde ${kb(en.govde)} KB · JS ${kb(en.js)} KB`);
