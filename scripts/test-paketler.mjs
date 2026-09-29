// PAKETLER — hangi pakette ne açık
// Çalıştır:  node scripts/test-paketler.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Paket içeriği üç yerde yaşıyor: kodda (PLAN_MODULES), tanıtım sayfasındaki
// kartlarda ve satışçının ağzında. Kod ile kart ayrışırsa bayi aldığı pakette
// olmayan bir özelliğe para öder ya da olan bir özelliği bilmez.
//
// Ölçülmüş iki kaza var, ikisi de burada kilitli:
//   · Başlangıç paketinin fiyatı kiralık cihaz sayısıyla belirleniyordu ama
//     pakette FATURA YOKTU: bayi kiralık cihazları için ödeyip onların
//     faturasını kesemiyordu.
//   · Kurumsal paket her ölçekte Profesyonel'den ₺1.275 pahalıydı ve büyük
//     müşteri ekranlarının hiçbirini eklemiyordu; hepsi Profesyonel'deydi.
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-paket-'));
let mod, fiyat, tr, en;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      join(KOK, 'src/lib/modules.ts'), join(KOK, 'src/lib/plan-pricing.ts'),
      join(KOK, 'src/lib/i18n/tr.ts'), join(KOK, 'src/lib/i18n/en.ts'),
      join(KOK, 'src/lib/i18n/sozluk.ts'), join(KOK, 'src/lib/bicim.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022',
      '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  mod = await import(pathToFileURL(join(g, 'modules.js')).href);
  fiyat = await import(pathToFileURL(join(g, 'plan-pricing.js')).href);
  ({ tr } = await import(pathToFileURL(join(g, 'i18n/tr.js')).href));
  ({ en } = await import(pathToFileURL(join(g, 'i18n/en.js')).href));
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { MODULES, PLAN_MODULES, ALL_MODULE_KEYS, moduleForHref } = mod;
const { PLAN_PRICING, monthlyAmount } = fiyat;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const kume = (p) => new Set(PLAN_MODULES[p]);
const altKume = (a, b) => [...a].every((x) => b.has(x));

console.log('\nPaketler\n');

// ── MERDİVEN ─────────────────────────────────────────────────────────────
{
  const [s, p, e] = ['starter', 'professional', 'enterprise'].map(kume);
  t('Profesyonel Başlangıç\'ın her şeyini içeriyor', altKume(s, p), [...s].filter((x) => !p.has(x)));
  t('Kurumsal Profesyonel\'in her şeyini içeriyor', altKume(p, e), [...p].filter((x) => !e.has(x)));
  t('★ her basamak en az bir modül ekliyor', p.size > s.size && e.size > p.size, [s.size, p.size, e.size]);
  t('deneme her şeyi gösteriyor', ALL_MODULE_KEYS.every((k) => kume('trial').has(k)));
  t('Kurumsal her modülü içeriyor', ALL_MODULE_KEYS.every((k) => e.has(k)));
}

// ── PARA DÖNGÜSÜ HER PAKETTE ─────────────────────────────────────────────
{
  for (const p of ['starter', 'professional', 'enterprise']) {
    const k = kume(p);
    t(`★ ${p}: fatura + tahsilat açık`, k.has('INVOICING'));
    t(`${p}: eksik sayaç takibi açık`, k.has('TRACKING'));
    t(`${p}: bayi pazarı açık (ağ etkisi)`, k.has('MARKETPLACE'));
  }
  t('fatura ve tahsilat aynı modülde', moduleForHref('/invoices') === 'INVOICING' && moduleForHref('/collections') === 'INVOICING');
  t('sayaç girişi hiçbir pakete bağlı değil (çekirdek)', moduleForHref('/sayac-turu') === null);
}

// ── HANGİ BASAMAKTA NE ───────────────────────────────────────────────────
{
  const s = kume('starter'), p = kume('professional'), e = kume('enterprise');
  t('★ Kâr analizi Profesyonel ile başlıyor', !s.has('REVENUE_RISK') && p.has('REVENUE_RISK'));
  t('Kâr analizi üç ekranı birlikte açıyor', ['/kacan-gelir', '/cihaz-karlilik', '/filo'].every((h) => moduleForHref(h) === 'REVENUE_RISK'));
  t('müşteri paneli Profesyonel ile başlıyor', !s.has('PORTAL') && p.has('PORTAL'));
  t('★ portalı AÇAN ekran da kapılı (eskiden yalnız gelenler kapılıydı)', moduleForHref('/musteri-portali') === 'PORTAL');
  t('★ Kurumsal paket yalnız Kurumsal\'da', !s.has('SLA') && !p.has('SLA') && e.has('SLA'));
  t('Kurumsal paket dört büyük müşteri ekranını açıyor',
    ['/sla', '/bakim', '/teknisyen', '/kurumsal'].every((h) => moduleForHref(h) === 'SLA'));
  t('model raporları Kurumsal\'da', !p.has('REPORTS') && e.has('REPORTS'));
}

// ── EŞLEME TUTARLI ───────────────────────────────────────────────────────
{
  const hepsi = ALL_MODULE_KEYS.flatMap((k) => MODULES[k].hrefs);
  const tekrar = hepsi.filter((h, i) => hepsi.indexOf(h) !== i);
  t('hiçbir ekran iki modüle bağlı değil', tekrar.length === 0, tekrar);
  const yok = hepsi.filter((h) => !existsSync(join(KOK, 'src/app/(dashboard)', h.slice(1), 'page.tsx')));
  t('modüllerdeki her adres gerçek bir sayfa', yok.length === 0, yok);
}

// ── FİYAT ────────────────────────────────────────────────────────────────
{
  // Kurumsal'ın Profesyonel'e farkı cihaz sayısı arttıkça kapanmıyor (aşım
  // bedeli aynı). Fark bu yüzden ÖZELLİKLE gerekçelendirilmeli.
  const fark = monthlyAmount('enterprise', 150).amount - monthlyAmount('professional', 150).amount;
  t('Kurumsal−Profesyonel farkı 100+ cihazda sabit', fark === monthlyAmount('enterprise', 400).amount - monthlyAmount('professional', 400).amount, fark);
  t('★ o farkın karşılığında büyük müşteri ekranları var', kume('enterprise').has('SLA') && !kume('professional').has('SLA'));
  t('üç paket fiyat tablosunda', ['starter', 'professional', 'enterprise'].every((p) => PLAN_PRICING[p]));
}

// ── SÖZLÜK ───────────────────────────────────────────────────────────────
for (const [dil, sz] of [['tr', tr], ['en', en]]) {
  const eksik = ALL_MODULE_KEYS.filter((k) => !sz.modul?.ad?.[k] || !sz.modul?.aciklama?.[k]);
  t(`[${dil}] her modülün adı ve açıklaması var`, eksik.length === 0, eksik);
}
t('modül adı içeriği anlatıyor (Kâr Analizi, Kurumsal Paket)', tr.modul.ad.REVENUE_RISK === 'Kâr Analizi' && tr.modul.ad.SLA === 'Kurumsal Paket');

// ── TANITIM SAYFASI KODLA AYNI ŞEYİ SÖYLÜYOR ─────────────────────────────
{
  const html = readFileSync(join(KOK, 'marketing/landing/nextus-servis.html'), 'utf8').replace(/\r\n/g, '\n');
  const kart = (plan) => {
    // Yalnız fiyat KARTI: aynı data-plan işareti sayfanın kazanç hesabında da geçiyor.
    const bas = html.search(new RegExp(`class="price-card[^"]*" data-plan="${plan}"`));
    const son = html.indexOf('</ul>', bas);
    const govde = html.slice(bas, son);
    const satir = (sinif) => [...govde.matchAll(new RegExp(`<li class="${sinif}">([\\s\\S]*?)</li>`, 'g'))].map((m) => m[1].replace(/<[^>]+>/g, ''));
    return { var: satir('has'), yok: satir('no') };
  };
  const b = kart('baslangic'), p = kart('profesyonel'), k = kart('kurumsal');
  const icerir = (liste, kelime) => liste.some((s) => s.includes(kelime));
  t('★ Başlangıç kartı sayaç faturasını VAR diye gösteriyor', icerir(b.var, 'Sayaç okuma ve otomatik kira') && !icerir(b.yok, 'Sayaç okuma'), b);
  t('Başlangıç kartı Kâr analizini YOK diye gösteriyor', icerir(b.yok, 'Kaçan Gelir'));
  t('Profesyonel kartı Kaçan Gelir\'i VAR diye gösteriyor', icerir(p.var, 'Kaçan Gelir'));
  t('★ Profesyonel kartı SLA\'yı YOK diye gösteriyor', icerir(p.yok, 'SLA') && !icerir(p.var, 'SLA'), p);
  t('★ Kurumsal kartı SLA ve bakımı VAR diye gösteriyor', icerir(k.var, 'SLA') && icerir(k.var, 'Periyodik bakım'), k);
  t('Kurumsal kartında YOK satırı yok (her şey açık)', k.yok.length === 0, k.yok);
  t('eski "Profesyonel ile başlar: sayaç/kira faturalaması" cümlesi kalmadı', !/sayaç\/kira faturalaması, tahsilat, rota ve Kaçan Gelir paneli Profesyonel ile başlar/.test(html));

  const uretilmis = readFileSync(join(KOK, 'src/app/_landing/Landing.tsx'), 'utf8');
  t('★ üretilmiş sayfa kaynakla güncel (build-landing koşturulmuş)', uretilmis.includes('Tahsilat takibi · eksik sayaç takibi'));
  const ing = readFileSync(join(KOK, 'src/app/_landing/LandingEn.tsx'), 'utf8');
  t('İngilizce sayfa da güncel', ing.includes('missing-reading tracking') && ing.includes('Preventive maintenance'));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
