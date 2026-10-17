// WHATSAPP UÇTAN UCA — toplantıda gösterilecek akış, gerçek sunucuda (yerel üretim
// derlemesi) ve SAHTE Meta ile:
//   müşteri yazar (imzalı webhook) → gelen kutusunda görünür → bayi cevaplar →
//   Meta "teslim / okundu" bildirir → müşteri "DUR" yazar → toplu hatırlatma ona gitmez.
// Sunucuyu kendisi açar (next start, test ortam değişkenleriyle) — önce `npm run build`.
// Yalnız YEREL veritabanı; kendi bayisini 'wa-uu-test-' adıyla kurar ve siler.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import http from 'node:http';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay).slice(0, 400)}` : ''}`); }
};
const bitir = (kod) => { console.log(`\n${gecti} geçti, ${kaldi} kaldı`); process.exit(kod); };

const env = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x)) ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(env)) { console.log('  ⊘ atlandı: DATABASE_URL yerel değil'); bitir(0); }
if (!existsSync(join(KOK, '.next', 'BUILD_ID'))) { console.log('  ⊘ atlandı: derleme yok (npm run build)'); bitir(0); }

const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
const { PrismaClient } = await import(istemci);
const p = new PrismaClient();
const bcrypt = (await import(pathToFileURL(join(KOK, 'node_modules/bcryptjs/index.js')).href)).default;

// ── Sahte Meta ──
const meta = [];
let sira = 0;
const sahte = http.createServer((istek, cevap) => {
  let g = '';
  istek.on('data', (x) => { g += x; });
  istek.on('end', () => {
    meta.push({ yol: istek.url, govde: g ? JSON.parse(g) : null });
    cevap.setHeader('content-type', 'application/json');
    cevap.end(JSON.stringify({ messages: [{ id: `wamid.uu${++sira}` }] }));
  });
});
await new Promise((r) => sahte.listen(0, '127.0.0.1', r));

