// ŞİFREMİ UNUTTUM — e-postaya tek kullanımlık bağlantı
// Çalıştır:  node scripts/test-sifre-sifirlama.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Etkinlikte telefondan açılan yüzlerce deneme hesabı var; şifresini unutan
// bayi kendi başına girememeli diye bir yol olmamalı. Ama bu yol aynı zamanda
// başkasının hesabına giriş kapısı da olabilir. Kilitlenen: bağlantı yalnız
// adresin sahibine gider, tek kullanımlık ve 30 dakikalık, jeton saklanmaz,
// cevap hangi adresin kayıtlı olduğunu ele vermez, demo hesabı sıfırlanmaz.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUNUCU = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';
const require = createRequire(join(KOK, 'package.json'));
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');

// ── DERLEME ──────────────────────────────────────────────────────────────
const g = mkdtempSync(join(tmpdir(), 'st-sifre-'));
const KAYNAKLAR = ['sifre-sifirlama', 'sahip-bildirim', 'audit'];
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), ...KAYNAKLAR.map((k) => join(KOK, `src/lib/${k}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
const bcryptYolu = pathToFileURL(require.resolve('bcryptjs')).href;
for (const k of KAYNAKLAR) {
  const yol = join(g, `${k}.js`);
  if (!existsSync(yol)) continue;
  writeFileSync(yol, readFileSync(yol, 'utf8').replace(/'@\/lib\/prisma'/g, "'./prisma-shim.js'").replace(/'@\/lib\/([\w-]+)'/g, "'./$1.js'").replace(/'bcryptjs'/g, `'${bcryptYolu}'`));
}

// ── SAHTE GOOGLE ─────────────────────────────────────────────────────────
const alinan = [];
const sahte = http.createServer((istek, cevap) => {
  let govde = '';
  istek.on('data', (d) => { govde += d; });
  istek.on('end', () => {
    if (istek.url === '/token') {
      cevap.writeHead(200, { 'content-type': 'application/json' });
      cevap.end(JSON.stringify({ access_token: 'erisim', expires_in: 3600 }));
      return;
    }
    if (istek.url === '/gmail/v1/users/me/messages/send') {
      alinan.push(JSON.parse(govde).raw);
      cevap.writeHead(200, { 'content-type': 'application/json' });
      cevap.end('{"id":"x"}');
      return;
    }
    cevap.writeHead(404); cevap.end();
  });
});
await new Promise((r) => sahte.listen(0, '127.0.0.1', r));
const port = sahte.address().port;
const coz = (ham) => {
  const metin = Buffer.from(ham, 'base64url').toString('utf8');
  const [bas, ...govde] = metin.split('\r\n\r\n');
  const to = (bas.match(/^To: (.*)$/m) ?? [])[1];
  return { to, govde: Buffer.from(govde.join('').replace(/\r\n/g, ''), 'base64').toString('utf8') };
};
const ENV = {
  BILDIRIM_TOKEN_URL: `http://127.0.0.1:${port}/token`, BILDIRIM_GMAIL_KOK: `http://127.0.0.1:${port}`,
  BILDIRIM_GMAIL_CLIENT_ID: 'istemci-test', BILDIRIM_GMAIL_CLIENT_SECRET: 'gizli-test', BILDIRIM_GMAIL_REFRESH_TOKEN: 'yenileme-test',
  NEXTAUTH_URL: 'https://nextusservis.com',
};
for (const k of Object.keys(ENV)) delete process.env[k];
delete process.env.BILDIRIM_EPOSTA;
const sf = await import(pathToFileURL(join(g, 'sifre-sifirlama.js')).href);

// ── KAYNAK ───────────────────────────────────────────────────────────────
console.log('\nKaynak\n');
t('★ giriş sayfasında "Şifremi unuttum" bağlantısı', /href="\/sifremi-unuttum"/.test(oku('src/app/login/page.tsx')));
t('giriş bağlantısı e-postayı adres çubuğuna koymuyor', !/sifremi-unuttum\?e=/.test(oku('src/app/login/page.tsx')));
t('★ yenileme sayfası jetonu dış sitelere göndermiyor (referrer kapalı)', /referrer: 'no-referrer'/.test(oku('src/app/sifre-yenile/layout.tsx')));
const goc = oku('prisma/migrations/20261013100000_sifre_sifirlama/migration.sql');
t('göç her açılışta yeniden koşabilir (IF NOT EXISTS)', /CREATE TABLE IF NOT EXISTS/.test(goc) && /CREATE UNIQUE INDEX IF NOT EXISTS/.test(goc) && /CREATE INDEX IF NOT EXISTS/.test(goc) && !/CREATE (TABLE|UNIQUE INDEX|INDEX) "/.test(goc));
t('"şifremi unuttum, WhatsApp\'tan yazın" metni kalktı', !/unuttuysanız WhatsApp/.test(oku('src/lib/i18n/tr.ts')));

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
const yerel = /@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl());
const ADRES = 'sifre.testi@ornek.local';
const DEMO_ADRES = 'sifre.testi.demo@ornek.local';
const temizle = async () => {
  await p.tenant.deleteMany({ where: { slug: { startsWith: 'sifre-testi-' } } });
  await p.sifreSifirlama.deleteMany({ where: { eposta: { in: [ADRES, DEMO_ADRES, 'yok.boyle@ornek.local'] } } });
};

if (!yerel) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  await temizle();
  const eskiHash = await bcrypt.hash('eski-sifre-1', 4);
  const b1 = await p.tenant.create({ data: { name: 'Şifre Testi 1', slug: `sifre-testi-1-${Date.now()}`, users: { create: { email: 'Sifre.Testi@Ornek.local', passwordHash: eskiHash, name: 'Ali', role: 'ADMIN' } } }, include: { users: true } });
  const b2 = await p.tenant.create({ data: { name: 'Şifre Testi 2', slug: `sifre-testi-2-${Date.now()}`, users: { create: { email: ADRES, passwordHash: eskiHash, name: 'Ali', role: 'TECHNICIAN' } } }, include: { users: true } });
  const bd = await p.tenant.create({ data: { name: 'Şifre Testi Demo', slug: `sifre-testi-demo-${Date.now()}`, demo: true, users: { create: { email: DEMO_ADRES, passwordHash: eskiHash, name: 'Demo', role: 'ADMIN' } } }, include: { users: true } });
  try {
    console.log('\nİstek\n');
    sf.sifirlamaSiniriniSifirla();
    t('★ e-posta gönderimi kurulu değilse bağlantı üretilmiyor, WhatsApp\'a yönlendiriyor', (await sf.sifirlamaIste(ADRES, '10.1.1.1', 'tr')).durum === 'EPOSTA_KAPALI'
      && (await p.sifreSifirlama.count({ where: { eposta: ADRES } })) === 0);
    Object.assign(process.env, ENV);
    sf.sifirlamaSiniriniSifirla();
    t('bozuk adres reddediliyor', (await sf.sifirlamaIste('ali@', '10.1.1.1', 'tr')).durum === 'GECERSIZ');
    const once = alinan.length;
    const yok = await sf.sifirlamaIste('yok.boyle@ornek.local', '10.1.1.2', 'tr');
    t('★ kayıtlı olmayan adres: aynı cevap ("TAMAM"), e-posta gitmiyor, satır yok', yok.durum === 'TAMAM' && alinan.length === once
      && (await p.sifreSifirlama.count({ where: { eposta: 'yok.boyle@ornek.local' } })) === 0);
    const r = await sf.sifirlamaIste(' SIFRE.TESTI@ornek.local ', '10.1.1.3', 'tr');
    const e = alinan.at(-1) ? coz(alinan.at(-1)) : null;
    const jeton = e?.govde.match(/sifre-yenile\?t=([A-Za-z0-9_-]+)/)?.[1];
    t('★ kayıtlı adres: bağlantı adresin SAHİBİNE gitti (büyük harf/boşluk fark etmez)', r.durum === 'TAMAM' && e?.to === ADRES && !!jeton, { durum: r.durum, to: e?.to });
    t('bağlantı canlı adreste, 30 dakika yazıyor', /https:\/\/nextusservis\.com\/sifre-yenile\?t=/.test(e?.govde ?? '') && /30 dakika/.test(e?.govde ?? ''));
    const satir = await p.sifreSifirlama.findFirst({ where: { eposta: ADRES } });
    t('★ jetonun kendisi saklanmıyor (yalnız özeti)', !!satir && satir.tokenOzeti !== jeton && satir.tokenOzeti.length === 64 && !JSON.stringify(satir).includes(jeton));
    const dk = (satir.bitis - satir.createdAt) / 60000;
    t('geçerlilik 30 dakika', dk > 29.9 && dk < 30.1, dk);
    t('bağlantı geçerli', await sf.baglantiGecerli(jeton) === true);
    t('rastgele jeton geçersiz', await sf.baglantiGecerli('x'.repeat(43)) === false && await sf.baglantiGecerli(null) === false);

    console.log('\nYeni şifre\n');
    t('kısa şifre reddediliyor, bağlantı yanmıyor', (await sf.sifreYenile(jeton, '1234567', null)).durum === 'SIFRE_KISA' && await sf.baglantiGecerli(jeton) === true);
    const y = await sf.sifreYenile(jeton, 'yeni-sifre-1', '10.1.1.3');
    const u1 = await p.user.findUnique({ where: { id: b1.users[0].id } });
    const u2 = await p.user.findUnique({ where: { id: b2.users[0].id } });
    t('★ şifre değişti — aynı adresin iki bayideki kullanıcısında da', y.durum === 'TAMAM' && await bcrypt.compare('yeni-sifre-1', u1.passwordHash) && await bcrypt.compare('yeni-sifre-1', u2.passwordHash), y);
    t('★ bağlantı tek kullanımlık', (await sf.sifreYenile(jeton, 'baska-sifre-1', null)).durum === 'GECERSIZ' && await bcrypt.compare('yeni-sifre-1', (await p.user.findUnique({ where: { id: u1.id } })).passwordHash));
    const denetim = await p.auditLog.count({ where: { action: 'SIFRE_SIFIRLANDI', userId: { in: [u1.id, u2.id] } } });
    t('denetim kaydı her kullanıcı için', denetim === 2, denetim);

    // Süresi geçmiş bağlantı
    sf.sifirlamaSiniriniSifirla();
    await sf.sifirlamaIste(ADRES, '10.1.1.4', 'en');
    const e2 = coz(alinan.at(-1));
    const j2 = e2.govde.match(/sifre-yenile\?t=([A-Za-z0-9_-]+)/)?.[1];
    t('İngilizce istek İngilizce e-posta', /reset the password/.test(e2.govde) && /30 minutes/.test(e2.govde));
    t('★ süresi geçen bağlantı geçersiz', (await sf.sifreYenile(j2, 'gec-kalan-1', null, Date.now() + 31 * 60_000)).durum === 'GECERSIZ');
    // Aynı anda iki sekme: yalnız biri geçer
    await sf.sifirlamaIste(ADRES, '10.1.1.5', 'tr');
    const j3 = coz(alinan.at(-1)).govde.match(/sifre-yenile\?t=([A-Za-z0-9_-]+)/)?.[1];
    const [a, b] = await Promise.all([sf.sifreYenile(j3, 'sekme-bir-1', null), sf.sifreYenile(j3, 'sekme-iki-1', null)]);
    t('★ aynı bağlantı aynı anda iki kez: yalnız biri geçer', [a.durum, b.durum].sort().join() === 'GECERSIZ,TAMAM', [a.durum, b.durum]);
    t('yeni şifre girilince adresin öteki bağlantıları da ölüyor', (await p.sifreSifirlama.count({ where: { eposta: ADRES, kullanildi: null } })) === 0);

    console.log('\nKorumalar\n');
    sf.sifirlamaSiniriniSifirla();
    const oncesiDemo = alinan.length;
    t('★ demo hesabına bağlantı gitmiyor', (await sf.sifirlamaIste(DEMO_ADRES, '10.1.1.6', 'tr')).durum === 'TAMAM' && alinan.length === oncesiDemo
      && await bcrypt.compare('eski-sifre-1', (await p.user.findUnique({ where: { id: bd.users[0].id } })).passwordHash));
    sf.sifirlamaSiniriniSifirla();
    const ipler = [];
    for (let i = 0; i < 6; i++) ipler.push((await sf.sifirlamaIste(`kimse${i}@ornek.local`, '10.9.9.9', 'tr')).durum);
    t('★ IP başına 15 dakikada 5 istek, 6.\'sı sınırda', ipler.slice(0, 5).every((x) => x === 'TAMAM') && ipler[5] === 'SINIR', ipler);
    sf.sifirlamaSiniriniSifirla();
    const sayi = alinan.length;
    for (let i = 0; i < 4; i++) await sf.sifirlamaIste(ADRES, `10.2.2.${i}`, 'tr');
    t('★ adres başına saatte 3 e-posta (4.\'sü sessizce gitmez, cevap yine "TAMAM")', alinan.length - sayi === 3, alinan.length - sayi);
  } finally {
    await temizle();
  }
}

