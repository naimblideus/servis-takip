// BASKI RAPORU VE GÜN SONU
// Çalıştır:  node scripts/test-baski-rapor.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
//   · Pilotun ölçüsü "online gelen iş oranı". İptal edilen iş orana girerse
//     ya da oran yanlış yuvarlanırsa sipariş sayfasının işe yarayıp
//     yaramadığına yanlış karar verilir.
//   · Gün sonunda sistemdeki nakit istekten okunursa tezgah kendi açığını
//     kapatabilir; kapanmış günü yeniden sayabilirse de.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-baski-rapor-'));
let R;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      ...['baski-rapor', 'baski-is', 'baski-fiyat'].map((k) => join(KOK, `src/lib/${k}.ts`)),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  for (const k of ['baski-rapor', 'baski-is']) {
    const y = join(g, `${k}.js`);
    writeFileSync(y, readFileSync(y, 'utf8').replace(/from '\.\/([\w-]+)'/g, "from './$1.js'"), 'utf8');
  }
  R = await import(pathToFileURL(join(g, 'baski-rapor.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (y) => readFileSync(join(KOK, y), 'utf8');

console.log('\nRapor\n');
{
  const T = (s) => new Date(`2026-11-10T${s}:00Z`);
  const is = (kanal, toplam, o = {}) => ({ kanal, durum: 'TESLIM', toplam, odenen: toplam, createdAt: T('09:00'), hazirAt: T('10:30'), kalemler: [{ urunAd: 'Fotokopi A4', tutar: toplam }], ...o });
  const o = R.raporOzeti([
    is('ONLINE', 10000), is('ONLINE', 5000, { hazirAt: T('09:30') }), is('TEZGAH', 20000, { odenen: 5000, hazirAt: null, durum: 'SIRADA' }),
    is('WHATSAPP', 8000, { kalemler: [{ urunAd: 'Poster', tutar: 6000 }, { urunAd: 'Fotokopi A4', tutar: 2000 }] }),
    is('ONLINE', 99999, { durum: 'IPTAL' }),
  ]);
  t('★ iptal edilen iş ciroya, sayıya ve orana girmiyor', o.isSayisi === 4 && o.ciro === 43000 && o.iptal === 1, o);
  t('★ online oranı: 4 işin 2\'si = %50', o.onlineOrani === 50);
  t('kanal payı çoktan aza, işi olmayan kanal yok', o.kanallar.map((k) => `${k.kanal}:${k.adet}`).join() === 'ONLINE:2,TEZGAH:1,WHATSAPP:1' && o.kanallar[0].ciro === 15000);
  t('★ tahsil edilmemiş tutar', o.acik === 15000);
  t('★ hazırlama süresi yalnız hazır olmuş işlerden: (90+30+90)/3 = 70 dk', o.hazirlamaDk === 70, o.hazirlamaDk);
  t('en çok satan ciroya göre', o.enCokSatan[0].ad === 'Fotokopi A4' && o.enCokSatan[0].ciro === 37000 && o.enCokSatan[0].adet === 4 && o.enCokSatan[1].ad === 'Poster');
  const bos = R.raporOzeti([]);
  t('★ iş yokken sıfıra bölme yok', bos.onlineOrani === 0 && bos.hazirlamaDk === null && bos.isSayisi === 0 && bos.enCokSatan.length === 0);
  t('oran yuvarlanıyor (3 işin 1\'i = %33)', R.raporOzeti([is('ONLINE', 1), is('TEZGAH', 1), is('TEZGAH', 1)]).onlineOrani === 33);
  t('süre yazımı', R.sureYaz(40) === '40 dk' && R.sureYaz(95) === '1 sa 35 dk' && R.sureYaz(120) === '2 sa' && R.sureYaz(1500) === '1 gün 1 sa' && R.sureYaz(95, 'en') === '1 h 35 min');
  t('dönem yalnız 7 / 30 / 90; başkası 30', R.raporGunu('7') === 7 && R.raporGunu(90) === 90 && R.raporGunu('365') === 30 && R.raporGunu(undefined) === 30);
}

console.log('\nGün sonu\n');
{
  const t3 = R.kasaToplamlari([{ yol: 'NAKIT', tutar: 5000 }, { yol: 'KART', tutar: 3000 }, { yol: 'NAKIT', tutar: 2500 }, { yol: 'HAVALE', tutar: 100 }]);
  t('yol toplamları', t3.nakit === 7500 && t3.kart === 3000 && t3.havale === 100);
  const k = (sayilan, gun = '2026-11-10') => R.kapanisGecerli({ gun, sayilan }, '2026-11-10', 7500);
  t('★ fark = sayılan − sistemdeki nakit', k(7500).fark === 0 && k(7000).fark === -500 && k(8000).fark === 500);
  t('boş kasa (0) geçerli', k(0).ok && k(0).fark === -7500);
  t('★ eksi, kesirli ve sayı olmayan tutar reddediliyor', [-1, 12.5, 'abc', null, undefined].every((x) => k(x).kod === 'TUTAR_GECERSIZ'));
  t('★ gelecek gün kapatılamıyor; geçmiş gün kapatılabiliyor', k(100, '2026-11-11').kod === 'GUN_GECERSIZ' && k(100, '2026-11-09').ok);
  t('bozuk tarih reddediliyor', ['', '10.11.2026', '2026-11-1', null].every((gun) => k(100, gun).kod === 'GUN_GECERSIZ'));

  const uc = oku('src/app/api/matbaa/kasa/kapanis/route.ts');
  t('★ uç matbaa kapısından geçiyor; operatör kapatamıyor', /requireMatbaaUser\(\['ADMIN', 'FRONT_DESK'\]\)/.test(uc));
  t('★ sistemdeki tutarlar sunucuda, o günün ödemelerinden (istekten değil)', /kasaToplamlari\(await prisma\.baskiOdeme\.findMany\(\{ where: \{ tenantId, tarih: \{ gte: bas, lte: bit \} \}/.test(uc) && !/g\.(nakit|kart|havale|fark)/.test(uc));
  t('★ kapanmış günü yalnız sahip yeniden sayıyor', /if \(mevcut && !yonetici\) return baskiHatasi\('KAPANIS_VAR'\)/.test(uc));
  t('gün bayinin saat diliminde', /gunAraligi\(tz, new Date\(\)\)\.gun/.test(uc));
  t('şemada gün başına tek kapanış', /@@unique\(\[tenantId, gun\]\)/.test(oku('prisma/schema.prisma')));
  const rapor = oku('src/app/(dashboard)/matbaa/rapor/page.tsx');
  t('★ rapor yalnız sahibe ve kiracıya kapsamlı', /if \(!yoneticiMi\(user\)\) redirect\('\/matbaa'\)/.test(rapor) && /where: \{ tenantId: user\.tenantId, createdAt: \{ gte: bas \} \}/.test(rapor));
  const menu = oku('src/lib/menu-aileleri.ts');
  t('★ rapor ve sipariş sayfası ayarı yalnız yöneticide', /'\/matbaa\/ayarlar',[\s\S]{0,160}'\/matbaa\/rapor',\n\];/.test(menu));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
