// MAĞAZA WHATSAPP KAPISI — POST/GET /api/shop/bildirim, SAHTE Meta ile.
// Çalıştır:  npx tsx --tsconfig tsconfig.json scripts/test-shop-bildirim.mts
//
// NEDEN BU TEST
// Mağaza bildirimleri tek platform numarasından ŞABLONLA gider. Bir şablon adı
// ya da değişken sayısı kayarsa Meta bütün mesajı reddeder; DUR yazan birine
// mesaj giderse numaranın kalitesi bütün bayiler için düşer; demo mağazadan
// rastgele numaraya mesaj gitmemeli. Uç işleyicisi doğrudan çağrılır (sunucu
// derlemesi gerekmez); Meta, gelen isteği kaydeden yerel bir sunucudur.
// Yalnız YEREL veritabanı; kendi bayilerini 'shop-wa-test-' adıyla kurar ve siler.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
let gecti = 0, kaldi = 0;
const t = (ad: string, kosul: unknown, detay?: unknown) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay).slice(0, 500)}` : ''}`); }
};
const bitir = (kod: number) => { console.log(`\n${gecti} geçti, ${kaldi} kaldı`); process.exit(kod); };

const envSatiri = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x)) ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(envSatiri)) { console.log('  ⊘ atlandı: DATABASE_URL yerel değil'); bitir(0); }

// ── Sahte Meta: gelen her isteği kaydeder; hata modu açılabilir ──
type Kayit = { yontem: string; yol: string; govde: any };
const meta: Kayit[] = [];
let sira = 0;
let hataModu: null | { kod: number; mesaj: string } = null;
const sahte = http.createServer((istek, cevap) => {
  let g = '';
  istek.on('data', (x) => { g += x; });
  istek.on('end', () => {
    meta.push({ yontem: istek.method ?? '', yol: istek.url ?? '', govde: g ? JSON.parse(g) : null });
    cevap.setHeader('content-type', 'application/json');
    if (istek.method === 'GET' && (istek.url ?? '').includes('/message_templates')) {
      cevap.end(JSON.stringify({ data: [
        { name: 'magaza_yeni_siparis', status: 'APPROVED', language: 'tr' },
        { name: 'magaza_siparis_alindi', status: 'PENDING', language: 'tr' },
        { name: 'magaza_siparis_kargoda', status: 'APPROVED', language: 'en' },
        { name: 'borc_hatirlatma', status: 'APPROVED', language: 'tr' },
      ] }));
      return;
    }
    if (hataModu) {
      cevap.statusCode = 400;
      cevap.end(JSON.stringify({ error: { code: hataModu.kod, message: hataModu.mesaj } }));
      return;
    }
    cevap.end(JSON.stringify({ messages: [{ id: `wamid.shop${++sira}` }] }));
  });
});
await new Promise<void>((r) => sahte.listen(0, '127.0.0.1', () => r()));
const port = (sahte.address() as { port: number }).port;

// Ortam UÇ YÜKLENMEDEN önce: Graph kökü modül yüklenirken okunuyor.
const JETON = 'shop-bildirim-test-jetonu-0123456789';
const PLATFORM = 'platform-shop-test';
Object.assign(process.env, {
  WHATSAPP_GRAPH_KOK: `http://127.0.0.1:${port}`,
  WHATSAPP_TOKEN: 'test-jeton',
  WHATSAPP_PHONE_ID: PLATFORM,
  SHOP_SERVICE_TOKEN: JETON,
});
delete process.env.WHATSAPP_WABA_ID;

const { prisma } = await import('../src/lib/prisma');
const uc = await import('../src/app/api/shop/bildirim/route');
const { parseStatuses, durumIsle, numaraninBayileri } = await import('../src/lib/whatsapp-inbound');
const { MAGAZA_SABLONLARI, degiskenSayisi } = await import('../src/lib/whatsapp-sablon-magaza');

const ON = 'shop-wa-test-';
const temizle = async () => {
  for (const x of await prisma.tenant.findMany({ where: { slug: { startsWith: ON } }, select: { id: true } }))
    await prisma.tenant.delete({ where: { id: x.id } }).catch(() => {});
};
await temizle();

const zaman = Date.now();
const bayi = await prisma.tenant.create({ data: { name: 'Shop WA Test Bayi', slug: `${ON}${zaman}`, demo: false } });
const demo = await prisma.tenant.create({ data: { name: 'Shop WA Demo', slug: `${ON}demo-${zaman}`, demo: true } });

