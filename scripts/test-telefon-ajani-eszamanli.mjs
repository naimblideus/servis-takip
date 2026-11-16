// TELEFON AJANI — gerçek veritabanında: tek fiş, kapalı ajan, IDOR, WhatsApp
// Çalıştır:  node scripts/test-telefon-ajani-eszamanli.mjs   (yerel DATABASE_URL ister; yoksa ATLANDI)
//
// NEDEN BU TEST
// Saf testler kuralı denetler; bu test kuralın veritabanında gerçekten
// tuttuğunu. Bayinin iki çalışanı aynı taslağa aynı anda "Fişe çevir"
// derse ya da biri onaylarken öteki reddederse İKİNCİ FİŞ AÇILMAMALI;
// Retell aynı aracı aynı çağrıda iki kez çağırırsa İKİNCİ TASLAK açılmamalı;
// fiş başka bir müşterinin numarasından sorulursa cevap "bulunamadı"
// cevabıyla BAYT BAYT AYNI olmalı. Bunların hiçbiri tek istekli denemede görünmez.
//
// Kendi bayisini açar, sonunda siler (slug: telefon-ajani-test-…). Veriye dokunduğu
// tek yer o bayi. Göç (AjanTaslagi tablosu) uygulanmamışsa ATLANDI der.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire, registerHooks } from 'node:module';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(KOK, 'src');
const require = createRequire(join(KOK, 'package.json'));

function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const url = veritabaniUrl();
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.log('ATLANDI: yerel DATABASE_URL yok (canlı veritabanında koşmaz)');
  process.exit(0);
}
process.env.DATABASE_URL = url;

const ts = require('typescript');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

