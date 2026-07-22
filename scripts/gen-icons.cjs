// public/icon.svg -> PWA PNG ikonları (sharp ile). Çalıştır: node scripts/gen-icons.cjs
const sharp = require('sharp');
const fs = require('fs');
const svg = fs.readFileSync('public/icon.svg');
(async () => {
  await sharp(svg).resize(192, 192).png().toFile('public/icon-192.png');
  await sharp(svg).resize(512, 512).png().toFile('public/icon-512.png');
  await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');
  console.log('OK: icon-192, icon-512, apple-touch-icon üretildi');
})().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