const post = (govde: unknown, yetki = true) =>
  uc.POST(new Request('http://x/api/shop/bildirim', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(yetki ? { authorization: `Bearer ${JETON}` } : {}) },
    body: typeof govde === 'string' ? govde : JSON.stringify(govde),
  }));
const json = async (r: Response) => ({ durum: r.status, j: (await r.json().catch(() => ({}))) as any });

// Benzersiz bir test numarası (gerçek bir kişiye denk gelmesin diye 0500…).
const TEL = `0500 ${String(zaman).slice(-3)} ${String(zaman).slice(-5, -3)} ${String(zaman).slice(-7, -5)}`;
const S = MAGAZA_SABLONLARI;
const alti = ['Örnek\nFotokopi', 'NM-2026-00042', 'Ahmet\t\tYılmaz', '1.836,45', 'Havale/EFT', 'https://ornek.com/yonetim/siparisler#NM-2026-00042'];

try {
  console.log('\nŞablon listesi');
  for (const s of Object.values(S)) {
    const n = degiskenSayisi(s.metin);
    const sirali = [...s.metin.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    t(`${s.ad}: değişkenler sırayla, tekrarsız`, sirali.every((v, i) => v === i + 1), sirali);
    t(`${s.ad}: değişkenle başlamıyor/bitmiyor`, !/^\s*\{\{/.test(s.metin) && !/\}\}\s*$/.test(s.metin));
    t(`${s.ad}: yan yana değişken yok`, !/\}\}\s*\{\{/.test(s.metin));
    t(`${s.ad}: örnek sayısı = değişken sayısı`, s.ornek.length === n, { n, ornek: s.ornek.length });
    t(`${s.ad}: "DUR" yolu ya da tek seferlik olduğu yazıyor`, /DUR|bir kez/.test(s.metin));
  }

  console.log('\nKapı');
  t('anahtarsız → 401', (await post({ tenantId: bayi.id, telefon: TEL }, false)).status === 401);
  const tok = process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_TOKEN;
  t('WhatsApp kurulu değil → 503', (await post({ tenantId: bayi.id })).status === 503);
  process.env.WHATSAPP_TOKEN = tok;
  t('yoklama {tenantId} → 400 (kanal açık demek)', (await post({ tenantId: bayi.id })).status === 400);
  t('bozuk JSON → 400', (await post('{bozuk')).status === 400);

  const once = meta.length;
  let r = await json(await post({ tenantId: bayi.id, telefon: TEL, sablon: 'borc_hatirlatma', parametreler: ['a', 'b', 'c'] }));
  t('mağaza listesinde olmayan şablon → 400 SABLON_BILINMIYOR', r.durum === 400 && r.j.kod === 'SABLON_BILINMIYOR', r);
  r = await json(await post({ tenantId: bayi.id, telefon: TEL, sablon: S.yeniSiparis.ad, parametreler: alti.slice(0, 5) }));
  t('eksik değişken → 400 DEGISKEN_SAYISI', r.durum === 400 && r.j.kod === 'DEGISKEN_SAYISI', r);
  r = await json(await post({ tenantId: bayi.id, telefon: TEL, sablon: S.yeniSiparis.ad, parametreler: 'tek' }));
  t('değişkenler dizi değil → 400', r.durum === 400, r);
  r = await json(await post({ tenantId: demo.id, telefon: TEL, sablon: S.yeniSiparis.ad, parametreler: alti }));
  t('demo bayi → 403 DEMO', r.durum === 403 && r.j.kod === 'DEMO', r);
  r = await json(await post({ tenantId: bayi.id, telefon: '0212 111', sablon: S.yeniSiparis.ad, parametreler: alti }));
  t('geçersiz telefon → 400', r.durum === 400, r);
  r = await json(await post({ tenantId: 'yok-boyle-bayi', telefon: TEL, sablon: S.yeniSiparis.ad, parametreler: alti }));
  t('olmayan bayi → 404', r.durum === 404, r);
  t('reddedilen isteklerin hiçbiri Meta’ya gitmedi', meta.length === once, meta.slice(once));

  console.log('\nGönderim');
  r = await json(await post({ tenantId: bayi.id, telefon: TEL, sablon: S.yeniSiparis.ad, parametreler: alti }));
  const giden = meta[meta.length - 1];
  t('şablon gönderildi → 200 + mesaj kimliği', r.durum === 200 && r.j.ok && /^wamid\.shop/.test(r.j.mesajId), r);
  t('Meta’ya doğru numaradan, şablon türünde', giden?.yol === `/${PLATFORM}/messages` && giden.govde.type === 'template', giden?.yol);
  t('şablon adı + dil tr', giden?.govde.template.name === S.yeniSiparis.ad && giden.govde.template.language.code === 'tr');
  const p = giden?.govde.template.components[0].parameters.map((x: any) => x.text) ?? [];
  t('6 değişken, sırası korunmuş', p.length === 6 && p[1] === 'NM-2026-00042' && p[5].startsWith('https://'), p);
  t('satır sonu/sekme tek boşluğa indi (Meta #132018)', p[0] === 'Örnek Fotokopi' && p[2] === 'Ahmet Yılmaz', p);
  t('alıcı 90… biçiminde', /^90500\d{7}$/.test(giden?.govde.to), giden?.govde.to);
  const kayit = await prisma.notificationLog.findUnique({ where: { waMessageId: r.j.mesajId } });
  t('gönderim kaydı: SENT, alıcı 90…, mesaj kimliğiyle', kayit?.status === 'SENT' && kayit.recipient === giden?.govde.to && kayit.tenantId === bayi.id, kayit);
  t('kayıtta okunur metin: [şablon] + doldurulmuş cümle', !!kayit?.message.startsWith(`[${S.yeniSiparis.ad}] Yeni sipariş geldi. Mağaza: Örnek Fotokopi.`), kayit?.message);

  console.log('\nCevap yönlendirme (mağaza alıcısı servis müşterisi değil)');
  const son10 = String(giden?.govde.to).slice(-10);
  const bayiler = await numaraninBayileri(son10);
  t('numaraya yazan bayi aday listesinde', bayiler.some((b) => b.id === bayi.id), bayiler);
  t('demo bayi aday listesinde değil', !bayiler.some((b) => b.id === demo.id));

  console.log('\nMeta durum bildirimi kayda işleniyor');
  const durumGovdesi = (id: string, durum: string, hata?: { code: number; title: string }) => ({
    entry: [{ changes: [{ value: { metadata: { phone_number_id: PLATFORM }, statuses: [{ id, status: durum, timestamp: String(Math.floor(Date.now() / 1000)), ...(hata ? { errors: [hata] } : {}) }] } }] }],
  });
  for (const d of parseStatuses(durumGovdesi(r.j.mesajId, 'delivered'))) await durumIsle(d);
  for (const d of parseStatuses(durumGovdesi(r.j.mesajId, 'read'))) await durumIsle(d);
  const okunmus = await prisma.notificationLog.findUnique({ where: { waMessageId: r.j.mesajId } });
  t('teslim ve okundu zamanı yazıldı', !!okunmus?.teslimAt && !!okunmus?.okunduAt, okunmus);

  // İkinci gönderim Meta'da sonradan düşüyor (#131047 benzeri).
  const r2 = await json(await post({ tenantId: bayi.id, telefon: TEL, sablon: S.kargoda.ad, parametreler: ['A', 'B', 'NM-1', 'Yurtiçi Kargo', 'https://x'] }));
  for (const d of parseStatuses(durumGovdesi(r2.j.mesajId, 'failed', { code: 131026, title: 'Message undeliverable' }))) await durumIsle(d);
  const dusen = await prisma.notificationLog.findUnique({ where: { waMessageId: r2.j.mesajId } });
  t('sonradan iletilemedi → FAILED + okunur Türkçe sebep', dusen?.status === 'FAILED' && /iletilemedi/i.test(dusen.error ?? ''), dusen);

  console.log('\nMeta reddederse');
  hataModu = { kod: 132001, mesaj: 'Template name does not exist in the translation' };
  r = await json(await post({ tenantId: bayi.id, telefon: TEL, sablon: S.stokGeldi.ad, parametreler: ['A', 'B', 'https://x'] }));
  hataModu = null;
  t('Meta 132001 → 502, sebep Türkçe (şablon onaylı değil)', r.durum === 502 && /onaylanmadı|yok/.test(r.j.error ?? ''), r);
  const redKaydi = await prisma.notificationLog.findFirst({ where: { tenantId: bayi.id, status: 'FAILED', waMessageId: null }, orderBy: { createdAt: 'desc' } });
  t('reddedilen gönderim de kayıtta (FAILED, kimliksiz)', !!redKaydi && /132001/.test(redKaydi.error ?? ''), redKaydi);

  console.log('\nGeriye uyum: eski mağaza sürümü serbest metin yolluyor');
  r = await json(await post({ tenantId: bayi.id, telefon: TEL, metin: 'YENİ SİPARİŞ NM-9\n\nOnaylamak için paneli açın.' }));
  const metinGiden = meta[meta.length - 1];
  t('metin → type text (pencere açıksa gider)', r.durum === 200 && metinGiden.govde.type === 'text', metinGiden.govde);

  console.log('\nDUR');
  await prisma.whatsAppRet.create({ data: { tenantId: bayi.id, son10 } });
  const dOnce = meta.length;
  r = await json(await post({ tenantId: bayi.id, telefon: TEL, sablon: S.siparisAlindi.ad, parametreler: ['A', 'B', 'NM-1', '10,00', 'https://x'] }));
  t('DUR yazmış alıcı → 409 RET, Meta’ya gitmedi', r.durum === 409 && r.j.kod === 'RET' && meta.length === dOnce, r);
  await prisma.whatsAppRet.deleteMany({ where: { tenantId: bayi.id } });

  console.log('\nGünlük sınır');
  const mevcut = await prisma.notificationLog.count({ where: { tenantId: bayi.id, recipient: giden.govde.to } });
  for (let i = mevcut; i < 10; i++)
    await prisma.notificationLog.create({ data: { tenantId: bayi.id, channel: 'WHATSAPP', status: 'SENT', recipient: giden.govde.to, message: 'doldurma' } });
  const sOnce = meta.length;
  r = await json(await post({ tenantId: bayi.id, telefon: TEL, sablon: S.siparisAlindi.ad, parametreler: ['A', 'B', 'NM-1', '10,00', 'https://x'] }));
  t('aynı numaraya 24 saatte 10 → 429, Meta’ya gitmedi', r.durum === 429 && r.j.kod === 'SINIR' && meta.length === sOnce, r);

  console.log('\nPanel özeti (GET)');
  const get = (q: string, yetki = true) =>
    uc.GET(new Request(`http://x/api/shop/bildirim${q}`, { headers: yetki ? { authorization: `Bearer ${JETON}` } : {} }));
  t('GET anahtarsız → 401', (await get(`?tenantId=${bayi.id}`, false)).status === 401);
  t('GET tenantId’siz → 400', (await get('')).status === 400);
  let o = await json(await get(`?tenantId=${bayi.id}`));
  t('sayılar: gönderilen, teslim 1, okundu 1, başarısız ≥2', o.j.gonderilen >= 3 && o.j.teslim === 1 && o.j.okundu === 1 && o.j.basarisiz >= 2, o.j);
  t('son hatalarda numara maskeli', o.j.sonHatalar.length > 0 && o.j.sonHatalar.every((h: any) => /\*\*\*/.test(h.alici) && !h.alici.includes(son10)), o.j.sonHatalar);
  t('WABA yokken şablon durumu bilinmiyor (null)', o.j.sablonlar === null, o.j.sablonlar);
  process.env.WHATSAPP_WABA_ID = 'waba-test';
  o = await json(await get(`?tenantId=${bayi.id}`));
  t('WABA varken yalnız mağaza şablonları, yalnız tr', o.j.sablonlar?.magaza_yeni_siparis === 'APPROVED' && o.j.sablonlar?.magaza_siparis_alindi === 'PENDING' && !('borc_hatirlatma' in o.j.sablonlar) && !('magaza_siparis_kargoda' in o.j.sablonlar), o.j.sablonlar);
  delete process.env.WHATSAPP_WABA_ID;
} catch (e) {
  t('beklenmeyen hata', false, (e as Error).stack);
} finally {
  await temizle();
  const kalan = await prisma.notificationLog.count({ where: { tenantId: { in: [bayi.id, demo.id] } } });
  t('temizlik: test bayileri ve kayıtları silindi', kalan === 0, kalan);
  sahte.close();
  await prisma.$disconnect();
}
bitir(kaldi ? 1 : 0);
