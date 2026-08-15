// Landing HTML -> Next.js client component üreteci.
//
// Çalıştır:  node marketing/landing/build-landing.js   (repo kökünden)
// Kaynak:    marketing/landing/nextus-servis.html   ← TEK KAYNAK
// Çıktı:     src/app/_landing/Landing.tsx           ← / rotasında yayınlanan
//
// TEK KAYNAK nextus-servis.html'dir. Servora dönemine ait eski index.html
// SİLİNDİ (2026-08): üretime hiç girmiyordu, cihaz başına fiyat mantığı yoktu
// ve hangi dosyanın canlı olduğu konusunda kafa karıştırıyordu.
//
// FONTLAR: Kaynak HTML tek dosya olarak (file://) da açılabilsin diye fontları
// base64 @font-face ile gömüyor (~500 KB). Next sürümünde bu gereksiz ağırlık:
// aynı fontlar <link> ile getiriliyor. Bu yüzden base64 @font-face blokları
// çıkarılır — font-family bildirimleri ve sistem yedekleri olduğu gibi kalır.
const fs = require('fs');
const path = require('path');

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

// Template-literal içine güvenli gömme: ters bölü, backtick ve ${ kaçışla.
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const out = `import Script from "next/script";

// ⚙️ OTOMATİK ÜRETİLDİ — elle düzenleme! Kaynak: ${SRC}
// Yeniden üret:  node marketing/landing/build-landing.js
// JS bilerek string olarak tutulur (next/script ile çalışır) → tsc/eslint denetlemez,
// böylece "next build" TS hatasıyla kırılmaz.
const CSS = \`${esc(css)}\`;
const BODY = \`${esc(body)}\`;
const JS = \`${esc(js)}\`;

export default function Landing() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
      <Script id="stk-landing" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JS }} />
    </>
  );
}
`;

const hedef = path.join(root, 'src/app/_landing/Landing.tsx');
fs.writeFileSync(hedef, out, 'utf8');
console.log(`✓ Landing.tsx üretildi (${SRC})`);
console.log(`  CSS ${(css.length / 1024).toFixed(0)} KB · gömülü fontlardan kazanç ${(kazanc / 1024).toFixed(0)} KB`);
console.log(`  BODY ${(body.length / 1024).toFixed(0)} KB · JS ${(js.length / 1024).toFixed(0)} KB`);
