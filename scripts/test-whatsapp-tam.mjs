// WHATSAPP TAMAMLAMA — durum bildirimi, DUR/BAŞLA, mesaj türleri, Meta hata metni,
// gönderimde mesaj kimliği. Sahte Meta sunucusu + YEREL veritabanı (başka yere yazmaz).
// Kendi bayilerini 'wa-tam-test-*' adıyla kurar, başta ve sonda temizler.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import http from 'node:http';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

// ── Sahte Meta: gönderimleri kaydeder, sıralı wamid döner ──
const gelen = [];
let sira = 0;
const sahte = http.createServer((istek, cevap) => {
  let govde = '';
  istek.on('data', (p) => { govde += p; });
  istek.on('end', () => {
    const j = govde ? JSON.parse(govde) : null;
    gelen.push({ yol: istek.url, govde: j });
    cevap.setHeader('content-type', 'application/json');
    if (j?.to === '905009999999') { cevap.statusCode = 400; cevap.end(JSON.stringify({ error: { code: 131030, message: 'Recipient phone number not in allowed list' } })); return; }
    cevap.end(JSON.stringify({ messages: [{ id: `wamid.tam${++sira}` }] }));
  });
});
await new Promise((r) => sahte.listen(0, '127.0.0.1', r));
Object.assign(process.env, {
  WHATSAPP_GRAPH_KOK: `http://127.0.0.1:${sahte.address().port}`, WHATSAPP_TOKEN: 'test-jeton', WHATSAPP_PHONE_ID: 'platform-tam',
  WHATSAPP_TEMPLATE: 'borc_hatirlatma', WHATSAPP_LANG: 'tr',
});

// ── Derleme (diğer WhatsApp testleriyle aynı yol) ──
const g = mkdtempSync(join(tmpdir(), 'st-watam-'));
const KAYNAKLAR = ['whatsapp-graph', 'whatsapp-sablon', 'whatsapp', 'whatsapp-out', 'whatsapp-inbound', 'vade-hatirlatma', 'reminders'];
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), ...KAYNAKLAR.map((k) => join(KOK, `src/lib/${k}.ts`)),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
writeFileSync(join(g, 'invoicing.js'), 'export async function markOverdueInvoices() { return 0; }\n');
for (const k of KAYNAKLAR) {
  const yol = join(g, `${k}.js`);
  if (!existsSync(yol)) continue;
  writeFileSync(yol, readFileSync(yol, 'utf8')
    .replace(/'@\/lib\/prisma'/g, "'./prisma-shim.js'")
    .replace(/'@\/lib\/([\w-]+)'/g, "'./$1.js'")
    .replace(/'@prisma\/client'/g, JSON.stringify(istemci)));
}
const al = (k) => import(pathToFileURL(join(g, `${k}.js`)).href);
const [graf, gir, wa, out, sablon] = await Promise.all([al('whatsapp-graph'), al('whatsapp-inbound'), al('whatsapp'), al('whatsapp-out'), al('whatsapp-sablon')]);

console.log('\nŞablonlar\n');
for (const [k, s] of Object.entries(sablon.SABLONLAR)) {
  t(`${k}: müşteri durdurabilir ("DUR yazın")`, /DUR yazın\.$/.test(s.metin));
}

console.log('\nMeta hata metni\n');
t('★ test numarası listesi (131030) bayinin yapacağını söylüyor', /test listesinde değil/.test(graf.waHataMetni(131030, 'Recipient phone number not in allowed list')) && /#131030/.test(graf.waHataMetni(131030)));
t('★ 24 saat penceresi (131047) açıklanıyor', /24 saat/.test(graf.waHataMetni(131047)));
t('jeton süresi (190) açıklanıyor', /jeton/.test(graf.waHataMetni(190)));
t('bilinmeyen kodda Meta mesajı kalıyor', graf.waHataMetni(999999, 'Garip hata') === 'Garip hata (#999999)');
t('İngilizce metin de var', /test list/.test(graf.waHataMetni(131030, null, 'en')));
t('Graph sürümü güncel ve değiştirilebilir', /^v2[3-9]\.0$/.test(graf.GRAPH_SURUM) && /WHATSAPP_GRAPH_SURUM/.test(readFileSync(join(KOK, 'src/lib/whatsapp-graph.ts'), 'utf8')));

console.log('\nGelen mesaj türleri\n');
{
  const govde = (mesajlar) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: 'platform-tam' }, contacts: [{ wa_id: '905321112233', profile: { name: 'Ali' } }], messages: mesajlar } }] }] });
  const m = gir.parseWebhook(govde([
    { id: 'a', from: '905321112233', type: 'button', button: { text: 'Ödedim' } },
    { id: 'b', from: '905321112233', type: 'interactive', interactive: { button_reply: { title: 'Evet' } } },
    { id: 'c', from: '905321112233', type: 'location', location: { latitude: 41.07, longitude: 29.0, name: 'Ofis' } },
    { id: 'd', from: '905321112233', type: 'contacts', contacts: [{ name: { formatted_name: 'Veli' }, phones: [{ phone: '+90 532 000' }] }] },
    { id: 'e', from: '905321112233', type: 'sticker', sticker: { id: 'st1' } },
    { id: 'f', from: '905321112233', type: 'reaction', reaction: { emoji: '👍' } },
    { id: 'g', from: '905321112233', type: 'image', image: { id: 'im1', caption: 'sayaç' } },
  ]));
  const by = Object.fromEntries(m.map((x) => [x.waMessageId, x]));
  t('★ şablon düğmesine basış metin olarak geliyor', by.a?.text === 'Ödedim');
  t('etkileşimli cevap başlığı', by.b?.text === 'Evet');
  t('konum okunur metin', /📍 Ofis \(41\.07, 29\)/.test(by.c?.text ?? ''), by.c?.text);
  t('kişi kartı okunur metin', by.d?.text === '👤 Veli +90 532 000');
  t('çıkartma medya olarak', by.e?.mediaId === 'st1' && by.e?.mediaType === 'sticker');
  t('tepki (👍) gelen kutusuna düşmüyor', !by.f);
  t('fotoğraf + açıklama', by.g?.mediaId === 'im1' && by.g?.text === 'sayaç');
}

