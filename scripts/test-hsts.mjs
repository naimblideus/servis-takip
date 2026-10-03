// HSTS — "bu adrese hep https ile gel" başlığı YALNIZ gerçek alan adında
// Çalıştır:  node scripts/test-hsts.mjs   (sunucu kısmı açık sunucu ister: npm run dev)
//
// NEDEN BU TEST
// Tarayıcı bu başlığı bir yıl hatırlar. Yanlış adrese giderse (sslip, yerel,
// benzer adlı başka alan adı) o adres bir yıl https'siz açılamaz; alt alan
// adlarına yayılırsa e-posta gibi başka hizmetleri de bağlar.
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUNUCU = new URL(process.env.SAYAC_TEST_KOK || 'http://localhost:3002');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

console.log('\nKaynak');
const kod = readFileSync(join(KOK, 'next.config.ts'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
t('başlık next.config\'te ve adrese bağlı', /Strict-Transport-Security/.test(kod) && /type: 'host'/.test(kod));
t('★ alt alan adlarına yayılmıyor, ön yükleme listesine girmiyor', !/includeSubDomains|preload/i.test(kod));

// Host başlığı fetch'te değiştirilemiyor; düz http isteği.
const hsts = (host) => new Promise((coz) => {
  const r = request({ hostname: SUNUCU.hostname, port: SUNUCU.port, path: '/login', headers: { host }, timeout: 20000 }, (res) => {
    res.resume();
    coz({ durum: res.statusCode, hsts: res.headers['strict-transport-security'] ?? null });
  });
  r.on('error', () => coz(null));
  r.on('timeout', () => { r.destroy(); coz(null); });
  r.end();
});

const yerel = await hsts(SUNUCU.host);
if (!yerel) {
  console.log('\n  ⊘ sunucu kısmı atlandı: sunucu kapalı');
} else {
  console.log('\nSunucu');
  for (const h of ['nextusservis.com', 'www.nextusservis.com']) {
    const r = await hsts(h);
    t(`${h} → bir yıl`, r?.hsts === 'max-age=31536000', r);
  }
  t('yerel adres → başlık yok', yerel.hsts === null, yerel);
  for (const h of ['ornek.10.0.0.1.sslip.io', 'nextusservis.com.saldirgan.com', 'saldirgannextusservis.com', 'posta.nextusservis.com']) {
    const r = await hsts(h);
    t(`${h} → başlık yok`, r !== null && r.hsts === null, r);
  }
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
