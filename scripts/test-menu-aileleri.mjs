// MENÜ AİLELERİ — kim neyi görür
// Çalıştır:  node scripts/test-menu-aileleri.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Menü 40 düz öğeden başlıklar altında ailelere indirildi. Böyle bir
// toplamanın iki sessiz arızası var ve ikisi de ekranda hata vermez:
//
//   · EKRAN KAYBOLUR. Bir sayfa hiçbir aileye yazılmazsa menüden düşer;
//     sayfa çalışır ama kimse bulamaz. Test, (dashboard) altındaki HER
//     sayfanın tam bir aileye ait olduğunu diskten okuyarak doğrular.
//   · YANLIŞ KİŞİ GÖRÜR. Teknisyen ya da ön büro cihaz başına kârı, borcu,
//     karneyi görmemeli. Menüde gizlemek yetmez; aynı ekranların uçları
//     sunucuda da yöneticiye kilitli mi, kaynak dosyadan kontrol edilir.
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-menu-'));
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
  AILELER, BOLUM_SIRASI, YALNIZ_YONETICI, TEKNISYEN_MENUSU,
  hrefErisilir, menuKur, aileBul, sekmeGosterilir, aileRozeti, hrefRozeti,
} = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const HEPSI = ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'REPORTS', 'MARKETPLACE', 'PORTAL', 'SHOP', 'SLA'];
const erisim = (ek = {}) => ({ rol: 'ADMIN', ulke: 'TR', moduller: HEPSI, whatsappKurulu: true, ...ek });
const gorunen = (e) => menuKur(e).flatMap((b) => b.aileler.flatMap((a) => a.sekmeler));
const aileler = (e) => menuKur(e).flatMap((b) => b.aileler.map((a) => a.aile.anahtar));

// Para gösteren ekranlar: kâr, marj, borç, ciro, karne.
const PARA_EKRANLARI = ['/kacan-gelir', '/cihaz-karlilik', '/filo', '/reports', '/teknisyen', '/kurumsal', '/accounting', '/invoices', '/collections'];

console.log('\nMenü aileleri\n');

// ── HİÇBİR EKRAN KAYBOLMAZ ───────────────────────────────────────────────
{
  const hepsi = AILELER.flatMap((a) => a.uyeler);
  const tekrar = hepsi.filter((h, i) => hepsi.indexOf(h) !== i);
  t('★ hiçbir ekran iki aileye yazılmamış', tekrar.length === 0, tekrar);

  const sayfalar = readdirSync(join(KOK, 'src/app/(dashboard)'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(KOK, 'src/app/(dashboard)', d.name, 'page.tsx')))
    .map((d) => `/${d.name}`);
  const sahipsiz = sayfalar.filter((s) => !hepsi.includes(s));
  t(`★ (dashboard) altındaki ${sayfalar.length} sayfanın HEPSİ bir ailede`, sahipsiz.length === 0, sahipsiz);

  const olmayan = hepsi.filter((h) => !sayfalar.includes(h));
  t('ailelerdeki her adres gerçekten bir sayfa', olmayan.length === 0, olmayan);

  const sidebar = readFileSync(join(KOK, 'src/components/Sidebar.tsx'), 'utf8');
  const ikonlu = [...sidebar.matchAll(/href: '([^']+)'/g)].map((m) => m[1]);
  const ikonsuz = AILELER.filter((a) => !ikonlu.includes(a.uyeler[0])).map((a) => a.anahtar);
  t('her ailenin ilk ekranının menüde ikonu var', ikonsuz.length === 0, ikonsuz);
}

// ── YÖNETİCİ ─────────────────────────────────────────────────────────────
{
  const e = erisim();
  const b = menuKur(e);
  t('bölümler sabit sırada', JSON.stringify(b.map((x) => x.bolum)) === JSON.stringify(BOLUM_SIRASI), b.map((x) => x.bolum));
  const n = aileler(e).length;
  t(`★ yönetici menüsü 40 öğeden ${n} aileye indi`, n <= 18, n);
  t('süper admin ekranı bayi yöneticisinde yok', !gorunen(e).includes('/admin'));
  t('yönetici bütün para ekranlarını görüyor', PARA_EKRANLARI.every((h) => gorunen(e).includes(h)));
  const fat = b.flatMap((x) => x.aileler).find((a) => a.aile.anahtar === 'faturalama');
  t('★ faturalar artık görünür bir ailede (eskiden kapalı "Gelişmiş" klasöründeydi)', fat && fat.giris === '/invoices', fat);
  const kar = b.flatMap((x) => x.aileler).find((a) => a.aile.anahtar === 'kar');
  t('★ kaçan gelir Kâr ailesinin girişi', kar && kar.giris === '/kacan-gelir', kar);
}

