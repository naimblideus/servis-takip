// TELEFON KABUĞU — kaydırma ve döndürme (src/app/mobil.css, Sidebar, layout)
// Çalıştır:  node scripts/test-pwa-kabuk.mjs
//
// NEDEN BU TEST
// 2026-10-18'de telefonda ölçülen beş kusur bir daha geri gelmesin:
//  1. Ana ekran uygulaması dikeye kilitliydi (manifest portrait-primary).
//  2. iPhone, 16 px altı giriş alanına dokununca sayfayı büyütüp yana
//     kaydırıyordu (32 ekranın 32'sinde böyle alan var).
//  3. Menü açıkken telefon yan çevrilince gövde kilitli kalıyordu.
//  4. #app-main kaydırma kabıydı: yapışkan çubuklar yapışmıyor, çapraz
//     kaydırma bütün sayfayı yana sallıyordu.
//  5. Yatay telefonda masaüstü düzeni yan menüyü 99 px'e sıkıştırıyordu.
// Bunlar tarayıcıda ölçüldü; bu test kuralların KODDA durduğunu kilitler.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const oku = (y) => readFileSync(join(KOK, y), 'utf8');
let gecti = 0, kaldi = 0;
const t = (ad, kosul) => { if (kosul) { gecti++; console.log(`  ✓ ${ad}`); } else { kaldi++; console.log(`  ✗ ${ad}`); } };

console.log('\nManifest\n');
const manifest = JSON.parse(oku('public/manifest.webmanifest'));
t('yön kilidi yok (yan çevrilebilir)', !String(manifest.orientation || 'any').startsWith('portrait'));
t('tek başına uygulama kipi korunuyor', manifest.display === 'standalone');

console.log('\nGiriş alanı yakınlaştırması (iOS)\n');
const kok = oku('src/app/layout.tsx');
t('viewport istek başına üretiliyor (generateViewport)', /export async function generateViewport\(/.test(kok));
t('maximumScale yalnız iOS tarayıcısında', /const ios = \/iPhone\|iPad\|iPod\/\.test\(ua\)/.test(kok) && /\.\.\.\(ios \? \{ maximumScale: 1 \} : \{\}\)/.test(kok));
t('userScalable kapatılmıyor (erişilebilirlik)', !/userScalable/.test(kok));
t('viewport-fit=cover korunuyor', /viewportFit: 'cover'/.test(kok));
t('mobil.css globals.css\'ten SONRA yükleniyor', kok.indexOf("import './globals.css'") > -1 && kok.indexOf("import './mobil.css'") > kok.indexOf("import './globals.css'"));

console.log('\nAna alan\n');
const panel = oku('src/app/(dashboard)/layout.tsx');
const main = (panel.match(/<main id="app-main" className="([^"]+)"/) || [])[1] || '';
t('ana alan kaydırma kabı değil (overflow-auto yok)', main && !/\boverflow-auto\b/.test(main) && !/\boverflow-y-auto\b/.test(main));
t('yatayda kırpılıyor (overflow-x-clip)', /\boverflow-x-clip\b/.test(main));

console.log('\nÇekmece ve döndürme\n');
const yan = oku('src/components/Sidebar.tsx');
const css = oku('src/app/mobil.css');
const sorgu = (yan.match(/const CEKMECE_KIPI = '([^']+)'/) || [])[1];
t('çekmece kipi sabiti tanımlı', Boolean(sorgu));
t('kilit çekmece kipine bağlı (matchMedia)', /window\.matchMedia\(CEKMECE_KIPI\)/.test(yan));
t('masaüstüne geçince çekmece kapanıyor', /if \(!mq\.matches\) setOpen\(false\)/.test(yan));
t('kilit html ve gövdede birlikte', /document\.documentElement\.style\.overflow = v/.test(yan) && /document\.body\.style\.overflow = v/.test(yan));
t('ayrılırken kilit kalkıyor', /kilit\(false\)/.test(yan));
t('karartma parmakla kaydırmayı yutmuyor (touch-action)', /id="app-perde"[^>]*touchAction: 'none'/.test(yan));
// CSS'teki yatay telefon sorgusu ile JS sorgusu aynı eşikleri kullanmalı.
t('CSS yatay telefon sorgusu JS ile aynı eşikte (1100 × 500)', /max-width: 1100px\) and \(max-height: 500px\)/.test(css) && /\(max-width: 1100px\) and \(max-height: 500px\)/.test(sorgu || ''));
t('CSS dikey telefon eşiği JS ile aynı (767)', /@media \(max-width: 767px\)/.test(css) && /\(max-width: 767px\)/.test(sorgu || ''));
t('yatay telefonda üst çubuk ve alt menü görünür', /#app-topbar \{\s*display: flex;/.test(css) && /#app-bottomnav \{\s*display: flex;/.test(css));
t('çekmece görünen yükseklik kadar (dvh)', /height: 100dvh;/.test(css));

console.log('\nÇentik ve ev çubuğu payları\n');
t('alt boşluk ev çubuğunu da sayıyor', /padding-bottom: calc\(5rem \+ env\(safe-area-inset-bottom\)\)/.test(css));
t('yan paylar (yatayda çentik)', /padding-left: env\(safe-area-inset-left\)/.test(css) && /padding-right: env\(safe-area-inset-right\)/.test(css));
t('üste yapışan öğe mobil çubuğun altında kalmıyor', /#app-main \.sticky\.top-0 \{\s*top: 3\.5rem;/.test(css));
t('alta yapışan çubuk alt menünün üstünde', /\.yapiskan-alt/.test(css) && /className="yapiskan-alt"/.test(oku('src/app/(dashboard)/satis/page.tsx')));
t('menü sonunda kaydırma arkaya geçmiyor', /overscroll-behavior: contain/.test(css));

console.log('\nRaporlar\n');
const rapor = oku('src/app/(dashboard)/reports/page.tsx');
t('iki aylık grafik de kendi kaydırma kabında', (rapor.match(/className="grafik-kaydir"/g) || []).length === 2);

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
