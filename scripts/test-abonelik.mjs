// ABONELİK — denemeden ödemeye geçiş
// Çalıştır:  node scripts/test-abonelik.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Satın almaya hazır bayinin yolu: kaç günü kaldığını görmek, ne ödeyeceğini
// görmek, nasıl ödeyeceğini görmek. Üçü de yanlış olabilir ve üçü de parayı
// etkiler: yanlış tutar ilk faturada tartışma, geçersiz IBAN başka hesaba
// havale, kırık WhatsApp bağlantısı kaybedilen satış demek.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-abonelik-'));
let mod;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      join(KOK, 'src/lib/abonelik.ts'), join(KOK, 'src/lib/odeme-bilgisi.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz */ }
  const yol = join(g, 'abonelik.js');
  writeFileSync(yol, readFileSync(yol, 'utf8').replace("from './odeme-bilgisi'", "from './odeme-bilgisi.js'"), 'utf8');
  mod = await import(pathToFileURL(yol).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { denemeKalanGun, whatsappNumarasi, whatsappLinki, platformOdeme, gosterilecekPaket } = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const SIMDI = new Date(Date.UTC(2026, 8, 29, 10));
const gunSonra = (n) => new Date(SIMDI.getTime() + n * 86400000);

console.log('\nAbonelik\n');

// ── DENEME ───────────────────────────────────────────────────────────────
t('14 gün kala', denemeKalanGun('trial', gunSonra(14), SIMDI) === 14);
t('★ son gün "1 gün" (yuvarlama aşağı değil)', denemeKalanGun('trial', gunSonra(0.2), SIMDI) === 1);
t('süresi geçmiş: 0', denemeKalanGun('trial', gunSonra(-3), SIMDI) === 0);
t('ödeyen bayide şerit yok', denemeKalanGun('professional', gunSonra(5), SIMDI) === null);
t('bitiş tarihi yoksa şerit yok', denemeKalanGun('trial', null, SIMDI) === null);

// ── WHATSAPP ─────────────────────────────────────────────────────────────
t('★ 0532 yazımı 90532 olur', whatsappNumarasi('0532 123 45 67') === '905321234567');
t('532 yazımı 90532 olur', whatsappNumarasi('532 123 45 67') === '905321234567');
t('+90 yazımı korunur', whatsappNumarasi('+90 (532) 123-45-67') === '905321234567');
t('00 ile başlayan uluslararası', whatsappNumarasi('0049 151 23456789') === '4915123456789');
t('kısa/saçma numara reddedilir', whatsappNumarasi('12345') === null && whatsappNumarasi('') === null);
t('bağlantı mesajı kodlanıyor', whatsappLinki('905321234567', 'Merhaba, Demo & Ortak') === 'https://wa.me/905321234567?text=Merhaba%2C%20Demo%20%26%20Ortak');
t('numara yoksa bağlantı yok', whatsappLinki(null, 'x') === null);

// ── PLATFORM ÖDEME ───────────────────────────────────────────────────────
{
  const p = platformOdeme({ odemeIban: 'TR330006100519786457841326', odemeHesapAdi: 'Nextus Teknoloji', satisWhatsapp: '0532 123 45 67' });
  t('platform ödeme bilgisi biçimli', p.iban === 'TR33 0006 1005 1978 6457 8413 26' && p.hesapAdi === 'Nextus Teknoloji' && p.whatsapp === '905321234567', p);
  const bozuk = platformOdeme({ odemeIban: 'TR330006100519786457841327', odemeHesapAdi: 'X', satisWhatsapp: null });
  t('★ kayıtta bozulmuş IBAN bayiye GÖSTERİLMİYOR', bozuk.iban === null && bozuk.hesapAdi === null, bozuk);
  t('ayar kaydı hiç yoksa boş', JSON.stringify(platformOdeme(null)) === JSON.stringify({ iban: null, hesapAdi: null, whatsapp: null }));
}

// ── TUTAR ────────────────────────────────────────────────────────────────
t('★ denemedeki bayiye hedef paketin (Profesyonel) tutarı', gosterilecekPaket('trial') === 'professional');
t('ödeyen bayiye kendi paketi', gosterilecekPaket('enterprise') === 'enterprise' && gosterilecekPaket('starter') === 'starter');

// ── BAĞLANTILAR ──────────────────────────────────────────────────────────
{
  const uc = readFileSync(join(KOK, 'src/app/api/abonelik/route.ts'), 'utf8');
  t('★ ekrandaki tutar faturayı kesen fonksiyondan (monthlyAmount)', /monthlyAmount\(paket, faturali\)/.test(uc));
  t('★ sayılan cihaz faturalamayla aynı kural (kiralık + kopya başı)', /SAYFA_UCRETLI_CIHAZ/.test(uc)
    && /SAYFA_UCRETLI_CIHAZ/.test(readFileSync(join(KOK, 'src/app/api/super-admin/billing/generate-monthly/route.ts'), 'utf8')));
  t('abonelik ucu yalnız yönetici', /requireAdminUser\(\)/.test(uc));
  const lay = readFileSync(join(KOK, 'src/app/(dashboard)/layout.tsx'), 'utf8');
  t('★ kilit ekranında devam yolu (IBAN + WhatsApp) var', /odeme=\{odeme\}/.test(lay) && /platformOdeme\(settings\)/.test(lay));
  t('deneme şeridi yalnız yöneticiye', /rol === 'ADMIN' \|\| rol === 'SUPER_ADMIN' \? denemeKalanGun/.test(lay));
  const sa = readFileSync(join(KOK, 'src/app/api/super-admin/settings/route.ts'), 'utf8');
  t('★ platform IBAN\'ı kaydedilmeden doğrulanıyor', /ibanGecerli\(v\)/.test(sa) && /IBAN_GECERSIZ/.test(sa));
  const saSayfa = readFileSync(join(KOK, 'src/app/(super-admin)/super-admin/settings/page.tsx'), 'utf8');
  t('süper admin ayarı reddedilen kaydı "kaydedildi" diye göstermiyor', /if \(!res\.ok\)/.test(saSayfa));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