// ── TEKNİSYEN ────────────────────────────────────────────────────────────
{
  const e = erisim({ rol: 'TECHNICIAN' });
  const g2 = gorunen(e);
  t('★ teknisyen yalnız saha ekranlarını görüyor', g2.every((h) => TEKNISYEN_MENUSU.includes(h)), g2);
  t('★ teknisyen HİÇBİR para ekranını görmüyor', PARA_EKRANLARI.every((h) => !g2.includes(h)), g2.filter((h) => PARA_EKRANLARI.includes(h)));
  t('teknisyen ana paneli görmüyor (ciro, tahsilat)', !g2.includes('/dashboard'));
  t('teknisyenin menüsü kısa', aileler(e).length <= 8, aileler(e));
  t('teknisyen iş listesini, rotayı ve sayacı görüyor', ['/tickets', '/rota', '/sayac-turu'].every((h) => g2.includes(h)), g2);
  t('toplu yazma ekranları teknisyende yok', !g2.includes('/toplu-ayar') && !g2.includes('/toplu-zam'));
  t('teknisyen cihazlar sayfasında tek sekme görür → çubuk çizilmez', sekmeGosterilir('/devices', e) === null);
}

// ── ÖN BÜRO ──────────────────────────────────────────────────────────────
{
  const e = erisim({ rol: 'FRONT_DESK' });
  const g2 = gorunen(e);
  t('★ ön büro para ekranlarını görmüyor', PARA_EKRANLARI.every((h) => !g2.includes(h)), g2.filter((h) => PARA_EKRANLARI.includes(h)));
  t('ön büro Kâr ailesini hiç görmüyor (boş başlık yok)', !aileler(e).includes('kar'), aileler(e));
  const kur = menuKur(e).flatMap((x) => x.aileler).find((a) => a.aile.anahtar === 'kurumsal');
  t('ön büroda Kurumsal ailesi bakımdan açılıyor', kur && kur.giris === '/bakim' && !kur.sekmeler.includes('/teknisyen'), kur);
}

// ── ÜLKE, PAKET, KANAL ───────────────────────────────────────────────────
{
  const g2 = gorunen(erisim({ ulke: 'DE' }));
  t('Avrupalı bayide GİB e-Fatura ve KDV yok', !g2.includes('/e-fatura') && !g2.includes('/kdv'));
  const muh = menuKur(erisim({ ulke: 'DE' })).flatMap((x) => x.aileler).find((a) => a.aile.anahtar === 'muhasebe');
  t('Avrupalı bayide Muhasebe tek sekme', muh && muh.sekmeler.length === 1, muh);
}
{
  const e = erisim({ moduller: ['MARKETPLACE'] });
  const g2 = gorunen(e);
  t('paket kapısı: kapalı modülün ekranı görünmüyor', !g2.includes('/kacan-gelir') && !g2.includes('/sla') && !g2.includes('/musteri-bildirimleri'), g2);
  t('paketsiz bayide Kurumsal ailesi düşüyor', !aileler(e).includes('kurumsal'), aileler(e));
  t('çekirdek ekranlar pakete bağlı değil', ['/tickets', '/customers', '/devices', '/sayac-turu', '/inventory'].every((h) => g2.includes(h)));
}
{
  t('WhatsApp kurulmamışsa menüde yok', !gorunen(erisim({ whatsappKurulu: false })).includes('/whatsapp'));
  t('kuruluysa var', gorunen(erisim()).includes('/whatsapp'));
}

// ── AKTİF AİLE VE SEKMELER ───────────────────────────────────────────────
{
  t('alt sayfa ailesini buluyor (/tickets/new → fişler)', aileBul('/tickets/new')?.anahtar === 'fisler');
  t('★ önek karışmıyor (/sayac-eposta ≠ /sayac-turu ama aynı aile)', aileBul('/sayac-eposta')?.anahtar === 'sayaclar');
  t('bilinmeyen yol aile vermiyor', aileBul('/yok-boyle') === null);

  const s = sekmeGosterilir('/sayac-turu', erisim());
  t('★ sayaç ailesinde üç sekme: gir → eksik → cihazdan gelen',
    s && JSON.stringify(s.sekmeler) === JSON.stringify(['/sayac-turu', '/takip', '/sayac-eposta']), s);
  t('detay sayfasında sekme çizilmez', sekmeGosterilir('/devices/abc', erisim()) === null);
  t('tek ekranlı ailede sekme çizilmez', sekmeGosterilir('/tickets', erisim()) === null);
  t('görmemesi gereken sayfada sekme çizilmez',
    sekmeGosterilir('/kacan-gelir', erisim({ rol: 'FRONT_DESK' })) === null);
}

// ── ROZET ────────────────────────────────────────────────────────────────
{
  const sayilar = { market: 2, sayacEposta: 5, musteriBildirim: 3, magaza: 0 };
  t('aile rozeti görünen sekmelerin toplamı', aileRozeti(['/sayac-turu', '/takip', '/sayac-eposta'], sayilar) === 5);
  t('rozetsiz ekran 0', hrefRozeti('/tickets', sayilar) === 0);
  t('portal ailesi bildirim sayısını taşıyor', aileRozeti(['/musteri-portali', '/musteri-bildirimleri'], sayilar) === 3);
}