const PORT = 3000 + 100 + Math.floor(Math.random() * 800);
const KOKURL = `http://127.0.0.1:${PORT}`;
const SIR = randomBytes(16).toString('hex');
const PLATFORM = 'platform-uu';
const sunucu = spawn(process.execPath, [join(KOK, 'node_modules/next/dist/bin/next'), 'start', '-p', String(PORT)], {
  cwd: KOK, stdio: 'ignore',
  env: { ...process.env, NODE_ENV: 'production', WHATSAPP_GRAPH_KOK: `http://127.0.0.1:${sahte.address().port}`, WHATSAPP_TOKEN: 'test-jeton',
    WHATSAPP_PHONE_ID: PLATFORM, WHATSAPP_APP_SECRET: SIR, WHATSAPP_VERIFY_TOKEN: 'dogrula-uu', WHATSAPP_TEMPLATE: 'borc_hatirlatma', WHATSAPP_LANG: 'tr' },
});
const kapat = async () => { try { sunucu.kill(); } catch {} sahte.close(); };
for (let i = 0; i < 90; i++) { try { if ((await fetch(`${KOKURL}/api/kayit`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const SLUG = `wa-uu-test-${Date.now()}`;
const temizle = async () => {
  for (const x of await p.tenant.findMany({ where: { slug: { startsWith: 'wa-uu-test-' } }, select: { id: true } })) await p.tenant.delete({ where: { id: x.id } }).catch(() => {});
};
await temizle();

const imzala = (govde) => 'sha256=' + createHmac('sha256', SIR).update(govde, 'utf8').digest('hex');
const webhook = async (obj) => {
  const govde = JSON.stringify(obj);
  return fetch(`${KOKURL}/api/whatsapp/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': imzala(govde) }, body: govde });
};
const musteriYazdi = (id, metin, telefon = '905325556677') => webhook({ entry: [{ changes: [{ value: {
  metadata: { phone_number_id: PLATFORM }, contacts: [{ wa_id: telefon, profile: { name: 'Ece' } }],
  messages: [{ id, from: telefon, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: metin } }],
} }] }] });
const durum = (id, status) => webhook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: PLATFORM }, statuses: [{ id, status, timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: '905325556677' }] } }] }] });

try {
  const bayi = await p.tenant.create({ data: { name: 'Uçtan Uca Fotokopi', slug: SLUG, plan: 'trial', isActive: true, demo: false } });
  const sifre = 'uu-' + randomBytes(6).toString('hex');
  await p.user.create({ data: { tenantId: bayi.id, email: `${SLUG}@ornek.local`, name: 'Yönetici', role: 'ADMIN', isActive: true, passwordHash: await bcrypt.hash(sifre, 4) } });
  const musteri = await p.customer.create({ data: { tenantId: bayi.id, name: 'Ece Mimarlık', phone: '0532 555 66 77' } });

  // Oturum
  let cerez = '';
  const al = async (yol, secenek = {}) => {
    const r = await fetch(`${KOKURL}${yol}`, { ...secenek, headers: { ...(secenek.headers ?? {}), cookie: cerez }, redirect: 'manual' });
    const yeni = r.headers.getSetCookie?.() ?? [];
    if (yeni.length) cerez = [...cerez.split('; ').filter(Boolean), ...yeni.map((c) => c.split(';')[0])].join('; ');
    return r;
  };
  const { csrfToken } = await (await al('/api/auth/csrf')).json();
  await al('/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: `${SLUG}@ornek.local`, password: sifre, csrfToken, json: 'true' }) });
  t('yönetici oturumu açıldı', Boolean((await (await al('/api/auth/session')).json())?.user));

  console.log('\nWebhook güvenliği\n');
  const dog = await fetch(`${KOKURL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=dogrula-uu&hub.challenge=12345`);
  t('★ Meta doğrulaması: doğru jetonla challenge düz metin döner', dog.status === 200 && (await dog.text()) === '12345');
  t('yanlış doğrulama jetonu 403', (await fetch(`${KOKURL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=yanlis&hub.challenge=1`)).status === 403);
  const imzasiz = await fetch(`${KOKURL}/api/whatsapp/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  t('★ imzasız gövde reddedilir (403)', imzasiz.status === 403);

  console.log('\nMüşteri yazar → gelen kutusu\n');
  const w1 = await musteriYazdi('wamid.gelen1', 'Merhaba, sayacı nereye göndereyim?');
  t('★ imzalı mesaj kaydedildi, doğru bayiye düştü', w1.status === 200 && (await w1.json()).saved === 1);
  const w1b = await musteriYazdi('wamid.gelen1', 'Merhaba, sayacı nereye göndereyim?');
  t('Meta tekrarı ikinci kez kaydedilmiyor', (await w1b.json()).saved === 0);
  let kutu = await (await al('/api/whatsapp/inbox')).json();
  const msg = kutu.items?.find((x) => x.text?.startsWith('Merhaba, sayacı'));
  t('★ gelen kutusunda müşteriyle eşleşmiş, cevap penceresi açık', msg && msg.customer?.name === 'Ece Mimarlık' && msg.pencereBitis && kutu.cevapAcik === true, kutu);

  console.log('\nBayi cevaplar\n');
  const once = meta.length;
  const c = await al('/api/whatsapp/inbox', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'cevap', messageId: msg.id, metin: 'Sayaç fotoğrafını buraya gönderebilirsiniz.' }) });
  const cj = await c.json();
  const giden = meta.slice(once).find((x) => x.govde?.type === 'text');
  t('★ cevap platform numarasından müşteriye gitti, bayinin adıyla imzalı', c.ok && giden?.yol === `/${PLATFORM}/messages` && giden.govde.to === '905325556677' && /Uçtan Uca Fotokopi$/.test(giden.govde.text.body), { cj, giden });
  await durum(cj.cevap?.id ? (await p.whatsAppMessage.findUnique({ where: { id: cj.cevap.id } })).waMessageId : 'yok', 'delivered');
  const wamid = (await p.whatsAppMessage.findUnique({ where: { id: cj.cevap.id } })).waMessageId;
  await durum(wamid, 'read');
  kutu = await (await al('/api/whatsapp/inbox?all=1')).json();
  const sohbet = kutu.items?.find((x) => x.id === msg.id)?.cevaplar ?? [];
  t('★ Meta "okundu" bildirimi cevabın yanında görünüyor', sohbet.length === 1 && sohbet[0].durum === 'okundu', sohbet);
  t('cevap gelen kutusu listesine ayrı mesaj olarak düşmüyor', !kutu.items?.some((x) => x.text === 'Sayaç fotoğrafını buraya gönderebilirsiniz.'));

  console.log('\nDUR\n');
  const onceDur = meta.length;
  await musteriYazdi('wamid.gelen2', 'DUR');
  const onay = meta.slice(onceDur).find((x) => x.govde?.type === 'text');
  t('★ "DUR" kaydedildi ve müşteriye onay gitti', await p.whatsAppRet.findUnique({ where: { tenantId_son10: { tenantId: bayi.id, son10: '5325556677' } } }) && /durduruldu/.test(onay?.govde?.text?.body ?? ''), onay);
  // Borç cariden okunur (lib/reminders): satış kaydı = 750 TL açık.
  await p.accountEntry.create({ data: { tenantId: bayi.id, customerId: musteri.id, type: 'SALE', amount: 750, product: 'Test kira', date: new Date() } });
  const onceToplu = meta.length;
  const tb = await al('/api/whatsapp/bulk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customerIds: [musteri.id] }) });
  const tj = await tb.json();
  t('★ toplu borç hatırlatması DUR yazan müşteriye gitmedi', meta.length === onceToplu && (tj.durduran === 1 || tj.ek?.durduran === 1), tj);
  await musteriYazdi('wamid.gelen3', 'BAŞLA');
  t('"BAŞLA" ile yeniden açıldı', !(await p.whatsAppRet.findUnique({ where: { tenantId_son10: { tenantId: bayi.id, son10: '5325556677' } } })));
  const tb2 = await al('/api/whatsapp/bulk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customerIds: [musteri.id] }) });
  const tj2 = await tb2.json();
  const sablon = meta.slice(-1)[0]?.govde;
  t('★ açıldıktan sonra hatırlatma şablonla gidiyor (bayi adı ve tutar)', tj2.sent === 1 && sablon?.type === 'template' && sablon.template.name === 'borc_hatirlatma'
    && sablon.template.components[0].parameters.map((x) => x.text).join('|') === 'Ece Mimarlık|Uçtan Uca Fotokopi|750,00', { tj2, sablon });
} catch (e) {
  t(`beklenmeyen hata: ${e?.message}`, false);
} finally {
  await temizle();
  await p.$disconnect();
  await kapat();
}
bitir(kaldi ? 1 : 0);
