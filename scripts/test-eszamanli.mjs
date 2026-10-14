// EŞZAMANLI İŞLEMLER — aynı anda "Bu Dönemi Faturala", aynı anda "Fiş Aç"
// Çalıştır:  node scripts/test-eszamanli.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// İki hata da tek kişiyle denerken HİÇ görünmüyordu, ikisi de çok kişiyle
// (iki sekme, iki yönetici, herkese açık demo) kendiliğinden çıkıyordu:
//   1. Faturalama aynı anda 3 kez basılınca her biri "14 fatura" dedi, dönemde
//      42 fatura oluştu: her müşteriye kira ve aşım 3 kez kesildi. İşlemler
//      birbirinin "faturalandı" işaretini yazılmadan önce okuyordu.
//   2. Aynı bayide aynı anda açılan 8 fişin 6'sı 500 döndü ve ekranda ham
//      Prisma mesajı çıktı: numara "en büyük + 1" kilitsiz hesaplanıyordu.
// Burada gerçek kod (lib + rota) gerçek veritabanında AYNI ANDA koşturuluyor;
// fiş numarası için ayrıca iki ayrı Node süreci yarıştırılıyor (birbirinin
// belleğini görmeyen iki sunucu gibi).
//
// Kaynak .ts dosyaları derlenmeden, bellekte TypeScript'ten çevrilerek
// yükleniyor (registerHooks). Yalnız oturum (next-auth), next/server,
// next/headers ve Prisma istemcisi yerine küçük taklitler konuyor.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire, registerHooks } from 'node:module';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(KOK, 'src');
const require = createRequire(join(KOK, 'package.json'));
const ts = require('typescript');
const COCUK = process.env.ESZAMANLI_COCUK; // doluysa bu süreç "ikinci sunucu" rolünde
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');

// ── YÜKLEYİCİ ────────────────────────────────────────────────────────────
const g = mkdtempSync(join(tmpdir(), 'st-eszamanli-'));
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
const taklit = (ad, kod) => { const y = join(g, ad); writeFileSync(y, kod); return pathToFileURL(y).href; };
const TAKLIT = {
  '@/lib/prisma': taklit('prisma.mjs',
    `import { PrismaClient } from ${JSON.stringify(istemci)};\n` +
    'export const prisma = (globalThis.__eszamanliPrisma ??= new PrismaClient());\n'),
  // Oturum: her istek kendi kullanıcısıyla (AsyncLocalStorage) — 8 eşzamanlı istek karışmasın.
  '@/lib/auth': taklit('auth.mjs',
    "import { AsyncLocalStorage } from 'node:async_hooks';\n" +
    'export const oturumDeposu = (globalThis.__eszamanliOturum ??= new AsyncLocalStorage());\n' +
    'export async function auth() { return oturumDeposu.getStore() ?? null; }\n'),
  'next/server': taklit('next-server.mjs',
    'export const NextResponse = { json: (b, i) => new Response(JSON.stringify(b), { status: i?.status ?? 200, headers: { "content-type": "application/json" } }) };\n'),
  'next/headers': taklit('next-headers.mjs',
    'export async function cookies() { return { get: () => undefined }; }\nexport async function headers() { return new Headers(); }\n'),
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
  load(url, ctx, next) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url)) {
      const yol = fileURLToPath(url);
      const { outputText } = ts.transpileModule(readFileSync(yol, 'utf8'), {
        fileName: yol,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      });
      return { format: 'module', source: outputText, shortCircuit: true };
    }
    return next(url, ctx);
  },
});
const al = (yol) => import(pathToFileURL(join(SRC, yol)).href);
const { prisma: p } = await import(TAKLIT['@/lib/prisma']);
const { oturumDeposu } = await import(TAKLIT['@/lib/auth']);
const fn = await al('lib/ticket-number.ts');

