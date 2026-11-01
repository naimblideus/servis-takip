// MATBAA MENÜSÜ — baskı merkezi ile bayi birbirinin ekranını görmez
// Çalıştır:  node scripts/test-matbaa-menu.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Aynı yazılım iki işletmeye hizmet ediyor: fotokopi servisi (BAYI) ve baskı
// merkezi (MATBAA). İki sessiz arıza var, ikisi de ekranda hata vermez:
//
//   · MATBAA BAYİ EKRANI GÖRÜR. Bayiye her hafta yeni ekran ekleniyor. Matbaa
//     menüsü yasak listesiyle kurulsaydı her yeni bayi ekranı (sayaç, cihaz,
//     kiralık filo) matbaada kendiliğinden belirirdi. Kural izin listesi.
//   · BAYİ MATBAA EKRANI GÖRÜR. Baskı işi ekranları bayinin menüsüne sızarsa
//     yüzlerce bayide anlamsız bir öğe çıkar.
//
// Ayrıca: tür oturum jetonuna KONMAZ (değişince yeniden giriş gerekmesin),
// matbaa uçları sunucuda türe bakar, göç idempotent ve varsayılan BAYI.
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-matbaa-menu-'));
let mod, tr, en;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      join(KOK, 'src/lib/menu-aileleri.ts'), join(KOK, 'src/lib/modules.ts'),
      join(KOK, 'src/lib/i18n/tr.ts'), join(KOK, 'src/lib/i18n/en.ts'),
      join(KOK, 'src/lib/i18n/sozluk.ts'), join(KOK, 'src/lib/bicim.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022',
      '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  const yol = join(g, 'menu-aileleri.js');
  writeFileSync(yol, readFileSync(yol, 'utf8').replace("from './modules'", "from './modules.js'"), 'utf8');
  mod = await import(pathToFileURL(yol).href);
  ({ tr } = await import(pathToFileURL(join(g, 'i18n/tr.js')).href));
  ({ en } = await import(pathToFileURL(join(g, 'i18n/en.js')).href));
} finally {
  rmSync(g, { recursive: true, force: true });
}
const {
  AILELER, MATBAA_MENUSU, MATBAA_OPERATOR_MENUSU, YALNIZ_MATBAA, TEKNISYEN_MENUSU,
  hesapTuru, hrefErisilir, menuKur, turdaAcik, sekmeGosterilir,
} = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (y) => readFileSync(join(KOK, y), 'utf8');

const HEPSI = ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'REPORTS', 'MARKETPLACE', 'PORTAL', 'SHOP', 'SLA'];
const erisim = (ek = {}) => ({ rol: 'ADMIN', ulke: 'TR', moduller: HEPSI, whatsappKurulu: true, bizimHesapKurulu: true, ...ek });
const gorunen = (e) => menuKur(e).flatMap((b) => b.aileler.flatMap((a) => a.sekmeler));
const tumEkranlar = AILELER.flatMap((a) => a.uyeler);

console.log('\nMatbaa menüsü\n');

// ── TÜR NORMALLEŞTİRİCİ ─────────────────────────────────────────────────
{
  t('MATBAA tanınıyor', hesapTuru('MATBAA') === 'MATBAA');
  t('★ bilinmeyen / boş değer BAYI (eski kayıt, bozuk veri)',
    [undefined, null, '', 'matbaa', 'general', 42, {}].every((x) => hesapTuru(x) === 'BAYI'));
}

// ── BAYİ MATBAA EKRANI GÖRMEZ ───────────────────────────────────────────
{
  for (const rol of ['ADMIN', 'FRONT_DESK', 'TECHNICIAN', 'SUPER_ADMIN']) {
    const g2 = gorunen(erisim({ rol }));
    t(`★ bayi ${rol} menüsünde matbaa ekranı yok`, g2.every((h) => !YALNIZ_MATBAA.includes(h)), g2.filter((h) => YALNIZ_MATBAA.includes(h)));
  }
  t('tür verilmeyen erişim bayi sayılıyor (eski çağıranlar)', !gorunen({ rol: 'ADMIN', ulke: 'TR', moduller: HEPSI, whatsappKurulu: true }).includes('/matbaa'));
  t('★ bayide /matbaa adresi kapalı (ModuleGuard)', !turdaAcik('/matbaa', 'BAYI') && !turdaAcik('/matbaa/isler/abc', 'BAYI'));
  t('bayide bayi ekranları açık', ['/dashboard', '/tickets/new', '/devices/abc', '/customers'].every((y) => turdaAcik(y, 'BAYI')));
}