console.log('\nDUR / BAŞLA\n');
t('★ "DUR", "dur.", "Dur!", "İSTEMİYORUM", "stop" → durdur', ['DUR', 'dur.', 'Dur!', 'İSTEMİYORUM', 'stop', 'Hatırlatma istemiyorum'].every((x) => gir.retKomutu(x) === 'DUR'));
t('★ cümle içinde geçen komut değil ("makine durdu", "dur bakalım")', [null, undefined, '', 'makine durdu', 'dur bakalım ne olacak', 'istemiyorum ama gelin'].every((x) => gir.retKomutu(x) === null));
t('"BAŞLA", "basla", "Start" → yeniden aç', ['BAŞLA', 'basla', 'Start'].every((x) => gir.retKomutu(x) === 'BASLA'));

console.log('\nDurum bildirimi ayrıştırma\n');
{
  const d = gir.parseStatuses({ entry: [{ changes: [{ value: { statuses: [
    { id: 'wamid.1', status: 'delivered', timestamp: '1760000000', recipient_id: '905321112233' },
    { id: 'wamid.2', status: 'failed', timestamp: '1760000000', errors: [{ code: 131026, title: 'Message undeliverable' }] },
    { id: 'wamid.3', status: 'weird' },
  ] } }] }] });
  t('teslim + iletilemedi okunuyor, bilinmeyen atlanıyor', d.length === 2 && d[0].durum === 'delivered' && d[1].hataKodu === 131026 && /iletilemedi/.test(d[1].hata));
}

// ── Veritabanı kısmı (yalnız yerel) ──
let p;
try {
  const env = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x)) ?? '';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(env)) throw new Error('yerel değil');
  const { PrismaClient } = await import(istemci);
  p = new PrismaClient();
} catch (e) {
  console.log(`\n  ⊘ veritabanı kısmı atlandı: ${e.message}`);
}