// ── SÖZLÜK ───────────────────────────────────────────────────────────────
for (const [dil, sz] of [['tr', tr], ['en', en]]) {
  const eksikAile = AILELER.filter((a) => a.uyeler.length > 1 && !sz.menuAile?.[a.anahtar]).map((a) => a.anahtar);
  t(`[${dil}] çok ekranlı her ailenin adı var`, eksikAile.length === 0, eksikAile);
  const eksikBolum = BOLUM_SIRASI.filter((b) => !sz.menuBolum?.[b]);
  t(`[${dil}] her bölüm başlığı var`, eksikBolum.length === 0, eksikBolum);
  const eksikEkran = AILELER.flatMap((a) => a.uyeler).filter((h) => !sz.menu?.[h]);
  t(`[${dil}] her ekranın sekme adı var`, eksikEkran.length === 0, eksikEkran);
  t(`[${dil}] teknisyenin "İşlerim" adı var`, Boolean(sz.menuAile?.islerim));
}
t('★ Türkçe panelde "Dashboard" yazmıyor', tr.menu['/dashboard'] !== 'Dashboard', tr.menu['/dashboard']);
t('"Takip" adı sayacı anlatıyor (GPS sanılmıyor)', /sayaç/i.test(tr.menu['/takip']), tr.menu['/takip']);
t('bölüm başlıkları Türkçe büyük harfle yazılmış (CSS büyütmesi yok)', tr.menuBolum.MUSTERI === 'MÜŞTERİ' && tr.menuBolum.SISTEM === 'SİSTEM');
{
  const hepsi = JSON.stringify(tr);
  t('★ yardım metinlerinde kalkan "Gelişmiş" klasörüne yol tarifi kalmadı', !/Gelişmiş →|\(Gelişmiş/.test(hepsi));
  t('★ İngilizce yardımda da "Advanced →" kalmadı', !/Advanced →|\(Advanced/.test(JSON.stringify(en)));
}

// ── PARA UÇLARI SUNUCUDA KİLİTLİ ─────────────────────────────────────────
{
  // Ekran → verisini aldığı uç. Menüde gizli olsa bile adresi bilen açardı.
  const UCLAR = {
    '/cihaz-karlilik': 'src/app/api/reports/device-profit/route.ts',
    '/filo': 'src/app/api/filo/route.ts',
    '/kurumsal': 'src/app/api/kurumsal/route.ts',
    '/teknisyen': 'src/app/api/teknisyen/route.ts',
    '/reports': 'src/app/api/reports/route.ts',
    '/kacan-gelir': 'src/app/api/revenue-risk/route.ts',
  };
  for (const [ekran, dosya] of Object.entries(UCLAR)) {
    const k = readFileSync(join(KOK, dosya), 'utf8');
    const kilitli = /requireAdminUser\(\)/.test(k) || /BU_EKRAN_ICIN_YONETICI_YETKISI/.test(k);
    t(`★ ${ekran} ucu sunucuda yöneticiye kilitli`, kilitli && YALNIZ_YONETICI.includes(ekran), dosya);
    t(`${ekran} ucunda yöneticisiz yol kalmamış`, !/requireTenantUser\(\)/.test(k), dosya);
  }
}

// ── TEKNİSYEN AÇILIŞI ────────────────────────────────────────────────────
{
  const fis = readFileSync(join(KOK, 'src/app/(dashboard)/tickets/page.tsx'), 'utf8');
  t('★ fiş listesi teknisyene açılışta kendi işlerini veriyor', /sp\.assignedUserId \?\? \(teknisyen \? user\.id : undefined\)/.test(fis));
  t('"Tümü" açıkça all ile ifade ediliyor (boş değer varsayılana döner)', /atanan !== 'all'/.test(fis));
  const pano = readFileSync(join(KOK, 'src/app/(dashboard)/dashboard/layout.tsx'), 'utf8');
  t('★ teknisyen ana panelden sunucuda işlerine yönleniyor', /TECHNICIAN'\) redirect\('\/tickets'\)/.test(pano));
  const rota = readFileSync(join(KOK, 'src/app/(dashboard)/rota/page.tsx'), 'utf8');
  t('rota teknisyen bazında süzülüyor', /f\.atananId !== kimin/.test(rota));
  t('rotada sabit Türkçe durum etiketi kalmadı', !/label: 'Serviste'/.test(rota) && !/>Temizle</.test(rota));
  const api = readFileSync(join(KOK, 'src/app/api/tickets/route.ts'), 'utf8');
  t('sade fiş listesi atananı taşıyor', /assignedUser: \{ select: \{ id: true, name: true \} \}/.test(api));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