// ── MATBAA BAYİ EKRANI GÖRMEZ ───────────────────────────────────────────
{
  const e = erisim({ tur: 'MATBAA' });
  const g2 = gorunen(e);
  t('★ matbaa menüsü yalnız izin listesinden', g2.every((h) => MATBAA_MENUSU.includes(h)), g2.filter((h) => !MATBAA_MENUSU.includes(h)));
  const BAYI_EKRANLARI = ['/dashboard', '/tickets', '/devices', '/sayac-turu', '/takip', '/invoices', '/sozlesmeler', '/inventory', '/market', '/magaza', '/whatsapp', '/kacan-gelir', '/pano'];
  t('★ matbaada cihaz, sayaç, fiş, sözleşme, pazar yok', BAYI_EKRANLARI.every((h) => !g2.includes(h)), g2.filter((h) => BAYI_EKRANLARI.includes(h)));
  t('matbaa Bugün ekranını görüyor', g2.includes('/matbaa'));
  t('matbaa müşteri, ayar, kullanıcı ve yardımı görüyor', ['/customers', '/settings', '/users', '/yardim'].every((h) => g2.includes(h)), g2);

  // Yeni bir bayi ekranı aileye eklendiğinde matbaa onu görmez: izin listesi.
  const sahte = '/yeni-bayi-ekrani';
  t('★ izin listesinde olmayan ekran matbaada kapalı (yeni bayi ekranı sızmaz)', !hrefErisilir(sahte, e) && hrefErisilir(sahte, erisim()));
  t('★ matbaada bayi adresi doğrudan da kapalı (ModuleGuard)',
    ['/dashboard', '/tickets/new', '/devices/abc', '/sayac-turu', '/invoices/123'].every((y) => !turdaAcik(y, 'MATBAA')));
  t('matbaada alt sayfa ekranına göre açık', ['/matbaa', '/customers/abc', '/settings', '/matbaa/isler/yeni'].every((y) => turdaAcik(y, 'MATBAA')));
  t('önek karışmıyor (/matbaa-x matbaa ekranı değil)', !turdaAcik('/matbaax', 'MATBAA') && turdaAcik('/matbaax', 'BAYI'));
}

// ── MATBAA ROLLERİ ──────────────────────────────────────────────────────
{
  const op = gorunen(erisim({ tur: 'MATBAA', rol: 'TECHNICIAN' }));
  t('★ matbaa operatörü yalnız operatör listesini görüyor', op.every((h) => MATBAA_OPERATOR_MENUSU.includes(h)), op);
  t('★ operatör Bugün\'ü (ciro) görmüyor', !op.includes('/matbaa'));
  t('operatör bayi teknisyen menüsünü görmüyor', !op.some((h) => TEKNISYEN_MENUSU.includes(h) && h !== '/yardim'), op);
  t('operatör listesi matbaa listesinin alt kümesi', MATBAA_OPERATOR_MENUSU.every((h) => MATBAA_MENUSU.includes(h)));
  const on = gorunen(erisim({ tur: 'MATBAA', rol: 'FRONT_DESK' }));
  t('tezgah Bugün\'ü görüyor', on.includes('/matbaa'));
  t('★ tezgah fiyat listesini, ayarı, kullanıcıları görmüyor', !hrefErisilir('/matbaa/fiyatlar', erisim({ tur: 'MATBAA', rol: 'FRONT_DESK' })) && !on.includes('/settings') && !on.includes('/users'));
  t('sahip fiyat listesine erişir', hrefErisilir('/matbaa/fiyatlar', erisim({ tur: 'MATBAA' })));
  t('matbaa menüsü kısa', menuKur(erisim({ tur: 'MATBAA' })).flatMap((b) => b.aileler).length <= 8);
  t('tek ekranlı matbaa ailesinde sekme çizilmez', sekmeGosterilir('/matbaa', erisim({ tur: 'MATBAA' })) === null);
}

// ── HER MATBAA EKRANI KAYITLI ───────────────────────────────────────────
{
  t('YALNIZ_MATBAA ekranları matbaa izin listesinde', YALNIZ_MATBAA.every((h) => MATBAA_MENUSU.includes(h)));
  const dizin = join(KOK, 'src/app/(dashboard)/matbaa');
  const altlar = existsSync(dizin)
    ? readdirSync(dizin, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(dizin, d.name, 'page.tsx'))).map((d) => `/matbaa/${d.name}`)
    : [];
  const kayitsiz = altlar.filter((h) => !MATBAA_MENUSU.includes(h));
  t('★ /matbaa altındaki her ekran izin listesinde', kayitsiz.length === 0, kayitsiz);
  const ailesiz = ['/matbaa', ...altlar].filter((h) => !tumEkranlar.includes(h));
  t('★ /matbaa altındaki her ekran bir ailede (menüden kaybolmaz)', ailesiz.length === 0, ailesiz);
}