// ── İKİNCİ SUNUCU (alt süreç) ────────────────────────────────────────────
// Kendi belleği olan ayrı bir süreç: üst süreçle aynı anda fiş açar.
if (COCUK) {
  const { tenantId, deviceId, customerId, userId, adet, baslaAt } = JSON.parse(COCUK);
  await new Promise((r) => setTimeout(r, Math.max(0, baslaAt - Date.now())));
  let cagri = 0;
  const sonuc = await Promise.allSettled(Array.from({ length: adet }, () =>
    fn.fisNumarasiylaOlustur(tenantId, (ticketNumber) => {
      cagri++;
      return p.serviceTicket.create({
        data: { tenantId, deviceId, customerId, ticketNumber, issueText: 'eşzamanlı süreç', createdByUserId: userId },
        select: { ticketNumber: true },
      });
    })));
  console.log('SONUC ' + JSON.stringify({
    numaralar: sonuc.filter((s) => s.status === 'fulfilled').map((s) => s.value.ticketNumber),
    hatalar: sonuc.filter((s) => s.status === 'rejected').map((s) => String(s.reason?.code ?? s.reason?.message ?? s.reason)),
    cagri,
  }));
  await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
  process.exit(0);
}

// ── KAYNAK ───────────────────────────────────────────────────────────────
console.log('\nKaynak\n');
{
  const inv = oku('src/lib/invoicing.ts');
  const govde = inv.slice(inv.indexOf('export async function buildInvoiceForCustomerPeriod'));
  const ACILIS = 'prisma.$transaction(async (tx) => {';
  const ilkIfade = govde.slice(govde.indexOf(ACILIS) + ACILIS.length)
    .split('\n').map((s) => s.trim()).find((s) => s && !s.startsWith('//'));
  t('★ faturada müşteri kilidi işlemin İLK ifadesi (okumalar kilitten sonra)', /^await tx\.\$executeRaw`SELECT pg_advisory_xact_lock\(/.test(ilkIfade ?? ''), ilkIfade);
  const fis = oku('src/app/api/tickets/route.ts');
  t('★ fiş ucu ham hata mesajını istemciye göndermiyor', !/error:\s*e\.message/.test(fis));
  t('fiş ucu numarayı tekrar denemeli yoldan alıyor', /fisNumarasiylaOlustur\(/.test(fis) && !/generateTicketNumber\(/.test(fis));
  t('fiş numarası için bayinin bütün fişleri belleğe çekilmiyor', !/serviceTicket\.findMany/.test(oku('src/lib/ticket-number.ts')));
  t('toplu faturalama ikinci basışta 409 dönüyor', /FATURALAMA_SURUYOR\.has\(tenantId\)\)\s*return ucHatasi\('FATURALAMA_SURUYOR', 409\)/.test(oku('src/app/api/invoices/route.ts')));
  // Bilgi: fiş açan öteki yerler (bu testin dosya izni dışında) henüz tekrar denemesiz.
  const { readdirSync } = await import('node:fs');
  const tara = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tara(join(d, e.name)) : /\.tsx?$/.test(e.name) ? [join(d, e.name)] : []);
  const eski = tara(SRC).filter((f) => !f.endsWith('ticket-number.ts') && /generateTicketNumber\(\w/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'));
  if (eski.length) console.log(`  ⊘ bilgi: hâlâ çıplak generateTicketNumber kullanan (fisNumarasiylaOlustur'a geçmeli): ${eski.join(', ')}`);
}

// ── SAF: tekrar deneme kuralı ────────────────────────────────────────────
console.log('\nTekrar deneme\n');
{
  const cakisma = { code: 'P2002', meta: { target: ['tenantId', 'ticketNumber'] } };
  t('fiş numarası çakışması tanınıyor', fn.fisNumarasiCakismasi(cakisma) && fn.fisNumarasiCakismasi({ code: 'P2002', meta: { target: 'ServiceTicket_tenantId_ticketNumber_key' } }));
  t('başka benzersizlik hatası / başka kod çakışma sayılmıyor', !fn.fisNumarasiCakismasi({ code: 'P2002', meta: { target: ['email'] } })
    && !fn.fisNumarasiCakismasi({ code: 'P2003' }) && !fn.fisNumarasiCakismasi(new Error('x')) && !fn.fisNumarasiCakismasi(null));
}

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const yerel = /@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl());
const ON_EK = 'eszamanli-test-';

if (!yerel) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  // Önceki koşu yarıda öldüyse kalıntısını temizle.
  await p.tenant.deleteMany({ where: { slug: { startsWith: ON_EK } } });
  const damga = Date.now();
  const bayi = await p.tenant.create({ data: { name: 'Eszamanli Test', slug: `${ON_EK}${damga}`, pricePerBlack: 1, pricePerColor: 2 } });
  const bayi2 = await p.tenant.create({ data: { name: 'Eszamanli Test Numara', slug: `${ON_EK}${damga}-no` } });
  try {
    const yonetici = await p.user.create({ data: { tenantId: bayi.id, email: `eszamanli.yonetici.${damga}@ornek.local`, passwordHash: 'x', name: 'Eszamanli Yonetici', role: 'ADMIN' } });
    const teknisyen = await p.user.create({ data: { tenantId: bayi.id, email: `eszamanli.teknisyen.${damga}@ornek.local`, passwordHash: 'x', name: 'Eszamanli Teknisyen', role: 'TECHNICIAN' } });
    const oturum = (u) => ({ user: { email: u.email, tenantId: u.tenantId, id: u.id, role: u.role } });
    const istek = (u, rota, fnc, govde) => oturumDeposu.run(oturum(u), () =>
      fnc(new Request(`http://yerel/api/${rota}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(govde) })));
    const cevap = async (r) => ({ durum: r.status, govde: await r.json().catch(() => ({})) });

    let sira = 0;
    // Dönem Eylül; cihaz Ağustos'ta kurulmuş olmalı, yoksa Eylül kirası hiç kesilmez (lib/kira-donemi).
    const kurulum = async (ad) => {
      const m = await p.customer.create({ data: { tenantId: bayi.id, name: `Eszamanli Test ${ad}`, phone: `050000000${String(sira + 10)}` } });
      const cihaz = await p.device.create({ data: {
        tenantId: bayi.id, customerId: m.id, brand: 'Test', model: 'Eszamanli', serialNo: `ESZ-${damga}-${++sira}`,
        publicCode: `ESZ-${damga}-${sira}`, qrTokenHash: `esz-${damga}-${sira}`, isRental: true, monthlyRent: 1000,
        includedBlack: 0, includedColor: 0, createdAt: new Date('2026-08-01T09:00:00'),
      } });
      await p.counterReading.createMany({ data: [
        { tenantId: bayi.id, deviceId: cihaz.id, counterBlack: 1000, counterColor: 0, deltaBlack: 1000, deltaColor: 0, readingDate: new Date('2026-09-10T10:00:00') },
        { tenantId: bayi.id, deviceId: cihaz.id, counterBlack: 1500, counterColor: 0, deltaBlack: 500, deltaColor: 0, readingDate: new Date('2026-09-20T10:00:00') },
      ] });
      // Teslim edilmiş, ödenmemiş servis: işçiliği aylık faturaya girer — dönemden bağımsız.
      await p.serviceTicket.create({ data: {
        tenantId: bayi.id, customerId: m.id, deviceId: cihaz.id, ticketNumber: `ESZ-${damga}-${sira}`, issueText: 'teslim edildi',
        status: 'DELIVERED', laborCost: 300, createdByUserId: yonetici.id,
      } });
      return { m, cihaz };
    };
    const faturaOzeti = async (customerId) => {
      const faturalar = await p.customerInvoice.findMany({ where: { tenantId: bayi.id, customerId }, include: { lines: true } });
      const satir = faturalar.flatMap((f) => f.lines);
      return {
        fatura: faturalar.length,
        donemler: faturalar.map((f) => f.period).sort(),
        kira: satir.filter((l) => l.kind === 'RENTAL').length,
        sayfa: satir.filter((l) => l.kind === 'COUNTER').reduce((s, l) => s + Number(l.quantity), 0),
        iscilik: satir.filter((l) => l.kind === 'LABOR').length,
        toplam: faturalar.reduce((s, f) => s + Number(f.totalAmount), 0),
      };
    };
    const inv = await al('lib/invoicing.ts');

    console.log('\nFaturalama — aynı müşteri, aynı dönem, 3 işlem aynı anda (gerçek veritabanı)\n');
    {
      const { m, cihaz } = await kurulum('A');
      const sonuc = await Promise.all([1, 2, 3].map(() => inv.buildInvoiceForCustomerPeriod(bayi.id, m.id, '2026-09')));
      const kesilen = sonuc.filter(Boolean);
      t('★ üç işlemden yalnız biri fatura kesti, ikisi boş döndü', kesilen.length === 1 && sonuc.filter((x) => x === null).length === 2, sonuc.map((x) => x?.invoiceNumber ?? null));
      const o = await faturaOzeti(m.id);
      t('★ dönemde müşteriye TEK fatura', o.fatura === 1, o);
      t('★ kira bir kez, 1.500 sayfa bir kez, işçilik bir kez', o.kira === 1 && o.sayfa === 1500 && o.iscilik === 1, o);
      const kalan = await p.counterReading.count({ where: { deviceId: cihaz.id, billed: false } });
      const d = await p.device.findUnique({ where: { id: cihaz.id }, select: { lastInvoicedPeriod: true } });
      t('okumalar faturalandı, kira işareti Eylül', kalan === 0 && d.lastInvoicedPeriod === '2026-09', { kalan, d });
      const tekrar = await inv.buildInvoiceForCustomerPeriod(bayi.id, m.id, '2026-09');
      t('sonradan bir daha basmak da boş döner', tekrar === null);
    }

    console.log('\nFaturalama — aynı müşteri, İKİ FARKLI dönem aynı anda\n');
    {
      // Gece işi Eylül'ü keserken yönetici Ekim'e basarsa: iş emri iki faturaya girmemeli.
      const { m } = await kurulum('B');
      const sonuc = await Promise.all([
        inv.buildInvoiceForCustomerPeriod(bayi.id, m.id, '2026-09'),
        inv.buildInvoiceForCustomerPeriod(bayi.id, m.id, '2026-10'),
      ]);
      const o = await faturaOzeti(m.id);
      t('★ teslim edilen servisin işçiliği yalnız bir faturada', o.iscilik === 1, o);
      t('Eylül sayfaları yalnız Eylül faturasında', o.sayfa === 1500 && sonuc[0] !== null, o);
    }

    console.log('\nFaturalama ucu — "Bu Dönemi Faturala" 3 sekmeden aynı anda\n');
    {
      const { m } = await kurulum('C');
      const rota = await al('app/api/invoices/route.ts');
      const sonuc = await Promise.all([1, 2, 3].map(() => istek(yonetici, 'invoices', rota.POST, { period: '2026-09' }).then(cevap)));
      const tamam = sonuc.filter((r) => r.durum === 200);
      const mesgul = sonuc.filter((r) => r.durum === 409);
      t('★ biri çalıştı, ikisi "şu an çalışıyor" (409) aldı', tamam.length === 1 && mesgul.length === 2, sonuc.map((r) => r.durum));
      t('409 yanıtı çevrilmiş metin + kod taşıyor', mesgul.every((r) => r.govde.kod === 'FATURALAMA_SURUYOR' && typeof r.govde.error === 'string' && r.govde.error.length > 0), mesgul[0]?.govde);
      t('çalışan, C müşterisinin faturasını kesti (A ve B zaten kesilmişti)', tamam[0]?.govde.created === 1 && tamam[0]?.govde.errors === 0, tamam[0]?.govde);
      const o = await faturaOzeti(m.id);
      t('★ C müşterisine dönemde TEK fatura', o.fatura === 1 && o.kira === 1 && o.sayfa === 1500, o);
      const sonra = await cevap(await istek(yonetici, 'invoices', rota.POST, { period: '2026-09' }));
      t('iş bitince kilit kalkıyor: sonraki basış çalışır, 0 fatura keser', sonra.durum === 200 && sonra.govde.created === 0, sonra);
      const teknisyenle = await cevap(await istek(teknisyen, 'invoices', rota.POST, { period: '2026-09' }));
      t('teknisyen faturalayamıyor (yetki değişmedi)', teknisyenle.durum === 403, teknisyenle.durum);
    }

    console.log('\nFiş ucu — aynı bayide 8 fiş aynı anda\n');
    const rotaFis = await al('app/api/tickets/route.ts');
    const { m: fisMusteri, cihaz: fisCihaz } = await kurulum('D');
    {
      const once = await p.serviceTicket.count({ where: { tenantId: bayi.id } });
      const sonuc = await Promise.all(Array.from({ length: 8 }, (_, i) =>
        istek(yonetici, 'tickets', rotaFis.POST, { deviceId: fisCihaz.id, issueText: `eşzamanlı ${i}` }).then(cevap)));
      t('★ 8 isteğin 8i de açıldı (500 yok)', sonuc.every((r) => r.durum === 200), sonuc.map((r) => r.durum));
      const numaralar = sonuc.map((r) => r.govde.ticketNumber);
      t('★ 8 farklı numara', new Set(numaralar).size === 8, numaralar);
      const sayilar = numaralar.map((n) => Number(String(n).slice(3))).sort((a, b) => a - b);
      t('numaralar boşluksuz ardışık', sayilar.every((n, i) => i === 0 || n === sayilar[i - 1] + 1), sayilar);
      t('veritabanında 8 yeni fiş', (await p.serviceTicket.count({ where: { tenantId: bayi.id } })) === once + 8);
      t('yönetici atama seçmeden açtıysa fiş atanmamış kalır', sonuc.every((r) => r.govde.assignedUserId === null));
    }

    console.log('\nFiş ucu — teknisyenin telefondan açtığı fiş\n');
    {
      const r = await cevap(await istek(teknisyen, 'tickets', rotaFis.POST, { deviceId: fisCihaz.id, issueText: 'sahada açıldı' }));
      t('★ TECHNICIAN rolüyle açılan fiş kendisine atanıyor ("İşlerim" boş kalmıyor)', r.durum === 200 && r.govde.assignedUserId === teknisyen.id, r.govde.assignedUserId);
      const r2 = await cevap(await istek(teknisyen, 'tickets', rotaFis.POST, { deviceId: fisCihaz.id, issueText: 'başkasına', assignedUserId: yonetici.id }));
      t('teknisyen açıkça başkasını seçtiyse seçim geçerli', r2.durum === 200 && r2.govde.assignedUserId === yonetici.id, r2.govde.assignedUserId);
    }

    console.log('\nFiş ucu — beklenmeyen hata kullanıcıya ham mesaj göstermiyor\n');
    {
      // Sunucu günlüğüne düşen ayrıntıyı yakala (çıktıyı da kirletmesin).
      const gunluk = [];
      const asil = console.error;
      console.error = (...a) => { gunluk.push(a.map(String).join(' ')); };
      const r = await cevap(await istek(yonetici, 'tickets', rotaFis.POST, { deviceId: fisCihaz.id, issueText: 'x', priority: 'OLMAYAN_ONCELIK' }))
        .finally(() => { console.error = asil; });
      t('ayrıntı sunucu günlüğünde duruyor', gunluk.some((s) => s.includes('TICKET CREATE ERROR') && s.includes('priority')), gunluk.map((s) => s.slice(0, 80)));
      t('★ 500 genel metin: Prisma/alan adı sızmıyor', r.durum === 500 && r.govde.kod === 'EKLENIRKEN_HATA_OLUSTU'
        && !/prisma|invocation|serviceTicket|constraint|Invalid/i.test(JSON.stringify(r.govde)), r.govde);
      const yok = await cevap(await istek(yonetici, 'tickets', rotaFis.POST, { deviceId: 'olmayan-cihaz', issueText: 'x' }));
      t('başka/olmayan cihaz yine 404', yok.durum === 404, yok.durum);
    }

    console.log('\nFiş numarası — tekrar deneme ve geri bırakma\n');
    {
      const tenantId = bayi.id;
      const yeni = (ticketNumber, issueText = 'test') => p.serviceTicket.create({
        data: { tenantId, deviceId: fisCihaz.id, customerId: fisMusteri.id, ticketNumber, issueText, createdByUserId: yonetici.id },
        select: { ticketNumber: true },
      });
      // Başka bir sunucu, numarayı biz yazmadan hemen önce kapıyor.
      const goruldu = [];
      let rakip = null;
      const fis = await fn.fisNumarasiylaOlustur(tenantId, async (no) => {
        goruldu.push(no);
        if (!rakip) rakip = await yeni(no, 'rakip sunucu');
        return yeni(no);
      });
      t('★ numara başkasına geçince yeni numarayla yazıldı', goruldu.length === 2 && fis.ticketNumber === goruldu[1] && goruldu[1] !== goruldu[0]
        && rakip.ticketNumber === goruldu[0], { goruldu, fis, rakip });

      let deneme = 0;
      const cakisma = { code: 'P2002', meta: { target: ['tenantId', 'ticketNumber'] } };
      const hata = await fn.fisNumarasiylaOlustur(tenantId, async () => { deneme++; throw cakisma; }).catch((e) => e);
      t('sürekli çakışmada 6 denemeden sonra çakışma hatası fırlıyor (uç 409 döner)', deneme === 6 && hata === cakisma, deneme);

      const a = await fn.generateTicketNumber(tenantId);
      const bozuk = await fn.fisNumarasiylaOlustur(tenantId, async () => { throw new Error('alan eksik'); }).catch((e) => e);
      const b = await fn.generateTicketNumber(tenantId);
      const c = await fn.generateTicketNumber(tenantId);
      t('başka hata olduğu gibi fırlıyor ve numarası geri bırakılıyor (sırada boşluk yok)',
        bozuk?.message === 'alan eksik' && Number(c.slice(3)) === Number(b.slice(3)) + 1 && Number(b.slice(3)) === Number(a.slice(3)) + 1, { a, b, c });
    }

    console.log('\nFiş numarası — en büyük numara hesabı\n');
    {
      const u2 = await p.user.create({ data: { tenantId: bayi2.id, email: `eszamanli.no.${damga}@ornek.local`, passwordHash: 'x', name: 'N', role: 'ADMIN' } });
      const m2 = await p.customer.create({ data: { tenantId: bayi2.id, name: 'Eszamanli Test Numara', phone: '05000000000' } });
      const d2 = await p.device.create({ data: { tenantId: bayi2.id, customerId: m2.id, brand: 'Test', model: 'N', serialNo: `ESZN-${damga}`, publicCode: `ESZN-${damga}`, qrTokenHash: `eszn-${damga}` } });
      t('fişi olmayan bayide ilk numara SF-1', (await fn.generateTicketNumber(bayi2.id)) === 'SF-1');
      for (const no of ['TSK-4100', 'SF-7', 'X-999', 'SF-12a', 'TSK-2024-00123', 'sf-500', 'SF-0039'])
        await p.serviceTicket.create({ data: { tenantId: bayi2.id, deviceId: d2.id, customerId: m2.id, ticketNumber: no, issueText: 'n', createdByUserId: u2.id } });
      const n = await fn.generateTicketNumber(bayi2.id);
      t('★ TSK-/SF- birlikte, başka biçimler sayılmıyor: TSK-4100 → SF-4101', n === 'SF-4101', n);
      t('başka bayinin numarası karışmıyor', Number((await fn.generateTicketNumber(bayi.id)).slice(3)) < 4100);
    }

    console.log('\nFiş numarası — iki ayrı sunucu süreci aynı anda\n');
    {
      const adet = 5;
      const baslaAt = Date.now() + 2500; // iki süreç de açılıp aynı anda başlasın
      const cocuk = () => new Promise((coz) => {
        const s = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
          env: { ...process.env, ESZAMANLI_COCUK: JSON.stringify({ tenantId: bayi.id, deviceId: fisCihaz.id, customerId: fisMusteri.id, userId: yonetici.id, adet, baslaAt }) },
        });
        let cikti = '';
        s.stdout.on('data', (b) => { cikti += b; });
        s.stderr.on('data', (b) => { cikti += b; });
        s.on('close', () => {
          const satir = cikti.split(/\r?\n/).find((x) => x.startsWith('SONUC '));
          coz(satir ? JSON.parse(satir.slice(6)) : { numaralar: [], hatalar: [cikti.slice(-300)], cagri: 0 });
        });
      });
      const [s1, s2] = await Promise.all([cocuk(), cocuk()]);
      const hepsi = [...s1.numaralar, ...s2.numaralar];
      t('★ iki süreçteki 10 fişin 10u da açıldı', hepsi.length === 2 * adet && !s1.hatalar.length && !s2.hatalar.length, { s1: s1.hatalar, s2: s2.hatalar });
      t('★ 10 farklı numara', new Set(hepsi).size === hepsi.length, hepsi);
      console.log(`      (çakışıp yeniden denenen: ${s1.cagri + s2.cagri - hepsi.length})`);
    }
  } finally {
    await p.tenant.deleteMany({ where: { slug: { startsWith: ON_EK } } }).catch((e) => console.log('  ! temizlik:', e?.message));
    const kalan = await p.tenant.count({ where: { slug: { startsWith: ON_EK } } });
    t('test bayileri ve bütün verileri silindi', kalan === 0, kalan);
  }
}

await p.$disconnect();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