// ── TS yükleyici: @/ yolları + gerçek Prisma istemcisi ──────────────────
const g = mkdtempSync(join(tmpdir(), 'st-ajan-esz-'));
const taklit = (ad, kod) => { const y = join(g, ad); writeFileSync(y, kod); return pathToFileURL(y).href; };
const istemciYolu = join(KOK, 'node_modules/@prisma/client/index.js');
const TAKLIT = {
  '@/lib/prisma': taklit('prisma.mjs',
    `import { createRequire } from 'node:module';\nconst r = createRequire(${JSON.stringify(join(KOK, 'package.json'))});\n` +
    `const { PrismaClient } = r(${JSON.stringify(istemciYolu)});\nexport const prisma = (globalThis.__ajanPrisma ??= new PrismaClient());\n`),
  '@prisma/client': taklit('prisma-client.mjs',
    `import { createRequire } from 'node:module';\nconst r = createRequire(${JSON.stringify(join(KOK, 'package.json'))});\n` +
    `const m = r(${JSON.stringify(istemciYolu)});\nexport const Prisma = m.Prisma;\nexport const PrismaClient = m.PrismaClient;\nexport default m;\n`),
};
const tsDosyasi = (hedef) => {
  for (const a of [hedef, `${hedef}.ts`, `${hedef}.tsx`, join(hedef, 'index.ts')]) {
    if (existsSync(a) && statSync(a).isFile()) return a;
  }
  return null;
};
registerHooks({
  resolve(spec, ctx, next) {
    if (TAKLIT[spec]) return { url: TAKLIT[spec], shortCircuit: true };
    let hedef = null;
    if (spec.startsWith('@/')) hedef = join(SRC, spec.slice(2));
    else if (/^\.\.?\//.test(spec) && /\.tsx?$/.test(ctx.parentURL ?? '')) hedef = join(dirname(fileURLToPath(ctx.parentURL)), spec);
    const dosya = hedef && tsDosyasi(hedef);
    if (dosya) return { url: pathToFileURL(dosya).href, shortCircuit: true };
    return next(spec, ctx);
  },
  load(u, ctx, next) {
    if (u.startsWith('file:') && /\.tsx?$/.test(u)) {
      const yol = fileURLToPath(u);
      const { outputText } = ts.transpileModule(readFileSync(yol, 'utf8'), {
        fileName: yol,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      });
      return { format: 'module', source: outputText, shortCircuit: true };
    }
    return next(u, ctx);
  },
});

const { prisma: p } = await import(TAKLIT['@/lib/prisma']);
const tablo = await p.$queryRaw`SELECT to_regclass('"AjanTaslagi"')::text AS t`.catch(() => [{ t: null }]);
if (!tablo[0]?.t) {
  console.log('ATLANDI: AjanTaslagi tablosu yok — göç uygulanmamış');
  await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
  process.exit(0);
}
const V = await import(pathToFileURL(join(SRC, 'lib/telefon-ajani-veri.ts')).href);

const ON_EK = 'telefon-ajani-test-';
await p.tenant.deleteMany({ where: { slug: { startsWith: ON_EK } } });
const damga = Date.now();
const son8 = String(damga).slice(-8);
const bayi = await p.tenant.create({ data: { name: 'Ajan Test Bayi', slug: `${ON_EK}${damga}` } });
const tenantId = bayi.id;

try {
  const yonetici = await p.user.create({ data: { tenantId, email: `ajan.yonetici.${damga}@ornek.local`, passwordHash: 'x', name: 'Ajan Yonetici', role: 'ADMIN' } });
  const teknisyen = await p.user.create({ data: { tenantId, email: `ajan.teknisyen.${damga}@ornek.local`, passwordHash: 'x', name: 'Ajan Teknisyen', role: 'TECHNICIAN' } });
  const s10 = `53${son8}`;
  const musteri = await p.customer.create({ data: { tenantId, name: 'Ajan Test Musteri', phone: `0${s10.slice(0, 3)} ${s10.slice(3, 6)} ${s10.slice(6)}`, district: 'Kadikoy' } });
  const baska = await p.customer.create({ data: { tenantId, name: 'Baska Musteri', phone: `054${son8}` } });
  const cihaz = await p.device.create({ data: { tenantId, customerId: musteri.id, brand: 'Kyocera', model: 'TASKalfa 2554ci', serialNo: `AJN-${damga}-1`, publicCode: `AJN-${damga}-1`, qrTokenHash: `ajn-${damga}-1` } });
  const baskaCihaz = await p.device.create({ data: { tenantId, customerId: baska.id, brand: 'HP', model: 'LaserJet M404', serialNo: `AJN-${damga}-2`, publicCode: `AJN-${damga}-2`, qrTokenHash: `ajn-${damga}-2` } });
  const hat = `90850${son8.slice(-7)}`;
  await p.telefonAjani.create({ data: { tenantId, acik: true, retellAgentId: `ajan-test-${damga}`, retellAktarmaAgentId: `aktar-test-${damga}`, hatNumarasi: hat, aktarmaTelefonu: '+905320000000' } });

  // ── Kiracı ──────────────────────────────────────────────────────────
  console.log('\nKiracı');
  const k = await V.aracKiracisi(`ajan-test-${damga}`);
  t('ajan kimliğinden bayi bulunur', k?.tenantId === tenantId && k?.acik === true, k);
  t('★ bilinmeyen ajan kimliği → kimse', (await V.aracKiracisi(`yok-${damga}`)) === null && (await V.aracKiracisi(null)) === null);

  // ── Aynı çağrıda iki taslak_ac → TEK taslak ─────────────────────────
  console.log('\nAynı çağrı, iki taslak isteği');
  const b = (callId, x = {}) => ({ tenantId, callId, arayanSon10: s10, acik: true, ...x });
  const c1 = `call-${damga}-1`;
  const [r1, r2] = await Promise.all([
    V.aracCalistir(b(c1), 'taslak_ac', { ariza: 'Kağıt sıkışıyor', model: 'Kyocera 2554ci' }),
    V.aracCalistir(b(c1), 'taslak_ac', { ariza: 'ekranda C6000 yazıyor', seri_no: `AJN-${damga}-1`, acil: true }),
  ]);
  const taslaklar1 = await p.ajanTaslagi.findMany({ where: { tenantId, kaynakKimlik: c1 } });
  t('★ aynı çağrıda iki istek → TEK taslak', taslaklar1.length === 1, taslaklar1.length);
  const ts1 = taslaklar1[0];
  t('iki cevap da "aldım" der (model susmaz)', r1.ok && r2.ok && /aldım/.test(r1.soyle) && /aldım/.test(r2.soyle), [r1, r2]);
  t('müşteri numaradan, cihaz söylenenden; iki arıza birleşti, acil kaldı',
    ts1?.customerId === musteri.id && ts1?.deviceId === cihaz.id && /Kağıt/.test(ts1?.arizaMetni) && /C6000/.test(ts1?.arizaMetni) && ts1?.acil === true, ts1);

  // ── Fiş durumu: IDOR ve bayt bayt aynı cevap ────────────────────────
  console.log('\nFiş durumu (IDOR)');
  const no1 = 900000 + Number(son8.slice(-4));
  const no2 = no1 + 1;
  await p.serviceTicket.create({ data: { tenantId, deviceId: baskaCihaz.id, customerId: baska.id, ticketNumber: `SF-${no1}`, issueText: 'baskasinin', createdByUserId: yonetici.id } });
  await p.serviceTicket.create({ data: { tenantId, deviceId: cihaz.id, customerId: musteri.id, ticketNumber: `SF-${no2}`, issueText: 'kendi', status: 'IN_SERVICE', createdByUserId: yonetici.id } });
  const kendi = await V.aracCalistir(b(`call-${damga}-f1`), 'fis_durumu', { fis_no: `SF-${no2}` });
  const baskasinin = await V.aracCalistir(b(`call-${damga}-f2`), 'fis_durumu', { fis_no: `SF-${no1}` });
  const olmayan = await V.aracCalistir(b(`call-${damga}-f3`), 'fis_durumu', { fis_no: 'SF-1' });
  const taninmayan = await V.aracCalistir(b(`call-${damga}-f4`, { arayanSon10: '' }), 'fis_durumu', { fis_no: `SF-${no2}` });
  t('kendi fişi: numara + durum, marka/model YOK', kendi.soyle === `SF-${no2} numaralı kaydınızın durumu: serviste, üzerinde çalışılıyor.` && !/Kyocera/.test(kendi.soyle), kendi);
  t('★ başkasının fişi = olmayan fiş = tanınmayan arayan (BAYT BAYT)',
    JSON.stringify(baskasinin) === JSON.stringify(olmayan) && JSON.stringify(olmayan) === JSON.stringify(taninmayan), [baskasinin, olmayan, taninmayan]);
  const sinir = [];
  for (let i = 0; i < 4; i++) sinir.push(await V.aracCalistir(b(`call-${damga}-f5`), 'fis_durumu', { fis_no: `SF-${no2}` }));
  t('★ bir çağrıda 4. sorgu kendi fişine bile nötr döner (tahmin sınırı)', sinir.slice(0, 3).every((x) => x.soyle.includes(`SF-${no2}`)) && sinir[3].soyle === olmayan.soyle);

  // ── Aynı taslağa aynı anda iki onay → TEK fiş ───────────────────────
  console.log('\nAynı anda iki onay');
  const fisOnce = await p.serviceTicket.count({ where: { tenantId } });
  const iki = await Promise.allSettled([
    // İkisi de aynı teknisyeni atar: hangisi kazanırsa kazansın aşağıdaki öneri testi aynı geçmişi görür.
    V.taslakOnayla(tenantId, ts1.id, yonetici, { deviceId: cihaz.id, assignedUserId: teknisyen.id }),
    V.taslakOnayla(tenantId, ts1.id, yonetici, { deviceId: cihaz.id, assignedUserId: teknisyen.id }),
  ]);
  const fisSonra = await p.serviceTicket.count({ where: { tenantId } });
  t('★ iki onaydan yalnız biri geçer', iki.filter((x) => x.status === 'fulfilled').length === 1, iki.map((x) => x.status));
  t('öteki "zaten karar verilmiş" der', iki.some((x) => x.status === 'rejected' && x.reason?.kod === 'TASLAK_ZATEN_ISLENDI'), iki.map((x) => x.reason?.kod ?? x.reason?.message));
  t('★ tam BİR fiş açıldı', fisSonra - fisOnce === 1, fisSonra - fisOnce);
  const ts1Son = await p.ajanTaslagi.findUnique({ where: { id: ts1.id } });
  const acilan = await p.serviceTicket.findUnique({ where: { id: ts1Son.ticketId ?? '' } });
  t('taslak ONAYLANDI (yol TASLAK), fiş taslağa bağlı', ts1Son.durum === 'ONAYLANDI' && ts1Son.kapanisYolu === 'TASLAK' && Boolean(acilan));
  t('acil taslak HIGH öncelikle açılır; fiş notu ajanı söyler', acilan?.priority === 'HIGH' && /Telefon ajanı/.test(acilan?.notes ?? ''), acilan?.priority);
  t('fiş aşama geçmişi yazıldı', (await p.ticketStatusHistory.count({ where: { ticketId: acilan?.id ?? '' } })) === 1);

  // ── Onay ve ret aynı anda ───────────────────────────────────────────
  console.log('\nOnay ve ret aynı anda');
  const c2 = `call-${damga}-2`;
  await V.aracCalistir(b(c2), 'taslak_ac', { ariza: 'Toner bitti' });
  const ts2 = await p.ajanTaslagi.findFirst({ where: { tenantId, kaynakKimlik: c2 } });
  const once2 = await p.serviceTicket.count({ where: { tenantId } });
  const yaris = await Promise.allSettled([
    V.taslakOnayla(tenantId, ts2.id, yonetici, { deviceId: cihaz.id }),
    V.taslakReddet(tenantId, ts2.id, yonetici, 'yanlis numara'),
  ]);
  const ts2Son = await p.ajanTaslagi.findUnique({ where: { id: ts2.id } });
  const fark2 = (await p.serviceTicket.count({ where: { tenantId } })) - once2;
  t('★ onay ve retten yalnız biri geçer', yaris.filter((x) => x.status === 'fulfilled').length === 1, yaris.map((x) => x.status));
  t('★ sonuç tutarlı: onaylandıysa 1 fiş, reddedildiyse 0', (ts2Son.durum === 'ONAYLANDI' && fark2 === 1 && ts2Son.ticketId) || (ts2Son.durum === 'REDDEDILDI' && fark2 === 0 && !ts2Son.ticketId), { durum: ts2Son.durum, fark2 });

  // ── Kapalı ajan ─────────────────────────────────────────────────────
  console.log('\nKapalı ajan');
  await p.telefonAjani.update({ where: { tenantId }, data: { acik: false } });
  const k2 = await V.aracKiracisi(`ajan-test-${damga}`);
  t('kapalı ajan kiracıda kapalı görünür', k2?.acik === false);
  const c3 = `call-${damga}-3`;
  const kapaliCevap = await V.aracCalistir(b(c3, { acik: false }), 'taslak_ac', { ariza: 'bozuk' });
  t('★ kapalı ajan aktarır ve TASLAK AÇMAZ', kapaliCevap.devret === true && (await p.ajanTaslagi.count({ where: { tenantId, kaynakKimlik: c3 } })) === 0);
  t('★ kapalıyken gelen arama aktarma ajanına', JSON.stringify(await V.gelenAramaKarari(`+${hat}`)) === JSON.stringify({ call_inbound: { override_agent_id: `aktar-test-${damga}` } }));
  await p.telefonAjani.update({ where: { tenantId }, data: { acik: true } });
  t('açıkken asıl ajana', JSON.stringify(await V.gelenAramaKarari(`+${hat}`)) === JSON.stringify({ call_inbound: { override_agent_id: `ajan-test-${damga}` } }));
  t('tanınmayan hat → numaranın varsayılanı', JSON.stringify(await V.gelenAramaKarari('+908500000001')) === JSON.stringify({ call_inbound: {} }));

  // ── WhatsApp ────────────────────────────────────────────────────────
  console.log('\nWhatsApp');
  const wa = (waMessageId, metin, fromPhone = `90${s10}`) => V.waAjanIsle({
    tenantId, tenantAdi: bayi.name, waMessageId, fromPhone, metin, customerId: musteri.id, oneri: null, platformNumarasina: false,
  });
  const w1 = `wamid-${damga}-1`, w2 = `wamid-${damga}-2`;
  for (const [id, metin] of [[w1, 'yazıcı kağıt sıkıştırıyor, çalışmıyor'], [w2, 'acil lütfen, arıza devam ediyor']]) {
    await p.whatsAppMessage.create({ data: { tenantId, customerId: musteri.id, waMessageId: id, fromPhone: `90${s10}`, text: metin, receivedAt: new Date(), isFaultReport: true } });
  }
  const a1 = await wa(w1, 'yazıcı kağıt sıkıştırıyor, çalışmıyor');
  const a2 = await wa(w2, 'acil lütfen, arıza devam ediyor');
  const waT = await p.ajanTaslagi.findMany({ where: { tenantId, kanal: 'WHATSAPP' } });
  t('arıza mesajı taslak açar; ikinci mesaj aynı taslağa eklenir', a1.islem === 'TASLAK_AC' && a2.islem === 'TASLAK_EKLE' && waT.length === 1 && waT[0].mesajKimlikleri.length === 2, [a1, a2, waT.length]);
  t('tek cihazlı müşteride cihaz otomatik', waT[0]?.deviceId === cihaz.id && waT[0]?.cihazNeden === 'TEK_CIHAZ');
  t('WhatsApp ayarlı değil / platform numarası değil → cevap gitmez (yine de taslak açıldı)', a1.cevaplandi === false);
  const yabanci = await wa(`wamid-${damga}-3`, 'yazıcı çalışmıyor', '905009999999');
  t('★ tanınmayan numara → ne cevap ne taslak', yabanci.islem === 'YOK' && (await p.ajanTaslagi.count({ where: { tenantId, kanal: 'WHATSAPP' } })) === 1);

  // Bayi fişi mesajdan açtı (gelen kutusu); sonra biri taslağı da onaylamaya çalışıyor.
  // SF- dizisinin dışında bir numara: onayların aldığı sıradaki numarayla çakışmasın.
  const inboxFis = await p.serviceTicket.create({ data: { tenantId, deviceId: cihaz.id, customerId: musteri.id, ticketNumber: `MSJ-${damga}`, issueText: 'mesajdan', createdByUserId: yonetici.id } });
  await p.whatsAppMessage.update({ where: { waMessageId: w2 }, data: { ticketId: inboxFis.id, handled: true } });
  const once3 = await p.serviceTicket.count({ where: { tenantId } });
  let hata3 = null;
  try { await V.taslakOnayla(tenantId, waT[0].id, yonetici, { deviceId: cihaz.id }); } catch (e) { hata3 = e; }
  t('★ mesajdan fiş açılmışsa taslak onayı İKİNCİ FİŞ AÇMAZ', hata3?.kod === 'BU_MESAJDAN_ZATEN_FIS_ACILMIS' && (await p.serviceTicket.count({ where: { tenantId } })) === once3, hata3?.kod ?? hata3?.message);
  t('geri alınan onay taslağı bozmaz (hâlâ bekliyor)', (await p.ajanTaslagi.findUnique({ where: { id: waT[0].id } })).durum === 'BEKLIYOR');
  await V.taslagiFisleKapat(tenantId, w2, inboxFis.id, yonetici.id);
  const waSon = await p.ajanTaslagi.findUnique({ where: { id: waT[0].id } });
  t('mesajdan açılan fiş taslağı kapatır (yol MESAJ)', waSon.durum === 'ONAYLANDI' && waSon.kapanisYolu === 'MESAJ' && waSon.ticketId === inboxFis.id);

  // ── Teknisyen önerisi: istenince, bir kez ───────────────────────────
  console.log('\nTeknisyen önerisi');
  const c4 = `call-${damga}-4`;
  await V.aracCalistir(b(c4), 'taslak_ac', { ariza: 'kağıt sıkışıyor', model: '2554ci' });
  const ts4 = await p.ajanTaslagi.findFirst({ where: { tenantId, kaynakKimlik: c4 } });
  t('liste/araç yolunda öneri hesaplanmaz', ts4.oneriAt === null);
  const ay = await V.taslakAyrintisi(tenantId, ts4.id);
  // Teknisyen yukarıdaki onayda Kadıköy'deki Kyocera fişini aldı: bölge ve marka geçmişi 1.
  const v4 = ay?.oneri?.veri;
  t('★ panel açılınca öneri: bölge ve marka geçmişi sayılıyor (ilçe + marka sorguları çalışıyor)',
    ay?.oneri?.teknisyenId === teknisyen.id && v4?.gecmisYok === false && v4?.bolgeIs >= 1 && v4?.markaIs >= 1, ay?.oneri);
  const oneriAt = (await p.ajanTaslagi.findUnique({ where: { id: ts4.id } })).oneriAt;
  await V.taslakAyrintisi(tenantId, ts4.id);
  t('ikinci açılışta yeniden hesaplanmaz', (await p.ajanTaslagi.findUnique({ where: { id: ts4.id } })).oneriAt?.getTime() === oneriAt?.getTime() && oneriAt !== null);
  t('★ başka bayinin kimliğiyle taslak görülmez', (await V.taslakAyrintisi('baska-bayi', ts4.id)) === null);
  let hata5 = null;
  try { await V.taslakOnayla(tenantId, ts4.id, yonetici, { deviceId: baskaCihaz.id, assignedUserId: 'yok-boyle-kullanici' }); } catch (e) { hata5 = e; }
  t('★ geçersiz atanan kişiye fiş açılmaz', hata5?.kod === 'ATANAN_KISI_GECERSIZ', hata5?.kod ?? hata5?.message);

  // ── Sayaç ───────────────────────────────────────────────────────────
  console.log('\nSayaç');
  const sy = await V.taslakSayaci(tenantId);
  const gercek = await p.ajanTaslagi.count({ where: { tenantId } });
  t('★ sayaç: açılan = bütün taslaklar; mesajdan onay ayrı sayılır', sy.toplam.acilan === gercek && sy.toplam.mesajdan === 1 && sy.buAy.acilan === gercek, sy);
  t('sayaç toplamı tutarlı', sy.toplam.onaylanan + sy.toplam.reddedilen + sy.toplam.bekleyen === sy.toplam.acilan, sy.toplam);
} finally {
  await p.tenant.delete({ where: { id: tenantId } }).catch((e) => console.log('  ! temizlik:', e.message));
  await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