// ── SÖZLÜK ──────────────────────────────────────────────────────────────
for (const [dil, sz] of [['tr', tr], ['en', en]]) {
  t(`[${dil}] matbaa alt çubuğu adları`, ['bugun', 'isler', 'kasa', 'yeniIs'].every((k) => Boolean(sz.mobil?.[k])));
  t(`[${dil}] tür kapısı metinleri`, Boolean(sz.ortak?.matbaadaYok) && Boolean(sz.ortak?.bayideYok));
}

// ── KAYNAK DENETİMİ ─────────────────────────────────────────────────────
{
  const sema = oku('prisma/schema.prisma');
  t('★ Tenant.hesapTuru varsayılanı BAYI', /hesapTuru\s+String\s+@default\("BAYI"\)/.test(sema));
  const goc = readdirSync(join(KOK, 'prisma/migrations')).map((d) => join(KOK, 'prisma/migrations', d, 'migration.sql'))
    .filter((f) => existsSync(f)).map((f) => readFileSync(f, 'utf8')).find((s) => /"hesapTuru"/.test(s)) ?? '';
  t('★ göç idempotent ve varsayılan BAYI', /ADD COLUMN IF NOT EXISTS "hesapTuru" TEXT NOT NULL DEFAULT 'BAYI'/.test(goc), goc);

  const auth = oku('src/lib/auth.ts');
  t('★ tür oturum jetonuna konmuyor (değişince yeniden giriş gerekmesin)', !/hesapTuru/.test(auth));

  const duzen = oku('src/app/(dashboard)/layout.tsx');
  t('panel düzeni türü kiracı kaydından okuyor', /hesapTuru: true/.test(duzen) && /hesapTuru\(tenant\?\.hesapTuru\)/.test(duzen));
  t('menü, sekmeler, kapı ve alt çubuk aynı türü alıyor',
    /<ModuleGuard modules=\{modules\} tur=\{tur\}>/.test(duzen) && /<BottomNav modules=\{modules\} tur=\{tur\} \/>/.test(duzen)
    && /tur=\{tur\} \/>/.test(duzen) && /\btur,\n/.test(duzen));

  const ana = oku('src/app/(dashboard)/dashboard/layout.tsx');
  t('★ matbaa ana panelden sunucuda Bugün\'e yönleniyor', /=== 'MATBAA'\)/.test(ana) && /'\/matbaa'\)/.test(ana));
  t('matbaa yönlendirmesi teknisyen yönlendirmesinden önce', ana.indexOf("'MATBAA'") < ana.indexOf("redirect('/tickets')"));

  const kapiDuzen = oku('src/app/(dashboard)/matbaa/layout.tsx');
  t('★ /matbaa sayfaları sunucuda türe kapılı', /kiraciTuru\(/.test(kapiDuzen) && /!== 'MATBAA'\) redirect\('\/dashboard'\)/.test(kapiDuzen));

  const kapi = oku('src/lib/matbaa-kapi.ts');
  t('★ matbaa uç kapısı türü veritabanından okuyor', /prisma\.tenant\.findUnique/.test(kapi) && /select: \{ hesapTuru: true \}/.test(kapi));
  t('uç kapısı BAYI\'yi 403 ile reddediyor', /!== 'MATBAA'\)[\s\S]{0,40}AuthError\(403/.test(kapi));

  // Matbaa uçları (gelince) kapıdan geçmeli: bayi kullanıcısı adresi yazsa da açamaz.
  const ucDizin = join(KOK, 'src/app/api/matbaa');
  const uclar = [];
  const gez = (d) => { for (const x of readdirSync(d, { withFileTypes: true })) { const y = join(d, x.name); if (x.isDirectory()) gez(y); else if (x.name === 'route.ts') uclar.push(y); } };
  if (existsSync(ucDizin)) gez(ucDizin);
  const kapisiz = uclar.filter((f) => !/requireMatbaaUser\(/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(KOK.length + 1));
  t(`★ /api/matbaa altındaki ${uclar.length} ucun hepsi matbaa kapısından geçiyor`, kapisiz.length === 0, kapisiz);

  const nav = oku('src/components/BottomNav.tsx');
  t('alt çubuğun matbaa öğeleri menü kuralından geçiyor', /tur === 'MATBAA'/.test(nav) && /hrefErisilir\(href/.test(nav));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
