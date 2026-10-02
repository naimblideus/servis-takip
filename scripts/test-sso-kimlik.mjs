// SSO KİMLİĞİ — joker karakter ve doğrulanmamış e-posta
// Çalıştır:  node scripts/test-sso-kimlik.mjs   (veritabanı kısmı yerel DB ister)
//
// NEDEN BU TEST
// SSO girişi e-postayı Prisma'nın `mode: 'insensitive'` eşitliğiyle arıyordu.
// PostgreSQL'de bu kaçışsız ILIKE olur: `_` tek karakter, `%` her şey jokeri.
// Ölçüldü: "admin@dem_.com" gerçek "admin@demo.com"u buluyordu. Ayrıca
// Microsoft Entra'nın `email` alanı doğrulanmamıştır (çok kiracılı girişte
// herhangi bir dizinin yöneticisi kullanıcısına istediği e-postayı yazar).
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-sso-'));
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const P = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/sso-kimlik.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(P)};\nexport const prisma = new PrismaClient();\n`);
const yol = join(g, 'sso-kimlik.js');
writeFileSync(yol, readFileSync(yol, 'utf8').split("'@/lib/prisma'").join("'./prisma-shim.js'"), 'utf8');
const s = await import(pathToFileURL(yol).href);

console.log('\nSSO — hangi e-postaya güvenilir\n');
{
  const { ssoEpostasi, epostaNormal, tekDizineKilitli } = s;
  const ORG = 'https://login.microsoftonline.com/organizations/v2.0';
  const KILIT = 'https://login.microsoftonline.com/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0/v2.0';
  const e = (sag, profil, iss = ORG) => ssoEpostasi(sag, profil, iss);

  t('★ Entra kilitsiz, doğrulama talebi yok → RET (nOAuth)', e('microsoft-entra-id', { email: 'yonetici@bayi.com' }).sebep === 'eposta-dogrulanmamis');
  t('★ Entra kilitsiz, xms_edov=false → RET', e('microsoft-entra-id', { email: 'yonetici@bayi.com', xms_edov: false }).eposta === null);
  t('Entra kilitsiz, xms_edov=true → kabul', e('microsoft-entra-id', { email: 'Yonetici@Bayi.com', xms_edov: true }).eposta === 'yonetici@bayi.com');
  t('Entra doğrulanmış birincil e-posta → o esas alınır', e('microsoft-entra-id', { email: 'baska@x.com', verified_primary_email: ['gercek@bayi.com'] }).eposta === 'gercek@bayi.com');
  t('Entra tek dizine kilitli → firmanın kendi dizini, kabul', e('microsoft-entra-id', { email: 'yonetici@bayi.com' }, KILIT).eposta === 'yonetici@bayi.com');
  t('kilit tanıma: dizin kimliği evet, organizations/common hayır', tekDizineKilitli(KILIT) && !tekDizineKilitli(ORG) && !tekDizineKilitli('https://login.microsoftonline.com/common/v2.0'));
  t('★ Google email_verified yok/false → RET', e('google', { email: 'a@b.com' }).eposta === null && e('google', { email: 'a@b.com', email_verified: false }).eposta === null);
  t('Google email_verified=true → kabul', e('google', { email: 'a@b.com', email_verified: true }).eposta === 'a@b.com');
  t('e-posta yoksa "eposta-yok"', e('google', { email_verified: true }).sebep === 'eposta-yok' && e('microsoft-entra-id', {}).sebep === 'eposta-yok');
  t('tanımadığımız sağlayıcıya güvenilmez', e('github', { email: 'a@b.com', email_verified: true }).eposta === null);
  t('biçimsiz e-posta reddedilir', epostaNormal('yok') === null && epostaNormal('a@b') === null && epostaNormal('a b@c.com') === null && epostaNormal(null) === null);
  t('alt çizgi meşru bir e-posta karakteridir (biçim reddetmez)', epostaNormal('ahmet_yilmaz@firma.com') === 'ahmet_yilmaz@firma.com');
}

function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const x = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l));
    return x ? x.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.log('\n  ⊘ veritabanı katmanı atlandı: DATABASE_URL yerel değil');
} else {
  console.log('\nSSO — kullanıcı eşleşmesi (gerçek veritabanı)\n');
  const p = new PrismaClient();
  const SLUG = ['test-sso-a', 'test-sso-b', 'test-sso-kapali'];
  const temizle = async () => {
    for (const slug of SLUG) {
      const x = await p.tenant.findFirst({ where: { slug }, select: { id: true } });
      if (x) await p.tenant.delete({ where: { id: x.id } });
    }
  };
  try {
    await temizle();
    const a = await p.tenant.create({ data: { name: 'SSO A', slug: SLUG[0] } });
    const b = await p.tenant.create({ data: { name: 'SSO B', slug: SLUG[1] } });
    const kapali = await p.tenant.create({ data: { name: 'SSO Kapalı', slug: SLUG[2], isActive: false } });
    const k = (tenantId, email, ek = {}) => p.user.create({ data: { tenantId, email, passwordHash: 'x', name: email, ...ek } });
    const hedef = await k(a.id, 'ahmet.yilmaz@sso-firma.test');
    await k(a.id, 'pasif@sso-firma.test', { isActive: false });
    await k(a.id, 'ortak@sso-firma.test');
    await k(b.id, 'ortak@sso-firma.test');
    await k(kapali.id, 'kapali@sso-firma.test');
    const { ssoKullaniciBul } = s;

    const r1 = await ssoKullaniciBul('ahmet_yilmaz@sso-firma.test');
    t('★ "ahmet_yilmaz@…" "ahmet.yilmaz@…" kullanıcısını BULMUYOR (alt çizgi joker değil)', r1.user === null && r1.sebep === 'tanimsiz', r1.sebep);
    const r2 = await ssoKullaniciBul('%@sso-firma.test');
    t('★ "%@sso-firma.test" hiçbir kullanıcıyı bulmuyor', r2.user === null && r2.sebep === 'tanimsiz', r2.sebep);
    const r3 = await ssoKullaniciBul('ahmet.yilm%@sso-firma.test');
    t('★ yüzde işareti ön ek jokeri değil', r3.user === null);
    const r4 = await ssoKullaniciBul('AHMET.Yilmaz@SSO-Firma.test');
    t('büyük-küçük harfi farklı GERÇEK e-posta bulunuyor', r4.user?.id === hedef.id && r4.user?.tenant?.name === 'SSO A', r4.sebep);
    t('pasif kullanıcı bulunmuyor', (await ssoKullaniciBul('pasif@sso-firma.test')).user === null);
    t('kapalı bayinin kullanıcısı bulunmuyor', (await ssoKullaniciBul('kapali@sso-firma.test')).user === null);
    const r5 = await ssoKullaniciBul('ortak@sso-firma.test');
    t('iki bayide aynı e-posta → "coklu", giriş yok (tahmin yok)', r5.user === null && r5.sebep === 'coklu', r5.sebep);
    t('biçimsiz giriş veritabanına sorulmadan reddediliyor', (await ssoKullaniciBul("x' OR 1=1 --")).user === null);
  } catch (e) {
    kaldi++;
    console.log('  ✗ veritabanı testi çöktü —', e?.message);
  } finally {
    await temizle().catch(() => {});
    await p.$disconnect();
    const shim = await import(pathToFileURL(join(g, 'prisma-shim.js')).href);
    await shim.prisma.$disconnect();
  }
}

console.log('\nSSO — bağlantılar\n');
{
  // Yorumlar ayıklanır: açıklama tuzağı anlatırken ifadeyi anabiliyor.
  const kod = (yolu) => readFileSync(join(KOK, yolu), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const auth = kod('src/lib/auth.ts');
  const modul = kod('src/lib/sso-kimlik.ts');
  t('★ auth.ts ve sso-kimlik.ts\'de ILIKE üreten insensitive arama yok', !/insensitive/.test(auth) && !/insensitive/.test(modul));
  t('signIn ve jwt e-postayı doğrulanmış taleplerden alıyor (user.email değil)', (auth.match(/ssoEpostasi\(account\.provider, profile/g) ?? []).length === 2);
  t('Entra issuer tek kaynaktan', /issuer: ENTRA_ISSUER/.test(auth));
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
