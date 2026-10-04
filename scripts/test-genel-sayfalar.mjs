// GENEL SAYFALAR — ücretsiz ağ taraması ve gizlilik
// Çalıştır:  node scripts/test-genel-sayfalar.mjs   (HTTP kısmı açık sunucu ister: npm run dev)
//
// NEDEN BU TEST
// Satış ekibi /ucretsiz-tarama bağlantısını teknik servislere dağıtıyor; Meta
// uygulaması /gizlilik adresini istiyor. İkisi oturumsuz açılmalı, iki dilde
// aynı şeyi söylemeli. Sayfa "sonuç hiçbir yere gönderilmez" diyor: betiğin
// ücretsiz kipi ağa gitmeden bitmek ZORUNDA.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUNUCU = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');

console.log('\nKaynak');
const tarama = oku('public/ucretsiz-tarama.html');
const gizlilik = oku('public/gizlilik.html');
const ayar = oku('next.config.ts');
const betik = oku('public/tarayici/nextus-sayac-tarayici.ps1');

t('ücretsiz tarama sayfası genel betiği indiriyor', /href="\/tarayici\/nextus-sayac-tarayici\.ps1" download="[^"]+\.ps1"/.test(tarama));
const govde = tarama.slice(tarama.indexOf('<body>'));  // stil bloğundaki seçiciler sayılmasın
const trSay = (govde.match(/data-dil="tr"/g) ?? []).length, enSay = (govde.match(/data-dil="en"/g) ?? []).length;
t('ücretsiz tarama: her Türkçe metnin İngilizcesi var', trSay > 10 && trSay === enSay, { tr: trSay, en: enSay });
t('ücretsiz tarama: dış betik yok (yalnız sayfanın kendi kodu)', !/<script[^>]+src=/i.test(tarama));
t('ücretsiz tarama: telefondan açana "bilgisayardan açın" notu', /id="telefon"/.test(tarama) && /Android\|iPhone/.test(tarama));
t('gizlilik: Türkçe ve İngilizce bölüm', /<article id="tr" lang="tr">/.test(gizlilik) && /<article id="en" lang="en">/.test(gizlilik));
t('gizlilik: WhatsApp medyasının saklanmadığı ve iletişim adresi yazıyor', /sunucuda saklanmaz/.test(gizlilik) && /not stored on our servers/.test(gizlilik) && /mailto:/.test(gizlilik));
t('kısa adresler yönlendirmede', /source: '\/ucretsiz-tarama', destination: '\/ucretsiz-tarama\.html'/.test(ayar) && /source: '\/gizlilik', destination: '\/gizlilik\.html'/.test(ayar));
t('sayfalar public/ altında', existsSync(join(KOK, 'public/ucretsiz-tarama.html')) && existsSync(join(KOK, 'public/gizlilik.html')));

// Ücretsiz kip: rapor yazılıp çıkılıyor, sunucuya gönderme satırına hiç gelinmiyor.
const ucretsizBlok = betik.indexOf('if ($Ucretsiz) {');
const gonderim = betik.indexOf("Invoke-RestMethod -Uri ($Sunucu.TrimEnd('/') + '/api/sayac/tarayici')");
const blok = ucretsizBlok > 0 ? betik.slice(ucretsizBlok, betik.indexOf('\n}', ucretsizBlok)) : '';
t('★ betik: ücretsiz kip gönderim satırından ÖNCE çıkıyor', ucretsizBlok > 0 && gonderim > ucretsizBlok && /exit 0/.test(blok) && !/Invoke-RestMethod|Invoke-WebRequest/.test(blok), { ucretsizBlok, gonderim });
t('betik: ücretsiz kipte günlük görev ve kendini güncelleme yok', /if \(\$GunlukKur -and -not \$Ucretsiz\)/.test(betik) && betik.indexOf('Kendini-Guncelle ([int]$cevap.surum)') > gonderim);

const istek = async (yol) => {
  try { return await fetch(SUNUCU + yol, { redirect: 'manual', signal: AbortSignal.timeout(30000) }); } catch { return null; }
};
const deneme = await istek('/ucretsiz-tarama');
if (!deneme) {
  console.log('\n  ⊘ HTTP kısmı atlandı: sunucu kapalı');
} else {
  console.log('\nSunucu');
  t('/ucretsiz-tarama oturumsuz açılıyor', deneme.status === 200 && /text\/html/.test(deneme.headers.get('content-type') ?? '') && /2 dakikada görün/.test(await deneme.text()), deneme.status);
  const g = await istek('/gizlilik');
  t('/gizlilik oturumsuz açılıyor', g?.status === 200 && /Gizlilik — Nextus Servis/.test(await g.text()), g?.status);
  const d = await istek('/tarayici/nextus-sayac-tarayici.ps1');
  const b = d ? Buffer.from(await d.arrayBuffer()) : Buffer.alloc(0);
  t('★ indirilen betik BOM\'lu ve yer tutucular yerinde (ücretsiz kipe girer)', d?.status === 200 && b.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))
    && b.toString('utf8').includes("[string]$Anahtar = '__ANAHTAR__'"), d?.status);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
