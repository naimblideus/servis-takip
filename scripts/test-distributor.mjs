// DİSTRİBÜTÖR PANELİ — kurallar (saf) + veri katmanı (yerel veritabanı)
// Çalıştır:  node scripts/test-distributor.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Distribütör (ör. Pantum Türkiye) bayilerin tedarikçisidir. Paneli bir kez
// bayi sızdırırsa bayiler veri paylaşımını kapatır ve bir daha açmaz. Burada
// kilitli olanlar: k<3 bayide sayı yok ("yeterli veri yok", 0 değil); rıza
// vermeyen ve demo bayinin verisi hiçbir sayıya girmez; ad izni olmayan bayi
// hiçbir yerde adıyla görünmez ve farkla da çözülemez; distribütörün
// istediği marka yok sayılır, oturumdaki marka geçer; ekip açamaz; duyuru
// yalnız o markanın cihazı olan bayiye gider, müşteri paneline hiç gitmez,
// süresi dolan görünmez, bağlantı yalnız https.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, execSync } from 'node:child_process';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (y) => readFileSync(join(KOK, y), 'utf8');

// ── Derle: @/ takma adı geçici tsconfig ile, içe aktarılan her dosya ─────
const g = mkdtempSync(join(tmpdir(), 'st-dist-'));
const CIKTI = join(g, 'out');
writeFileSync(join(g, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    outDir: CIKTI, rootDir: join(KOK, 'src'), module: 'esnext', target: 'es2022', moduleResolution: 'bundler',
    skipLibCheck: true, noEmitOnError: false, baseUrl: KOK, paths: { '@/*': ['src/*'] }, types: [], jsx: 'preserve',
  },
  files: ['lib/distributor.ts', 'lib/distributor-veri.ts', 'lib/distributor-metin.ts', 'lib/super-admin-rol.ts'].map((f) => join(KOK, 'src', f)),
}));
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), '-p', join(g, 'tsconfig.json')], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
// Prisma: düz istemci (Next'in global önbelleği yok).
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(CIKTI, 'lib/prisma.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
// @/ ve uzantısız göreli içe aktarımları Node ESM'in anlayacağı hâle getir.
(function duzelt(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { duzelt(p); continue; }
    if (!p.endsWith('.js')) continue;
    const s = readFileSync(p, 'utf8').replace(/(from\s*|import\(\s*)(['"])(@\/[^'"]+|\.{1,2}\/[^'"]+)\2/g, (m, on, q, yol) => {
      let hedef = yol.startsWith('@/') ? join(CIKTI, yol.slice(2)) : resolve(dirname(p), yol);
      if (existsSync(hedef + '.js')) hedef += '.js';
      else if (existsSync(hedef) && statSync(hedef).isDirectory() && existsSync(join(hedef, 'index.js'))) hedef = join(hedef, 'index.js');
      else if (!existsSync(hedef)) return m;
      let r = relative(dirname(p), hedef).split(sep).join('/');
      if (!r.startsWith('.')) r = './' + r;
      return `${on}${q}${r}${q}`;
    });
    writeFileSync(p, s);
  }
})(CIKTI);

const d = await import(pathToFileURL(join(CIKTI, 'lib/distributor.js')).href);
const mt = await import(pathToFileURL(join(CIKTI, 'lib/distributor-metin.js')).href);
const rol = await import(pathToFileURL(join(CIKTI, 'lib/super-admin-rol.js')).href);

const GUN = 86_400_000;
const simdi = new Date('2026-10-21T12:00:00+03:00');

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ k-ANONİMLİK\n');
{
  t('eşik 3 ve reliability ile aynı', d.K_ANONIM === 3 && /MIN_TENANTS_FOR_OEM = 3/.test(oku('src/lib/reliability.ts')));
  t('★ 2 bayide sayı yok (null — 0 değil)', d.kAnonim(2, 10) === null && d.kAnonim(2, 0) === null);
  t('3 bayide sayı var', d.kAnonim(3, 10) === 10 && d.kAnonim(3, 0) === 0);
  t('★ fark saldırısı: adsız 1–2 bayi kalırsa güvenli değil', !d.farkGuvenli(3, 2) && !d.farkGuvenli(5, 3) && d.farkGuvenli(3, 3) && d.farkGuvenli(6, 3) && d.farkGuvenli(3, 0));
  const s = d.kSuz([{ bayiler: new Set(['a', 'b', 'c']) }, { bayiler: new Set(['a', 'b']) }]);
  t('kSuz 3 bayilik satırı gösterir, 2 bayilik satırı yalnız SAYAR', s.gosterilen.length === 1 && s.gizli === 1);
}

console.log('\n★ MARKA EŞLEŞMESİ VE SEÇİMİ\n');
{
  t('Pantum: büyük/küçük harf', d.markaEslesir('PANTUM', 'M7100', 'Pantum') && d.markaEslesir('pantum', 'P3010', 'PANTUM'));
  t('ters kaydedilmiş (marka alanında model) eşleşir', d.markaEslesir('M6500', 'Pantum', 'Pantum'));
  t('başka marka eşleşmez', !d.markaEslesir('Canon', 'iR2520', 'Pantum') && !d.markaEslesir('', '', 'Pantum'));
  t('★ Türkçe İ: "DİSTTEST" = "disttest"', d.markaEslesir('DİSTTEST', 'X', 'disttest') && d.markaAnahtari('İZMİR') === d.markaAnahtari('izmir'));
  const dist = { rol: 'DISTRIBUTOR', marka: 'Pantum' };
  t('★ distribütörün ?marka=Canon isteği yok sayılır → Pantum', JSON.stringify(d.markaSec(dist, 'Canon')) === JSON.stringify({ ok: true, marka: 'Pantum' }));
  t('distribütör: oturumdaki marka küçük yazılmışsa kanonik', d.markaSec({ rol: 'DISTRIBUTOR', marka: 'pantum' }, null).marka === 'Pantum');
  t('markası olmayan distribütör → 403 MARKA_YOK', d.markaSec({ rol: 'DISTRIBUTOR', marka: null }, 'Pantum').hata === 'MARKA_YOK' && d.markaSec({ rol: 'DISTRIBUTOR', marka: '' }, 'Pantum').durum === 403);
  t('★ ekip → 403', d.markaSec({ rol: 'EKIP' }, 'Pantum').ok === false && d.markaSec({ rol: 'EKIP' }, 'Pantum').durum === 403);
  t('sahip markayı seçer; boşsa Pantum', d.markaSec({ rol: 'SAHIP' }, 'canon').marka === 'Canon' && d.markaSec({ rol: 'SAHIP' }, null).marka === 'Pantum');
  t('oturum yok → 401', d.markaSec(null, 'Pantum').durum === 401);
  t('★ ekip distribütör uçlarını middleware’de de açamaz', !rol.rolErisebilir('EKIP', '/api/super-admin/distributor') && !rol.rolErisebilir('EKIP', '/api/super-admin/distributor/duyuru') && rol.rolErisebilir('DISTRIBUTOR', '/api/super-admin/distributor/duyuru'));
  t('orijinal parça: kart markası', d.parcaOrijinalMi({ oemBrand: 'PANTUM', name: 'TL-410' }, 'Pantum'));
  t('orijinal parça: kart markası boşsa adı', d.parcaOrijinalMi({ oemBrand: null, name: 'Pantum TL-410 Toner' }, 'Pantum') && !d.parcaOrijinalMi({ oemBrand: null, name: 'Uyumlu TL-410' }, 'Pantum'));
  t('başka markanın kartı orijinal sayılmaz', !d.parcaOrijinalMi({ oemBrand: 'Ninestar', name: 'Pantum uyumlu' }, 'Pantum'));
}

console.log('\n★ DUYURU GİRDİSİ\n');
{
  const tamam = { baslik: 'Kampanya', metin: 'TL-410 tonerde ekim fırsatı.' };
  t('geçerli duyuru', !('hata' in d.duyuruGirdisi(tamam, simdi)));
  t('★ bağlantı http ise reddedilir', d.duyuruGirdisi({ ...tamam, baglanti: 'http://pantum.com.tr' }, simdi).hata === 'BAGLANTI_GECERSIZ');
  t('★ javascript:/data: bağlantı reddedilir', d.duyuruGirdisi({ ...tamam, baglanti: 'javascript:alert(1)' }, simdi).hata === 'BAGLANTI_GECERSIZ' && d.duyuruGirdisi({ ...tamam, baglanti: 'data:text/html,x' }, simdi).hata === 'BAGLANTI_GECERSIZ');
  t('kullanıcı adı/şifre gömülü bağlantı reddedilir', d.duyuruGirdisi({ ...tamam, baglanti: 'https://a:b@pantum.com.tr' }, simdi).hata === 'BAGLANTI_GECERSIZ');
  t('https bağlantı kabul', d.duyuruGirdisi({ ...tamam, baglanti: ' https://pantum.com.tr/kampanya ' }, simdi).baglanti === 'https://pantum.com.tr/kampanya');
  t('boş bağlantı = yok', d.duyuruGirdisi({ ...tamam, baglanti: '' }, simdi).baglanti === null);
  t('başlık 80, metin 600 sınırı', d.duyuruGirdisi({ ...tamam, baslik: 'x'.repeat(81) }, simdi).hata === 'BASLIK_UZUN'
    && d.duyuruGirdisi({ ...tamam, metin: 'x'.repeat(601) }, simdi).hata === 'METIN_UZUN'
    && !('hata' in d.duyuruGirdisi({ baslik: 'x'.repeat(80), metin: 'x'.repeat(600) }, simdi)));
  t('boş başlık/metin reddedilir', d.duyuruGirdisi({ baslik: ' ', metin: 'x' }, simdi).hata === 'BASLIK_BOS' && d.duyuruGirdisi({ baslik: 'x', metin: '' }, simdi).hata === 'METIN_BOS');
  t('geçmiş ya da bozuk bitiş tarihi reddedilir', d.duyuruGirdisi({ ...tamam, bitis: '2026-10-20' }, simdi).hata === 'BITIS_GECERSIZ' && d.duyuruGirdisi({ ...tamam, bitis: '2026-02-31' }, simdi).hata === 'BITIS_GECERSIZ');
  const b = d.duyuruGirdisi({ ...tamam, bitis: '2026-10-21' }, simdi);
  t('bugün biten duyuru günün sonuna kadar (İstanbul) geçerli', b.bitis instanceof Date && b.bitis.toISOString() === '2026-10-21T20:59:59.000Z', b.bitis);
}

console.log('\n★ BAYİYE GİDEN DUYURU\n');
{
  const dy = (id, marka, gunOnce, bitis = null) => ({ id, marka, bitis, createdAt: new Date(simdi.getTime() - gunOnce * GUN) });
  const liste = [dy('a', 'Pantum', 5), dy('b', 'Pantum', 1), dy('c', 'Canon', 0), dy('d', 'Pantum', 3, new Date(simdi.getTime() - GUN)), dy('e', 'PANTUM', 2), dy('f', 'Pantum', 4, new Date(simdi.getTime() + GUN))];
  const p = d.bayiDuyurulari(liste, new Set([d.markaAnahtari('Pantum')]), simdi);
  t('★ en çok 3, en yeni önce', p.map((x) => x.id).join() === 'b,e,f', p.map((x) => x.id));
  t('★ süresi dolan görünmez', !p.some((x) => x.id === 'd') && !d.duyuruAktif({ bitis: new Date(simdi.getTime() - 1) }, simdi));
  t('★ cihazı olmayan markanın duyurusu gitmez', !d.bayiDuyurulari(liste, new Set([d.markaAnahtari('Canon')]), simdi).some((x) => x.marka !== 'Canon') && d.bayiDuyurulari(liste, new Set(), simdi).length === 0);
}

console.log('\n★ PAY, AYAR, METİN\n');
{
  const p = d.payHesapla({ orijinal: 1, uyumlu: 1, bilinmeyen: 1 });
  t('yüzdeler toplamı 100', p.orijinal + p.uyumlu + p.bilinmeyen === 100 && p.toplam === 3, p);
  t('hiç kalem yoksa pay yok (null)', d.payHesapla({ orijinal: 0, uyumlu: 0, bilinmeyen: 0 }) === null);
  t('MTBF: yılda 2 arıza → 183 gün; arıza yoksa yok', d.mtbfGun(2) === 183 && d.mtbfGun(0) === null && d.mtbfGun(null) === null);
  t('★ paylaşım kapanınca ad izni de kapanır', JSON.stringify(d.paylasimSonrasi({ oemDataSharing: true, markaAdIzni: true }, { oemDataSharing: false })) === '{"oemDataSharing":false,"markaAdIzni":false}');
  t('★ paylaşım kapalıyken ad izni açılmaz', d.paylasimSonrasi({ oemDataSharing: false, markaAdIzni: false }, { markaAdIzni: true }).markaAdIzni === false);
  t('ayar isteği yalnız true/false', d.paylasimGirdisi({ oemDataSharing: 'evet' }).hata === 'GECERSIZ' && d.paylasimGirdisi({}).hata === 'GECERSIZ' && d.paylasimGirdisi({ markaAdIzni: true }).markaAdIzni === true);
  const anahtarlar = (o, on = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? anahtarlar(v, `${on}${k}.`) : [`${on}${k}`]));
  const trA = anahtarlar(mt.distributorMetni('tr')).sort().join();
  const enA = anahtarlar(mt.distributorMetni('en')).sort().join();
  t('metin: TR ve EN aynı anahtarlar', trA === enA);
  const enMetin = JSON.stringify(mt.distributorMetni('en'));
  t('metin: İngilizcede Türkçe harf yok', !/[ğĞıİşŞçÇöÖüÜ]/.test(enMetin));
  const trS = JSON.stringify(mt.distributorMetni('tr'));
  t('metin: "yeterli veri yok" iki dilde', mt.distributorMetni('tr').yetersiz === 'yeterli veri yok' && mt.distributorMetni('en').yetersiz === 'not enough data' && trS.length > 1000);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ KAYNAK\n');
{
  const distUclari = execSync('git ls-files --others --cached --exclude-standard -- src/app/api/super-admin/distributor', { cwd: KOK, encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('route.ts'));
  t(`distribütör uçları bulundu (${distUclari.length})`, distUclari.length >= 2, distUclari);
  const eksik = distUclari.filter((f) => { const s = oku(f); return !/session\.marka/.test(s) || !/markaSec\(/.test(s); });
  t('★ her distribütör ucu markayı oturumdan (session.marka, markaSec) alıyor', eksik.length === 0, eksik);
  t('★ panel sayfası da markayı oturumdan alıyor', /markaSec\(\{ rol: session\.rol, marka: session\.marka \}/.test(oku('src/app/(super-admin)/super-admin/distributor/page.tsx')));
  const bayiUc = oku('src/app/api/marka-duyurusu/route.ts');
  t('bayi duyuru ucu bayi oturumu istiyor', /requireTenantUser\(\)/.test(bayiUc));
  // Müşteri paneli: /m/[token] sayfası, /api/portal uçları, lib/portal.
  const portal = execSync('git ls-files --others --cached --exclude-standard -- src/app/m src/app/api/portal src/lib/portal.ts', { cwd: KOK, encoding: 'utf8' }).split('\n').filter(Boolean);
  const sizan = portal.filter((f) => /marka-duyurusu|MarkaDuyurusu|bayininDuyurulari|markaDuyurusu/.test(oku(f)));
  t(`★ müşteri paneli duyuruya hiç dokunmuyor (${portal.length} dosya)`, portal.length >= 2 && sizan.length === 0, sizan);
  let kartKullanan = [];
  try { kartKullanan = execSync('git grep -l "MarkaDuyurusuKarti" -- src', { cwd: KOK, encoding: 'utf8' }).split('\n').filter(Boolean); } catch { /* yok */ }
  const yeni = execSync('git ls-files --others --exclude-standard -- src', { cwd: KOK, encoding: 'utf8' }).split('\n').filter((f) => f && /MarkaDuyurusuKarti/.test(oku(f)));
  // Yalnız ekran dosyaları (sözlükteki açıklama yorumu sayılmaz).
  const hepsi = [...new Set([...kartKullanan, ...yeni])].filter((f) => f.endsWith('.tsx') && !f.endsWith('MarkaDuyurusuKarti.tsx'));
  t('★ duyuru kartı yalnız bayi panelinde', hepsi.length === 1 && hepsi[0] === 'src/app/(dashboard)/dashboard/page.tsx', hepsi);
  t('kart demoda istek atmıyor ve bağlantıyı yalnız https ile açıyor', /if \(!session\?\.user \|\| demo\) return/.test(oku('src/components/MarkaDuyurusuKarti.tsx')) && /startsWith\('https:\/\/'\)/.test(oku('src/components/MarkaDuyurusuKarti.tsx')));
  const veri = oku('src/lib/distributor-veri.ts');
  t('★ veri katmanı toplu: döngüde sorgu yok', !/for \([^)]*\) \{[^}]*await prisma/.test(veri) && /groupBy/.test(veri) && /ANY\(\$\{ids\}::text\[\]\)/.test(veri));
  t('★ kapsam: rıza + aktif + silinmemiş + demo değil', /oemDataSharing: true, isActive: true, deletedAt: null, demo: false/.test(veri) && /t\."demo" = false/.test(veri));
  t('müşteri adı, seri no, adres seçilmiyor', !/serialNo|customer|"address"|"Customer"/.test(veri.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
  const ayar = oku('src/app/api/settings/marka-paylasimi/route.ts');
  t('ayar ucu yalnız yönetici, denetim kaydı yazıyor', /yoneticiMi\(user\)/.test(ayar) && /writeAudit\(/.test(ayar) && /MARKA_PAYLASIMI_DEGISTI/.test(ayar));
  // 2026-10-30: anonim paylaşım varsayılan AÇIK; ad izni (firma adı, telefon) KAPALI kalır.
  const sema = oku('prisma/schema.prisma');
  t('★ yeni bayide anonim paylaşım açık, adıyla görünme kapalı', /oemDataSharing\s+Boolean\s+@default\(true\)/.test(sema) && /markaAdIzni\s+Boolean\s+@default\(false\)/.test(sema));
  t('★ gizlilik metni paylaşımı ve kapatma yolunu anlatıyor (kayıtta onaylanan metin)', /Üreticiyle anonim istatistik/.test(oku('public/gizlilik.html')) && /Ayarlar'dan istediği an kapatır/.test(oku('public/gizlilik.html')));
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n★ VERİTABANI (yerel)\n');
let p = null;
const SLUG = 'test-dist-';
try {
  const env = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x)) || '';
  const url = process.env.DATABASE_URL || env.replace(/^\s*DATABASE_URL\s*=\s*/, '').replace(/^"|"$/g, '');
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('ATLA');
  process.env.DATABASE_URL = url;
  const veri = await import(pathToFileURL(join(CIKTI, 'lib/distributor-veri.js')).href);
  ({ prisma: p } = await import(pathToFileURL(join(CIKTI, 'lib/prisma.js')).href));

  const temizle = async () => {
    const eski = await p.tenant.findMany({ where: { slug: { startsWith: SLUG } }, select: { id: true } });
    const ids = eski.map((x) => x.id);
    if (ids.length) {
      await p.ticketPart.deleteMany({ where: { tenantId: { in: ids } } });
      await p.serviceTicket.deleteMany({ where: { tenantId: { in: ids } } });
      await p.tenant.deleteMany({ where: { id: { in: ids } } });
    }
    await p.markaDuyurusu.deleteMany({ where: { marka: { in: ['Disttest', 'Canon'] }, kurumAd: { startsWith: 'Test ' } } });
  };
  await temizle();

  // Benzersiz, tanınmayan bir marka: yerel veritabanındaki başka veri sayılara karışmasın.
  const MARKA = 'Disttest';
  const bayi = async (n, ek) => {
    const b = await p.tenant.create({ data: { name: `DT Bayi ${n}`, slug: `${SLUG}${n}`, city: 'İstanbul', phone: `0212000000${n}`, email: `b${n}@dist.test`, oemDataSharing: true, ...ek } });
    const u = await p.user.create({ data: { tenantId: b.id, email: `a${n}@dist.test`, passwordHash: 'x', name: 'Yönetici', role: 'ADMIN' } });
    const m = await p.customer.create({ data: { tenantId: b.id, name: `Gizli Müşteri ${n}`, phone: '05000000000', address: 'Gizli Sokak 1' } });
    return { id: b.id, userId: u.id, musteri: m.id };
  };
  let seri = 0;
  const cihaz = (b, brand, model, ek = {}) => {
    seri++;
    return p.device.create({ data: { tenantId: b.id, customerId: b.musteri, brand, model, serialNo: `DTSERI-${seri}`, publicCode: `DT-${seri}-${b.id.slice(-6)}`, qrTokenHash: 'x', ...ek } });
  };
  const b1 = await bayi(1, { markaAdIzni: true, name: 'DT Adli Bir' });
  const b2 = await bayi(2, { markaAdIzni: true, name: 'DT Adli Iki' });
  const b3 = await bayi(3, { markaAdIzni: false, name: 'DT Adsiz Uc' });
  const b4 = await bayi(4, { oemDataSharing: false, markaAdIzni: false, name: 'DT Paylasmayan' });
  const b5 = await bayi(5, { demo: true, markaAdIzni: true, name: 'DT Demo' });
  const b6 = await bayi(6, { markaAdIzni: true, name: 'DT Canon Bayisi' });

  // Yazım farkları bilerek: DİSTTEST / disttest / Disttest aynı marka.
  const c1 = []; for (let i = 0; i < 4; i++) c1.push(await cihaz(b1, i % 2 ? 'DİSTTEST' : 'Disttest', 'DT-100'));
  const c2 = []; for (let i = 0; i < 3; i++) c2.push(await cihaz(b2, 'disttest', 'dt 100'));
  const c3 = [await cihaz(b3, 'Disttest', 'DT-100'), await cihaz(b3, 'Disttest', 'DT-100'), await cihaz(b3, 'Disttest', 'DT-200')];
  const c4 = []; for (let i = 0; i < 5; i++) c4.push(await cihaz(b4, 'Disttest', 'DT-100', { olcumSiyah: 3, olcumAt: new Date() }));
  for (let i = 0; i < 3; i++) await cihaz(b5, 'Disttest', 'DT-100', { olcumSiyah: 3, olcumAt: new Date() });
  await cihaz(b6, 'Canon', 'iR2520');

  let o = await veri.distributorOzeti(MARKA);
  t('★ bayi ağı: 3 bayi (paylaşmayan ve demo sayılmaz)', o.ag.bayi === 3, o.ag);
  t('adıyla görünmeye izin veren 2', o.ag.adIzinli === 2);
  const adlar = JSON.stringify(o);
  t('★ ad izni olmayan bayi hiçbir yerde adıyla yok', o.ag.adli.map((x) => x.ad).sort().join() === 'DT Adli Bir,DT Adli Iki' && !adlar.includes('DT Adsiz Uc') && !adlar.includes('0212000000' + '3'));
  t('★ paylaşmayan ve demo bayi adı yok', !adlar.includes('DT Paylasmayan') && !adlar.includes('DT Demo') && !adlar.includes('DT Canon'));
  t('★ müşteri adı/adresi/seri no hiç dönmüyor', !/Gizli Müşteri|Gizli Sokak|DTSERI/.test(adlar));
  t('★ adsız 1 bayi kaldığı için adlıların cihaz sayısı yazılmıyor (fark saldırısı)', o.ag.adliSayiGizli === true && o.ag.adli.every((x) => x.cihaz === null), o.ag.adli);
  t('★ park: 10 cihaz (paylaşmayanın 5 ve demonun 3 cihazı yok)', o.park.cihaz === 10, o.park.cihaz);
  t('★ model satırı yazım farkına rağmen tek: DT-100 = 9, DT-200 (1 bayi) gizli', o.park.modeller.length === 1 && o.park.modeller[0].cihaz === 9 && o.park.gizliModel === 1, o.park);
  t('il kırılımı en az 3 bayiyle', o.park.iller.length === 1 && o.park.iller[0].cihaz === 10 && o.park.iller[0].il === 'İstanbul', o.park.iller);
  t('★ sayaç okuması olmayınca aylık sayfa "yeterli veri yok" (null, 0 değil)', o.park.aylikSayfa === null);

  // Sayaç: önce yalnız 2 bayide okuma → hâlâ yok; üçüncüsü eklenince sayı çıkar.
  const okuma = async (c, gunOnce, n) => p.counterReading.create({ data: { tenantId: c.tenantId, deviceId: c.id, counterBlack: n, counterColor: 0, source: 'ELLE', readingDate: new Date(Date.now() - gunOnce * GUN) } });
  await okuma(c1[0], 30, 1000); await okuma(c1[0], 0, 4000);
  await okuma(c2[0], 30, 1000); await okuma(c2[0], 0, 2500);
  for (const c of c4.slice(0, 2)) { await okuma(c, 30, 0); await okuma(c, 0, 90000); }
  o = await veri.distributorOzeti(MARKA);
  t('★ 2 bayide okuma: aylık sayfa yok (paylaşmayanın okuması da sayılmaz)', o.park.aylikSayfa === null && o.park.sayfaOlculenCihaz === null, o.park);
  await okuma(c3[0], 30, 500); await okuma(c3[0], 0, 2000);
  o = await veri.distributorOzeti(MARKA);
  t('★ 3. bayi okununca aylık sayfa: (3000+1500+1500)/30 gün × 30 = 6.000', o.park.aylikSayfa === 6000 && o.park.sayfaOlculenCihaz === 3, o.park);

  // Toner payı: 2 bayide kalem → yok; 3. bayi (kaynağı bilinmeyen) → var.
  const parca = (b, ad, ek) => p.part.create({ data: { tenantId: b.id, sku: `DTP-${++seri}`, name: ad, group: 'TONER', ...ek } });
  const fis = async (b, c, partId, qty) => {
    const tk = await p.serviceTicket.create({ data: { tenantId: b.id, deviceId: c.id, customerId: b.musteri, ticketNumber: `DT-${++seri}`, createdByUserId: b.userId, issueText: 'toner' } });
    await p.ticketPart.create({ data: { tenantId: b.id, ticketId: tk.id, partId, quantity: qty, unitPrice: 100 } });
  };
  const p1 = await parca(b1, 'DT-100 orijinal toner', { oemBrand: 'DİSTTEST', oemCode: 'DTT-410' });
  const p2 = await parca(b2, 'Uyumlu DT toner', {});
  const p4 = await parca(b4, 'Disttest toner', { oemBrand: 'Disttest' });
  await fis(b1, c1[0], p1.id, 2);
  await fis(b2, c2[0], p2.id, 1);
  await fis(b4, c4[0], p4.id, 10);
  o = await veri.distributorOzeti(MARKA);
  t('★ 2 bayide toner kalemi: pay yok', o.toner.pay === null);
  await p.tonerChange.create({ data: { tenantId: b3.id, deviceId: c3[1].id, channel: 'BLACK', counterValue: 5000, changedAt: new Date(Date.now() - 20 * GUN), source: 'TARAYICI' } });
  o = await veri.distributorOzeti(MARKA);
  t('★ toner payı: orijinal %50, uyumlu %25, bilinmeyen %25 — paylaşmayanın 10 kalemi yok', JSON.stringify(o.toner.pay) === JSON.stringify({ orijinal: 50, uyumlu: 25, bilinmeyen: 25, toplam: 4 }), o.toner.pay);

  // 30 günlük talep: cihaz tonerini %5 ölçüyor. 3 bayide → satır; parça 2 bayide → gizli.
  for (const c of [c1[1], c2[1], c3[0]]) await p.device.update({ where: { id: c.id }, data: { olcumSiyah: 5, olcumAt: new Date() } });
  await p.tonerChange.create({ data: { tenantId: b1.id, deviceId: c1[1].id, channel: 'BLACK', counterValue: 100, changedAt: new Date(Date.now() - 200 * GUN), source: 'FIS', partId: p1.id } });
  const sarf = [{ ad: 'Drum Unit', yuzde: 4, tur: 'PARCA' }];
  for (const c of [c1[2], c2[2]]) await p.device.update({ where: { id: c.id }, data: { olcumSarf: sarf, olcumAt: new Date() } });
  o = await veri.distributorOzeti(MARKA);
  const satir = o.talep.toner.find((x) => x.kanal === 'BLACK');
  t('★ toner talebi: 3 bayi, 3 adet, kod üretici kodundan (paylaşmayanın 5 cihazı yok)', o.talep.tonerToplam === 3 && o.talep.toner.length === 1 && satir?.adet === 3 && satir?.kod === 'DTT-410', o.talep);
  t('★ parça talebi 2 bayide: satır yok, toplam yok', o.talep.parca.length === 0 && o.talep.parcaToplam === null && o.talep.gizli >= 1, o.talep);

  t('★ güvenilirlik: yalnız 3+ bayideki model (DT-100, 9 cihaz)', o.guvenilirlik.satirlar.length === 1 && o.guvenilirlik.satirlar[0].cihaz === 9 && o.guvenilirlik.gizli === 1, o.guvenilirlik);
  t('arıza yoksa MTBF uydurulmaz', o.guvenilirlik.satirlar[0].mtbfGun === null);
  t('★ kutu verimi 3 bayiden az girilince yok', o.guvenilirlik.satirlar[0].kutuVerimi === null);
  for (const c of [c1[3], c2[1], c3[0]]) await p.device.update({ where: { id: c.id }, data: { tonerYieldBlack: 3000 } });
  o = await veri.distributorOzeti(MARKA);
  t('kutu verimi 3 bayide: 3.000', o.guvenilirlik.satirlar[0].kutuVerimi === 3000);

  // Distribütörün ?marka=Canon isteği yok sayılır: veri yine kendi markasının.
  const sec = d.markaSec({ rol: 'DISTRIBUTOR', marka: MARKA }, 'Canon');
  const o2 = await veri.distributorOzeti(sec.marka);
  t('★ distribütör ?marka=Canon yolladı: dönen veri Disttest, Canon bayisi yok', o2.marka === 'Disttest' && o2.park.cihaz === 10 && !JSON.stringify(o2).includes('DT Canon'));

  // Ad izni ayarı: paylaşım açık bayide açılır, kapalıda açılmaz; adsız kalmayınca sayılar görünür.
  const a3 = await veri.paylasimYaz(b3.id, { markaAdIzni: true });
  const t3 = await p.tenant.findUnique({ where: { id: b3.id }, select: { markaAdIzni: true, markaAdIzniAt: true } });
  t('ad izni açılınca anı yazılır', a3.sonra.markaAdIzni && t3.markaAdIzni && t3.markaAdIzniAt instanceof Date);
  const a4 = await veri.paylasimYaz(b4.id, { markaAdIzni: true });
  t('★ paylaşım kapalı bayide ad izni açılmaz', a4.sonra.markaAdIzni === false && (await p.tenant.findUnique({ where: { id: b4.id } })).markaAdIzni === false);
  o = await veri.distributorOzeti(MARKA);
  t('herkes adlı → cihaz sayıları görünür (4/3/3)', !o.ag.adliSayiGizli && o.ag.adli.map((x) => x.cihaz).join() === '4,3,3', o.ag.adli);
  t('★ paylaşmayan bayi adı yine yok', !JSON.stringify(o).includes('DT Paylasmayan'));
  const k1 = await veri.paylasimYaz(b1.id, { oemDataSharing: false });
  const o3 = await veri.distributorOzeti(MARKA);
  t('★ paylaşımı kapatan bayi: ad izni kapanır, verisi çıkar; 2 bayi kalınca sayı yok', k1.sonra.markaAdIzni === false && o3.ag.bayi === null && o3.park.cihaz === null && o3.park.modeller.length === 0 && !JSON.stringify(o3).includes('DT Adli Bir'), o3.ag);
  await veri.paylasimYaz(b1.id, { oemDataSharing: true, markaAdIzni: true });

  // Duyurular
  const g1 = d.duyuruGirdisi({ baslik: 'Yeni toner', metin: 'DTT-410 stokta.', baglanti: 'https://disttest.example/k' }, new Date());
  const e1 = await veri.duyuruEkle(MARKA, 'Test Disttest Türkiye', null, g1);
  t('duyuru yazıldı', e1.ok);
  const goren = await veri.bayininDuyurulari(b3.id);
  t('markanın cihazı olan bayi görür, kurum adıyla', goren.length === 1 && goren[0].kurumAd === 'Test Disttest Türkiye' && goren[0].baglanti === 'https://disttest.example/k');
  t('★ markanın cihazı olmayan bayiye gitmez', (await veri.bayininDuyurulari(b6.id)).length === 0);
  t('★ demo bayiye gitmez', (await veri.bayininDuyurulari(b5.id)).length === 0);
  t('paylaşmayan bayi de (cihazı varsa) görür — duyuru veri değil', (await veri.bayininDuyurulari(b4.id)).length === 1);
  await p.markaDuyurusu.create({ data: { marka: MARKA, kurumAd: 'Test Disttest Türkiye', baslik: 'Eski', metin: 'Bitti.', bitis: new Date(Date.now() - GUN) } });
  t('★ süresi dolan bayide görünmez', !(await veri.bayininDuyurulari(b1.id)).some((x) => x.baslik === 'Eski'));
  t('süresi dolan distribütör listesinde "süresi doldu"', (await veri.duyuruListesi(MARKA)).some((x) => x.baslik === 'Eski' && !x.aktif));
  for (let i = 0; i < 3; i++) await veri.duyuruEkle(MARKA, 'Test Disttest Türkiye', null, d.duyuruGirdisi({ baslik: `Sıra ${i}`, metin: 'x' }));
  t('★ bayide en çok 3 duyuru', (await veri.bayininDuyurulari(b1.id)).length === 3);
  const c6 = await veri.duyuruEkle('Canon', 'Test Canon', null, d.duyuruGirdisi({ baslik: 'Canon', metin: 'x' }));
  t('★ başka markanın duyurusu silinemez', (await veri.duyuruSil(MARKA, c6.id)) === false && (await veri.duyuruSil('Canon', c6.id)) === true);
  t('kendi duyurusu silinir', (await veri.duyuruSil(MARKA, e1.id)) === true);
} catch (e) {
  if (e.message === 'ATLA') console.log('  ⊘ veritabanı kısmı atlandı: yerel veritabanı yok');
  else { kaldi++; console.log('  ✗ veritabanı testi çöktü —', e); }
} finally {
  if (p) {
    try {
      const eski = await p.tenant.findMany({ where: { slug: { startsWith: SLUG } }, select: { id: true } });
      const ids = eski.map((x) => x.id);
      if (ids.length) {
        await p.ticketPart.deleteMany({ where: { tenantId: { in: ids } } });
        await p.serviceTicket.deleteMany({ where: { tenantId: { in: ids } } });
        await p.tenant.deleteMany({ where: { id: { in: ids } } });
      }
      await p.markaDuyurusu.deleteMany({ where: { kurumAd: { startsWith: 'Test ' }, marka: { in: ['Disttest', 'Canon'] } } });
      const kalan = await p.tenant.count({ where: { slug: { startsWith: SLUG } } });
      t('geçici veri silindi', kalan === 0);
    } catch (e) { kaldi++; console.log('  ✗ temizlik başarısız —', e.message); }
    await p.$disconnect();
  }
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
