/**
 * PWA İKONLARINI MARKANIN KENDİ İŞARETİNDEN ÜRET.
 *
 * Çalıştır:  node scripts/ikon-uret.mjs
 *
 * ── NİYE SCRIPT ──────────────────────────────────────────────────────────
 * İkonlar elle çizilip depoya atılırsa, marka işareti değiştiğinde PNG'ler
 * eskide kalır ve kimse fark etmez — landing'de yeni logo, telefondaki
 * uygulamada eski logo durur. Burada tek kaynak var: aşağıdaki path'ler
 * landing'deki `.logo-n` işaretinin BİREBİR aynısı. İşaret değişirse bu
 * dosya güncellenir ve bütün boyutlar yeniden üretilir.
 *
 * ── İŞARETİN YAPISI ──────────────────────────────────────────────────────
 * N üç parçadan oluşuyor (sol dikme, diyagonal, sağ dikme) ve üstünden bir
 * KESİK geçiyor. Kesik ayrı bir renk değil: ZEMİN rengiyle çiziliyor. Harfin
 * içinden geçen swoosh böyle oluşuyor — yani kesiğin rengi zeminle aynı
 * olmak ZORUNDA, yoksa işaret bozulur.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Marka renkleri — landing'deki .logo-n ile aynı. */
const ZEMIN = '#0d121c';   // koyu; kesik de bu renkle çiziliyor
const GOVDE = '#e6ecf5';   // gümüş: düz beyaz yerine hafif soğuk ton

/** Landing'deki işaretin viewBox'ı. */
const IC_EN = 230, IC_BOY = 200;

/**
 * İşaret tuvalin %55'ini kaplıyor. Daha büyüğü maskable ikonda (Android
 * ikonu daireye kırpar) kenarlardan kesilirdi; daha küçüğü ana ekranda
 * kaybolurdu.
 */
const DOLULUK = 0.55;

function svgUret(boyut) {
  const en = boyut * DOLULUK;
  const olcek = en / IC_EN;
  const boy = IC_BOY * olcek;
  const x = (boyut - en) / 2;
  const y = (boyut - boy) / 2;
  // Kesik çizgi kalınlığı da ölçekle büyümeli; sabit bırakılsaydı küçük
  // ikonda swoosh kaybolur, büyükte kıl gibi kalırdı.
  const kalinlik = 13;

  return `<svg width="${boyut}" height="${boyut}" viewBox="0 0 ${boyut} ${boyut}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${boyut}" height="${boyut}" fill="${ZEMIN}"/>
  <g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${olcek.toFixed(5)})">
    <g fill="${GOVDE}">
      <rect x="30" y="20" width="38" height="160"/>
      <polygon points="68,20 106,20 150,180 112,180"/>
      <rect x="150" y="20" width="38" height="160"/>
    </g>
    <path d="M14 154 C84 120 152 78 224 34" fill="none" stroke="${ZEMIN}"
      stroke-width="${kalinlik}" stroke-linecap="round"/>
  </g>
</svg>`;
}

const HEDEFLER = [
  ['public/icon-512.png', 512],
  ['public/icon-192.png', 192],
  ['public/apple-touch-icon.png', 180],
];

// Kaynak SVG de depoda dursun: tarayıcı bazı yerlerde PNG yerine onu ister
// ve ikisi ayrışırsa hangisinin doğru olduğu bilinemez.
writeFileSync(join(KOK, 'public/icon.svg'), svgUret(512), 'utf8');
console.log('  public/icon.svg');

for (const [yol, boyut] of HEDEFLER) {
  const png = await sharp(Buffer.from(svgUret(boyut))).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(KOK, yol), png);
  console.log(`  ${yol}  ${boyut}×${boyut}  ${(png.length / 1024).toFixed(1)} KB`);
}

console.log('\nBitti — ikonlar markanın çizik N işaretinden üretildi.');
