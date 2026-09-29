// MÜŞTERİDEN ÖDEME — IBAN ve kartla ödeme bağlantısı
// Çalıştır:  node scripts/test-odeme-bilgisi.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Müşteri panelinde gösterilen IBAN'ın tek hanesi yanlışsa havale ya geri
// döner ya da BAŞKA BİRİNE gider. Kartla ödeme bağlantısı bozuksa ya da
// `javascript:` gibi bir değerse müşteri panelinde tıklanabilir bir tuzak
// olur. İkisi de kaydedilmeden önce ve gösterilmeden önce doğrulanıyor.
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-odeme-'));
let mod;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/odeme-bilgisi.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck',
  ], { stdio: 'pipe' });
  mod = await import(pathToFileURL(join(g, 'odeme-bilgisi.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}
const { ibanGecerli, ibanTemizle, ibanBicimle, odemeLinkiGecerli, hesapAdiTemizle, havaleAciklamasi, odemeKarti } = mod;

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

// Bağımsız mod-97: fonksiyonun kendi hesabını kendisiyle doğrulamamak için.
const mod97 = (iban) => {
  const r = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return BigInt(r) % 97n === 1n;
};

console.log('\nMüşteriden ödeme\n');

// ── IBAN ─────────────────────────────────────────────────────────────────
const TR = 'TR330006100519786457841326';
const DE = 'DE89370400440532013000';
t('örnek IBAN\'lar bağımsız hesapla da geçerli (test kendini kandırmıyor)', mod97(TR) && mod97(DE));
t('geçerli Türk IBAN', ibanGecerli(TR));
t('boşluklu ve küçük harfli yazım da kabul', ibanGecerli('tr33 0006 1005 1978 6457 8413 26'));
t('Alman IBAN (Avrupalı bayi)', ibanGecerli(DE));
{
  const bozuk = TR.slice(0, 10) + (TR[10] === '9' ? '8' : '9') + TR.slice(11);
  t('★ TEK HANE yanlışsa reddediliyor', !ibanGecerli(bozuk), bozuk);
  const yer = TR.slice(0, 10) + TR[11] + TR[10] + TR.slice(12);
  t('★ iki hanenin yeri değişmişse reddediliyor', TR[10] === TR[11] || !ibanGecerli(yer), yer);
}
t('★ Türk IBAN\'ı 26 haneden kısa/uzunsa reddediliyor', !ibanGecerli(TR.slice(0, -1)) && !ibanGecerli(TR + '0'));
t('Türk IBAN\'ında harf olamaz', !ibanGecerli('TR33000610051978645784132A'));
t('boş / saçma değer', !ibanGecerli('') && !ibanGecerli(null) && !ibanGecerli('merhaba'));
t('temizleme', ibanTemizle(' tr33-0006.1005 ') === 'TR3300061005');
t('dörtlü gruplar', ibanBicimle(TR) === 'TR33 0006 1005 1978 6457 8413 26');

// ── BAĞLANTI ─────────────────────────────────────────────────────────────
t('https bağlantı kabul', odemeLinkiGecerli('https://iyzi.link/AB12cd'));
t('★ javascript: reddediliyor', !odemeLinkiGecerli('javascript:alert(1)'));
t('http (şifresiz) reddediliyor', !odemeLinkiGecerli('http://odeme.example.com/x'));
t('kullanıcı adı/parola içeren adres reddediliyor', !odemeLinkiGecerli('https://kullanici:parola@odeme.example.com'));
t('noktasız alan adı reddediliyor', !odemeLinkiGecerli('https://localhost/odeme'));
t('çok uzun adres reddediliyor', !odemeLinkiGecerli('https://a.com/' + 'x'.repeat(600)));
t('bozuk adres reddediliyor', !odemeLinkiGecerli('https://') && !odemeLinkiGecerli(''));

// ── METİN ────────────────────────────────────────────────────────────────
t('hesap adı tek satır', hesapAdiTemizle('Ofis\nTeknik  Ltd.') === 'Ofis Teknik Ltd.');
t('boş hesap adı null', hesapAdiTemizle('   ') === null);
t('havale açıklaması müşterinin adı, 60 karakterde', havaleAciklamasi('X'.repeat(80)).length === 60 && havaleAciklamasi('  ABC  Ltd ') === 'ABC Ltd');

// ── KART ─────────────────────────────────────────────────────────────────
{
  const tam = { odemeIban: TR, odemeHesapAdi: 'Örnek Bayi Ltd', odemeLinki: 'https://pay.example.com/x' };
  const k = odemeKarti(tam, 'Müşteri A.Ş.', true);
  t('kart: IBAN biçimli, hesap adı, bağlantı ve açıklama', k?.iban === 'TR33 0006 1005 1978 6457 8413 26' && k?.hesapAdi === 'Örnek Bayi Ltd' && k?.link === tam.odemeLinki && k?.aciklama === 'Müşteri A.Ş.', k);
  t('★ bayi mali bilgileri kapattıysa kart YOK', odemeKarti(tam, 'M', false) === null);
  t('hiç ödeme yolu yoksa kart yok', odemeKarti({ odemeIban: null, odemeHesapAdi: 'X', odemeLinki: null }, 'M', true) === null);
  const bozuk = odemeKarti({ odemeIban: 'TR330006100519786457841327', odemeHesapAdi: 'X', odemeLinki: null }, 'M', true);
  t('★ kayıtta bozulmuş IBAN GÖSTERİLMİYOR', bozuk === null, bozuk);
  const yalnizLink = odemeKarti({ odemeIban: null, odemeHesapAdi: 'X', odemeLinki: 'https://pay.example.com/x' }, 'M', true);
  t('yalnız bağlantı varsa kart var, hesap adı yok', yalnizLink?.link && yalnizLink.iban === null && yalnizLink.hesapAdi === null, yalnizLink);
  t('tehlikeli kayıtlı bağlantı gösterilmiyor', odemeKarti({ odemeIban: null, odemeHesapAdi: null, odemeLinki: 'javascript:x' }, 'M', true) === null);
}

// ── BAĞLANTILAR KODDA YERİNDE ────────────────────────────────────────────
{
  const uc = readFileSync(join(KOK, 'src/app/api/settings/route.ts'), 'utf8');
  t('★ ayarlar ucu IBAN\'ı kaydetmeden doğruluyor', /ibanGecerli\(String\(odemeIban\)\)/.test(uc) && /IBAN_GECERSIZ/.test(uc));
  t('ayarlar ucu bağlantıyı kaydetmeden doğruluyor', /odemeLinkiGecerli\(String\(odemeLinki\)\)/.test(uc));
  const portal = readFileSync(join(KOK, 'src/lib/portal.ts'), 'utf8');
  t('★ portal ödeme kartını mali bayrağına bağlıyor', /odemeKarti\(firma, m\.name, mali\)/.test(portal));
  const sayfa = readFileSync(join(KOK, 'src/app/m/[token]/page.tsx'), 'utf8');
  t('kart yalnız ödenmemiş bakiye varken çiziliyor', /v\.odeme && v\.bakiye != null && v\.bakiye > 0\.005/.test(sayfa));
  const kart = readFileSync(join(KOK, 'src/app/m/[token]/OdemeKarti.tsx'), 'utf8');
  t('kart bağlantısı yeni sekmede, opener sızdırmadan', /rel="noopener noreferrer nofollow"/.test(kart));
  t('IBAN boşluksuz kopyalanıyor (bankalar boşluklu yapıştırmayı reddediyor)', /deger\.replace\(\/\\s\/g, ''\)/.test(kart));
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