if (p) {
  const temizle = async () => {
    const l = await p.tenant.findMany({ where: { slug: { startsWith: 'wa-tam-test-' } }, select: { id: true } });
    for (const x of l) await p.tenant.delete({ where: { id: x.id } }).catch(() => {});
  };
  await temizle();
  try {
    const yeni = (n) => p.tenant.create({ data: { name: `WA Tam ${n}`, slug: `wa-tam-test-${n}-${Date.now()}`, plan: 'trial', isActive: true, demo: false } });
    const A = await yeni('a');
    const B = await yeni('b');
    const mA = await p.customer.create({ data: { tenantId: A.id, name: 'Ayşe', phone: '0532 444 55 66' } });

    console.log('\nPaylaşımlı numara: hangi bayi\n');
    // B bu numarayı müşteri olarak tanımıyor ama 30 gün içinde ona WhatsApp gönderdi (mağaza alıcısı gibi).
    await p.notificationLog.create({ data: { tenantId: B.id, recipient: '905324445566', channel: 'WHATSAPP', status: 'SENT', message: 'Mağaza: sipariş' } });
    const bayiler = await gir.numaraninBayileri('5324445566');
    t('★ servis müşterisi olan bayi + son 30 günde mesaj atan bayi aday', bayiler.length === 2 && bayiler.some((x) => x.id === A.id) && bayiler.some((x) => x.id === B.id), bayiler);

    console.log('\nDUR kaydı\n');
    await gir.retUygula([A.id, B.id], '905324445566', 'DUR');
    t('★ iki bayide de durduruldu (son 10 hane)', (await gir.retliMi(A.id, '0532 444 55 66')) && (await gir.retliMi(B.id, '+90 532 444 55 66')));
    await gir.retUygula([A.id, B.id], '905324445566', 'DUR');
    t('iki kez DUR çift kayıt yapmıyor', (await p.whatsAppRet.count({ where: { son10: '5324445566', tenantId: { in: [A.id, B.id] } } })) === 2);
    await gir.retUygula([B.id], '905324445566', 'BASLA');
    t('BAŞLA yalnız o bayide açıyor', (await gir.retliMi(A.id, '05324445566')) && !(await gir.retliMi(B.id, '05324445566')));

    console.log('\nGönderimde mesaj kimliği + ret listesi\n');
    const r = await wa.sendOneWhatsApp('0532 444 55 66', ['Ayşe', 'WA Tam a', '100,00'], 'borc_hatirlatma');
    t('★ şablon gönderimi Meta mesaj kimliğini döndürüyor', r.ok && /^wamid\.tam\d+$/.test(r.id), r);
    const hatali = await wa.sendOneWhatsApp('0500 999 99 99', ['x', 'y', 'z'], 'borc_hatirlatma');
    t('★ Meta hatası okunur Türkçe + kod', !hatali.ok && hatali.kod === 131030 && /test listesinde değil/.test(hatali.error), hatali);
    const metin = await out.sendText('905324445566', 'Merhaba');
    t('serbest metin de kimlik döndürüyor', metin.ok && /^wamid\.tam\d+$/.test(metin.id));

    console.log('\nDurum bildirimi kayda işleniyor\n');
    const log = await p.notificationLog.create({ data: { tenantId: A.id, recipient: '905324445566', channel: 'WHATSAPP', status: 'SENT', message: 'Borç hatırlatma — test', waMessageId: 'wamid.durum1' } });
    await gir.durumIsle({ waMessageId: 'wamid.durum1', durum: 'read', zaman: new Date('2026-10-15T10:05:00Z'), hataKodu: null, hata: null });
    await gir.durumIsle({ waMessageId: 'wamid.durum1', durum: 'delivered', zaman: new Date('2026-10-15T10:01:00Z'), hataKodu: null, hata: null });
    let l1 = await p.notificationLog.findUnique({ where: { id: log.id } });
    t('★ okundu + teslim zamanı yazıldı (sırasız gelse de)', l1.okunduAt?.toISOString() === '2026-10-15T10:05:00.000Z' && l1.teslimAt?.toISOString() === '2026-10-15T10:05:00.000Z', l1);
    await gir.durumIsle({ waMessageId: 'wamid.durum1', durum: 'failed', zaman: new Date(), hataKodu: 131026, hata: graf.waHataMetni(131026) });
    l1 = await p.notificationLog.findUnique({ where: { id: log.id } });
    t('★ iletilemedi → FAILED + okunur sebep', l1.status === 'FAILED' && /iletilemedi/.test(l1.error ?? ''), l1);

    const giden = await p.whatsAppMessage.create({ data: { tenantId: A.id, customerId: mA.id, yon: 'GIDEN', waMessageId: 'wamid.giden1', fromPhone: '905324445566', text: 'Cevap', receivedAt: new Date(), durum: 'gonderildi' } });
    await gir.durumIsle({ waMessageId: 'wamid.giden1', durum: 'read', zaman: new Date(), hataKodu: null, hata: null });
    await gir.durumIsle({ waMessageId: 'wamid.giden1', durum: 'delivered', zaman: new Date(), hataKodu: null, hata: null });
    t('★ gelen kutusu cevabı: okundu, sonra gelen "teslim" geri çekmiyor', (await p.whatsAppMessage.findUnique({ where: { id: giden.id } })).durum === 'okundu');

    console.log('\nVade hatırlatması: ret listesi + kimlik\n');
    const { vadeHatirlatmalari } = await al('vade-hatirlatma');
    await p.tenant.update({ where: { id: A.id }, data: { vadeHatirlatma: true } });
    const mB2 = await p.customer.create({ data: { tenantId: A.id, name: 'Bora', phone: '0533 777 88 99' } });
    for (const [c, no] of [[mA, 'WT-1'], [mB2, 'WT-2']]) {
      await p.customerInvoice.create({ data: { tenantId: A.id, customerId: c.id, invoiceNumber: `${no}-${Date.now()}`, period: '2026-09', status: 'OVERDUE', totalAmount: 500, paidAmount: 0, dueDate: new Date('2026-09-30'), invoiceDate: new Date('2026-09-01') } }).catch((e) => console.log('   (fatura kurulamadı:', e.message.split('\n').pop(), ')'));
    }
    const once = gelen.length;
    await vadeHatirlatmalari(new Date());
    const giden2 = gelen.slice(once).map((x) => x.govde?.to);
    t('★ DUR yazan Ayşe\'ye hatırlatma gitmedi, Bora\'ya gitti', !giden2.includes('905324445566') && giden2.includes('905337778899'), giden2);
    const blog = await p.notificationLog.findFirst({ where: { tenantId: A.id, recipient: '0533 777 88 99' }, orderBy: { createdAt: 'desc' } });
    t('★ gönderim kaydında Meta mesaj kimliği (durum bildirimi bağlanabilir)', /^wamid\.tam\d+$/.test(blog?.waMessageId ?? ''), blog);
  } finally {
    await temizle();
    await p.$disconnect();
  }
}

sahte.close();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
