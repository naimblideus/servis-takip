// Inter'i Google Fonts'tan indirip YEREL @font-face üretir.
//
// NEDEN: yazdırma sayfaları (ekstre, servis fişi, fatura, makbuz) fontu
// internetten çekiyordu. Bayi internetsizken ya da yavaş bağlantıda belge
// yazdırdığında font gelmiyor/gecikiyordu — bunlar kâğıda basılıp müşteriye
// verilen belgeler; görünümleri bağlantıya bağlı olamaz.
//
// DEĞİŞKEN FONT: tek dosya 400-800 arası bütün ağırlıkları taşır. Ağırlık
// başına ayrı dosya indirilince toplam 650 KB oluyordu; değişken sürümle
// çok daha küçük. Belgeler beş ağırlığın hepsini kullanıyor, yani hepsi
// gerekiyordu.
//
// SUBSET: yalnız latin + latin-ext. Türkçe ş/ğ/ı/İ/ç/ö/ü latin-ext'te,
// temel harfler latin'de. Kiril/Yunan/Vietnamca gereksiz ağırlık.
//
// Çalıştır: node scripts/font-indir.mjs
import fs from 'node:fs';
import path from 'node:path';

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const HEDEF = path.join(process.cwd(), 'public', 'fonts');
const ISTENEN = new Set(['latin', 'latin-ext']);

const css = await fetch(CSS_URL, { headers: { 'User-Agent': UA } }).then((r) => r.text());
const bloklar = css.split('/*').slice(1).map((b) => '/*' + b);

fs.mkdirSync(HEDEF, { recursive: true });
for (const f of fs.readdirSync(HEDEF)) {
  if (/^inter-.*\.woff2$/.test(f)) fs.unlinkSync(path.join(HEDEF, f));
}

const kurallar = [];
let indirilen = 0, toplamBayt = 0;

for (const b of bloklar) {
  const subset = (b.match(/^\/\*\s*([a-z-]+)\s*\*\//) || [])[1];
  if (!subset || !ISTENEN.has(subset)) continue;

  const url = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
  const range = (b.match(/unicode-range:\s*([^;]+);/) || [])[1];
  const agirlik = (b.match(/font-weight:\s*([\d\s]+);/) || [])[1]?.trim() || '400 800';
  if (!url) continue;

  const ad = `inter-${subset}.woff2`;
  const buf = Buffer.from(await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.arrayBuffer()));
  fs.writeFileSync(path.join(HEDEF, ad), buf);
  indirilen++; toplamBayt += buf.length;

  kurallar.push(
    `@font-face {\n` +
    `  font-family: 'Inter';\n` +
    `  font-style: normal;\n` +
    `  font-weight: ${agirlik};\n` +
    `  font-display: swap;\n` +
    `  src: url('/fonts/${ad}') format('woff2');\n` +
    `  unicode-range: ${range};\n` +
    `}`
  );
}

if (kurallar.length === 0) throw new Error('Hiç subset indirilemedi — Google Fonts biçimi değişmiş olabilir.');

const cikti =
`/* Inter — YEREL (değişken font). Kaynak: Google Fonts, SIL Open Font License.

   Yazdırma sayfaları internetsizken de doğru fontla bassın diye burada:
   ekstre, servis fişi, fatura ve makbuz kâğıda basılıp müşteriye verilir.
   Tek dosya 400-800 arası bütün ağırlıkları taşır.

   ELLE DÜZENLEME — bu dosya betikle üretilir.
   Yenilemek için: node scripts/font-indir.mjs */

${kurallar.join('\n\n')}
`;

fs.writeFileSync(path.join(HEDEF, 'inter.css'), cikti);
console.log(`${indirilen} woff2 indirildi · ${(toplamBayt / 1024).toFixed(0)} KB`);
console.log(`yazıldı: public/fonts/inter.css (${kurallar.length} @font-face)`);