// ── HTTP ─────────────────────────────────────────────────────────────────
const istek = async (yol, ek = {}) => {
  try { return await fetch(SUNUCU + yol, { redirect: 'manual', signal: AbortSignal.timeout(60000), ...ek }); } catch { return null; }
};
const s1 = await istek('/sifremi-unuttum');
if (!s1) {
  console.log('\n  ⊘ HTTP kısmı atlandı: sunucu kapalı');
} else {
  console.log('\nSunucu\n');
  t('/sifremi-unuttum oturumsuz açılıyor', s1.status === 200 && /Şifrenizi yenileyin/.test(await s1.text()), s1.status);
  const s2 = await istek('/sifre-yenile?t=yok');
  t('/sifre-yenile oturumsuz açılıyor', s2?.status === 200, s2?.status);
  const g1 = await (await istek('/api/sifre/yenile?t=' + 'x'.repeat(43)))?.json().catch(() => ({}));
  t('uydurma jeton: "geçerli değil"', g1?.gecerli === false, g1);
  const p1 = await istek('/api/sifre/yenile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: 'x'.repeat(43), sifre: 'gecerli-sifre-1' }) });
  t('uydurma jetonla şifre değişmiyor (400, kod)', p1?.status === 400 && (await p1.json()).kod === 'SIFRE_BAGLANTI_GECERSIZ', p1?.status);
  const p2 = await istek('/api/sifre/unuttum', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': `10.77.${process.pid % 250}.1` }, body: JSON.stringify({ eposta: 'yok.boyle@ornek.local' }) });
  const p2j = await p2?.json().catch(() => ({}));
  t('★ uç: kayıtsız adrese de "tamam" (e-posta ya da WhatsApp kanalı)', p2?.status === 200 && p2j.ok === true && ['eposta', 'whatsapp'].includes(p2j.kanal), p2j);
}

await p.$disconnect();
sahte.close();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
