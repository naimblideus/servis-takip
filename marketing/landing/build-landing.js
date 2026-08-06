// Landing HTML -> Next.js client component üreteci.
// Çalıştır:  node marketing/landing/build-landing.js   (repo kökünden)
// Kaynak:    marketing/landing/index.html
// Çıktı:     src/app/_landing/Landing.tsx
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'marketing/landing/index.html'), 'utf8');

// ⛔ VERİ KAYBI KORUMASI (2026-08-07)
// Cihaz başına fiyatlandırma (data-inc/data-per + renderPrices) doğrudan
// src/app/_landing/Landing.tsx içine yazıldı; bu index.html o değişiklikleri
// İÇERMİYOR. Guard olmasaydı bu script canlı fiyatlandırmayı sessizce eski
// sabit fiyata geri döndürürdü. Önce index.html'i senkronla, sonra çalıştır.
if (!html.includes('data-inc') || !html.includes('data-per')) {
  console.error('\n⛔ DURDURULDU — index.html güncel değil.\n');
  console.error('   Eksik: cihaz başına fiyatlandırma (data-inc / data-per).');
  console.error('   Bu script çalışsaydı Landing.tsx içindeki CANLI fiyat modelini silecekti.\n');
  console.error('   Yapılacak: önce marketing/landing/index.html dosyasını');
  console.error('   src/app/_landing/Landing.tsx ile senkronla, sonra tekrar çalıştır.\n');
  process.exit(1);
}

const css  = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const body = html.match(/<body>([\s\S]*?)<script>/)[1];
const js   = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Template-literal içine güvenli gömme: ters bölü, backtick ve ${ kaçışla.
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const out = `import Script from "next/script";

// ⚙️ OTOMATİK ÜRETİLDİ — elle düzenleme! Kaynak: marketing/landing/index.html
// Yeniden üret:  node marketing/landing/build-landing.js
// JS bilerek string olarak tutulur (next/script ile çalışır) → tsc/eslint denetlemez,
// böylece "next build" TS hatasıyla kırılmaz.
const CSS = \`${esc(css)}\`;
const BODY = \`${esc(body)}\`;
const JS = \`${esc(js)}\`;

export default function Landing() {
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
      <Script id="stk-landing" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JS }} />
    </>
  );
}
`;

const outPath = path.join(root, 'src/app/_landing/Landing.tsx');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log('OK -> src/app/_landing/Landing.tsx (' + out.length + ' byte) | CSS=' + css.length + ' BODY=' + body.length + ' JS=' + js.length);
