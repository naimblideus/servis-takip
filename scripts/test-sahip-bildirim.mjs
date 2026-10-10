// SAHİBE BİLDİRİM — yeni kayıt/talep anında e-posta + sabah özeti
// Çalıştır:  node scripts/test-sahip-bildirim.mjs
//
// NEDEN BU TEST
// Siteden açılan deneme hesabı aynı gün aranmazsa ölür; platform sahibi Talepler
// ekranına sürekli bakamaz. Bu yüzden her kayıt e-postayla geliyor. E-posta
// SESSİZ bozulur: başlık yanlış kodlanır (Türkçe konu "?" olur), jeton her
// seferinde yeniden alınır (Google kotası), Gmail hata verince kayıt da düşer.
// Gerçek Google yerine yerel sahte sunucu: hiçbir e-posta dışarı çıkmaz.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(KOK, 'package.json'));
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');

// ── DERLEME ──────────────────────────────────────────────────────────────
const g = mkdtempSync(join(tmpdir(), 'st-bildirim-'));
const KAYNAKLAR = ['sahip-bildirim', 'sahip-ozet', 'talep'];
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), ...KAYNAKLAR.map((k) => join(KOK, `src/lib/${k}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
for (const k of KAYNAKLAR) {
  const yol = join(g, `${k}.js`);
  if (!existsSync(yol)) continue;
  writeFileSync(yol, readFileSync(yol, 'utf8').replace(/'@\/lib\/prisma'/g, "'./prisma-shim.js'").replace(/'@\/lib\/([\w-]+)'/g, "'./$1.js'"));
}

// ── SAHTE GOOGLE ─────────────────────────────────────────────────────────
const alinan = [];
let jetonIstegi = 0, sonrakiGmail = [];
const sahte = http.createServer((istek, cevap) => {
  let govde = '';
  istek.on('data', (d) => { govde += d; });
  istek.on('end', () => {
    if (istek.url === '/token') {
      jetonIstegi++;
      const p = new URLSearchParams(govde);
      const dogru = p.get('grant_type') === 'refresh_token' && p.get('refresh_token') === 'yenileme-test';
      cevap.writeHead(dogru ? 200 : 400, { 'content-type': 'application/json' });
      cevap.end(JSON.stringify(dogru ? { access_token: `erisim-${jetonIstegi}`, expires_in: 3600 } : { error: 'invalid_grant' }));
      return;
    }
    if (istek.url === '/gmail/v1/users/me/messages/send') {
      const zorla = sonrakiGmail.shift();
      if (zorla) { cevap.writeHead(zorla); cevap.end('{}'); return; }
      alinan.push({ yetki: istek.headers.authorization, ham: JSON.parse(govde).raw });
      cevap.writeHead(200, { 'content-type': 'application/json' });
      cevap.end('{"id":"x"}');
      return;
    }
    cevap.writeHead(404); cevap.end();
  });
});
await new Promise((r) => sahte.listen(0, '127.0.0.1', r));
const port = sahte.address().port;

/** Gmail'e giden ham iletiyi çöz: başlıklar + gövde metni. */
function coz(ham) {
  const metin = Buffer.from(ham, 'base64url').toString('utf8');
  const [bas, ...govde] = metin.split('\r\n\r\n');
  const basliklar = Object.fromEntries(bas.split('\r\n').map((s) => [s.slice(0, s.indexOf(':')), s.slice(s.indexOf(':') + 2)]));
  const konuHam = basliklar.Subject ?? '';
  const konu = konuHam.startsWith('=?UTF-8?B?') ? Buffer.from(konuHam.slice(10, -2), 'base64').toString('utf8') : konuHam;
  return { basliklar, konu, govde: Buffer.from(govde.join('\r\n\r\n').replace(/\r\n/g, ''), 'base64').toString('utf8'), bas };
}

const ENV = {
  BILDIRIM_TOKEN_URL: `http://127.0.0.1:${port}/token`, BILDIRIM_GMAIL_KOK: `http://127.0.0.1:${port}`,
  BILDIRIM_GMAIL_CLIENT_ID: 'istemci-test', BILDIRIM_GMAIL_CLIENT_SECRET: 'gizli-test', BILDIRIM_GMAIL_REFRESH_TOKEN: 'yenileme-test',
  BILDIRIM_EPOSTA: 'sahip@ornek.local', NEXTAUTH_URL: 'https://nextusservis.com',
};
for (const k of Object.keys(ENV)) delete process.env[k];
const bil = await import(pathToFileURL(join(g, 'sahip-bildirim.js')).href);

console.log('\nE-posta gönderimi\n');
t('ayar yokken gönderilmiyor, ağa çıkılmıyor', (await bil.sahibeEposta('x', ['y'])) === 'kapali' && jetonIstegi === 0 && alinan.length === 0);
Object.assign(process.env, ENV);
t('ayar tamamken hazır', bil.bildirimAyarli() === true);
const r1 = await bil.sahibeEposta('Yeni deneme hesabı: Işık Büro (Şanlıurfa)', ['Satır bir: ğüşiöç', null, 'Satır iki']);
const e1 = alinan[0] ? coz(alinan[0].ham) : null;
t('★ gönderildi; alıcı ve Türkçe konu doğru kodlandı', r1 === 'gonderildi' && e1?.basliklar.To === 'sahip@ornek.local' && e1?.konu === 'Yeni deneme hesabı: Işık Büro (Şanlıurfa)', e1 && { to: e1.basliklar.To, konu: e1.konu });
t('gövde: Türkçe harfler ve boş satır atlandı', e1?.govde === 'Satır bir: ğüşiöç\r\nSatır iki', e1?.govde);
t('erişim jetonuyla gönderildi', alinan[0]?.yetki === 'Bearer erisim-1');
await bil.sahibeEposta('ikinci', ['x']);
t('★ jeton önbellekte: ikinci e-posta Google\'dan yeni jeton istemiyor', jetonIstegi === 1, jetonIstegi);
await bil.sahibeEposta('Konu\r\nBcc: saldirgan@kotu.example', ['x']);
const e3 = coz(alinan.at(-1).ham);
t('★ başlık enjeksiyonu yok: konudaki satır sonu yeni başlık açmıyor', !/^Bcc:/m.test(e3.bas) && !('Bcc' in e3.basliklar), e3.bas);
sonrakiGmail = [401];
const r4 = await bil.sahibeEposta('iptal edilmiş jeton', ['x']);
t('jeton reddedilince bir kez yenileyip gönderiyor', r4 === 'gonderildi' && jetonIstegi === 2, { r4, jetonIstegi });
sonrakiGmail = [500];
t('★ Gmail hata verirse fırlatmıyor ("hata" döner)', (await bil.sahibeEposta('x', ['y'])) === 'hata');
t('WhatsApp bağlantısı: cep evet, sabit hat hayır', bil.whatsappBaglantisi('0532 111 22 33') === 'https://wa.me/905321112233' && bil.whatsappBaglantisi('0212 555 55 55') === null);

// ── KAYNAK ───────────────────────────────────────────────────────────────
console.log('\nKaynak\n');
t('sabah özeti ucu gün başına bir kez çalışıyor', /tekSeferlik\(req, 'sahip-ozet', 'gunluk'/.test(oku('src/app/api/cron/sahip-ozet/route.ts')));
t('zamanlayıcıda 08:30', /anahtar: 'sahip-ozet', tur: 'gunluk', saat: 8, dakika: 30/.test(oku('src/lib/zamanlayici.ts')));
t('elle tetik: run-cron ozet', /ozet: \{ path: '\/api\/cron\/sahip-ozet'/.test(oku('run-cron.mjs')));
const arac = oku('scripts/gmail-bildirim-yetki.mjs');
t('★ bağlantı aracı YALNIZ e-posta gönderme izni istiyor (takvim/okuma yok)', /auth\/gmail\.send/.test(arac) && !/calendar|gmail\.readonly|gmail\.modify|mail\.google\.com/.test(arac));
t('bağlantı aracı gizli değerleri ekrana yazmıyor', !/console\.(log|error)\([^)]*(v\.refresh_token|istemci\.gizli|satirlar)/.test(arac));
t('kayıt bildirimi il bilgisini taşıyor', /il: veri\.il/.test(oku('src/lib/kayit.ts')));

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  const ON = 'Bildirim Testi';
  const temizle = async () => {
    await p.tenant.deleteMany({ where: { name: { startsWith: ON } } });
    await p.lead.deleteMany({ where: { firma: { startsWith: ON } } });
  };
  await temizle();
  try {
    console.log('\nTalep bildirimi (veritabanı)\n');
    const talep = await import(pathToFileURL(join(g, 'talep.js')).href);
    const once = alinan.length;
    await talep.talepKaydet({ firma: `${ON} Kayıt`, ad: 'Ali Yılmaz', telefon: '05321112233', eposta: 'ali@ornek.local', il: 'Van', mesaj: 'Siteden 14 günlük deneme hesabı açtı (Van).' }, 'kayit');
    const k = coz(alinan[once]?.ham ?? '');
    t('★ yeni deneme hesabı: konu firma + il, gövdede telefon, WhatsApp ve Talepler bağlantısı', k.konu === `Yeni deneme hesabı: ${ON} Kayıt (Van)`
      && /Telefon: 05321112233/.test(k.govde) && /WhatsApp: https:\/\/wa\.me\/905321112233/.test(k.govde) && /https:\/\/nextusservis\.com\/super-admin\/talepler/.test(k.govde) && /Bugün arayın/.test(k.govde), k);
    t('talep yine de kayıtlı (kaynak kayit)', (await p.lead.count({ where: { firma: `${ON} Kayıt`, kaynak: 'kayit' } })) === 1);
    await talep.talepKaydet({ firma: `${ON} Form`, telefon: '05329998877', mesaj: '40 makinemiz var, sayaç toplamak zor' }, 'landing');
    const l = coz(alinan.at(-1).ham);
    t('siteden talep: konu ve mesaj', l.konu === `Siteden talep: ${ON} Form` && /40 makinemiz var/.test(l.govde), l.konu);
    sonrakiGmail = [500];
    await talep.talepKaydet({ firma: `${ON} Hata`, telefon: '05320000000' }, 'landing');
    t('★ e-posta gidemese de talep kaydı kaybolmuyor', (await p.lead.count({ where: { firma: `${ON} Hata` } })) === 1);

    console.log('\nSabah özeti (veritabanı)\n');
    const ozet = await import(pathToFileURL(join(g, 'sahip-ozet.js')).href);
    const simdi = new Date();
    const gun = (n) => new Date(simdi.getTime() + n * 86_400_000);
    const bayi = (ad, ek) => p.tenant.create({ data: { name: `${ON} ${ad}`, plan: 'trial', phone: '05321234567', city: 'Erzurum', ...ek }, select: { id: true } });
    await bayi('Yeni', { createdAt: gun(-0.2), trialEndsAt: gun(13.8) });
    await bayi('Bos', { createdAt: gun(-3), trialEndsAt: gun(11) });
    const dolu = await bayi('Dolu', { createdAt: gun(-3), trialEndsAt: gun(11) });
    await p.customer.create({ data: { tenantId: dolu.id, name: 'Müşteri', phone: '5550001' } });
    const bitecek = await bayi('Bitecek', { createdAt: gun(-12), trialEndsAt: gun(2) });
    await p.customer.create({ data: { tenantId: bitecek.id, name: 'Müşteri', phone: '5550002' } });
    await bayi('Biten', { createdAt: gun(-16), trialEndsAt: gun(-2) });
    await bayi('Cok Eski', { createdAt: gun(-40), trialEndsAt: gun(-26) });
    await bayi('Demo', { createdAt: gun(-0.1), trialEndsAt: gun(14), demo: true });
    await bayi('Ucretli', { createdAt: gun(-0.1), trialEndsAt: null, plan: 'professional' });
    const o = await ozet.gunlukOzet(simdi);
    const adlar = (l) => l.map((s) => s.firma).filter((f) => f.startsWith(ON)).map((f) => f.slice(ON.length + 1)).sort().join(',');
    t('★ yeni: son 24 saat (demo ve ücretli hariç)', adlar(o.yeni) === 'Yeni', adlar(o.yeni));
    t('★ aranacak: 2+ gündür müşteri de cihaz da yok (verisi olan hariç)', adlar(o.bekleyen) === 'Bos', adlar(o.bekleyen));
    t('denemesi 3 gün içinde bitecek', adlar(o.bitecek) === 'Bitecek', adlar(o.bitecek));
    t('denemesi son 7 günde bitmiş, hâlâ deneme paketinde (ödemedi)', adlar(o.biten) === 'Biten', adlar(o.biten));
    t('talepler: siteden gelen form var, kendi kendine kayıt (zaten yeni hesapta) yok', o.talepler.some((x) => x.firma === `${ON} Form`) && !o.talepler.some((x) => x.firma === `${ON} Kayıt`));
    t('veri sayıları özete giriyor', o.bitecek.find((s) => s.firma === `${ON} Bitecek`)?.musteri === 1);
    const m = ozet.ozetMetni(o);
    t('★ konu iş miktarını söylüyor', /^Günlük özet: /.test(m.konu) && /yeni hesap/.test(m.konu) && /aranacak/.test(m.konu) && /denemesi bitiyor/.test(m.konu), m.konu);
    const govde = m.satirlar.join('\n');
    t('gövde: bölümler, telefon ve WhatsApp', /YENİ DENEME HESAPLARI/.test(govde) && /VERİ YÜKLEMEDEN BEKLEYENLER/.test(govde) && /DENEMESİ BİTEN, ÖDEME YAPMAYANLAR/.test(govde)
      && /Bildirim Testi Bos · Erzurum · 05321234567 · müşteri 0, cihaz 0/.test(govde) && /wa\.me\/905321234567/.test(govde));
    const once2 = alinan.length;
    const g1 = await ozet.ozetiGonder(simdi);
    t('★ özet gönderildi (sahte Gmail aldı)', g1.gonderim === 'gonderildi' && alinan.length === once2 + 1 && /^Günlük özet/.test(coz(alinan.at(-1).ham).konu), g1);
    for (const k2 of Object.keys(ENV)) delete process.env[k2];
    t('ayar yokken özet "kapalı" döner, iş durmaz', (await ozet.ozetiGonder(simdi)).gonderim === 'kapali');
  } finally {
    await temizle();
    await p.$disconnect();
  }
}

sahte.close();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
