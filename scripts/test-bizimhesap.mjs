// BİZİM HESAP AKTARIMI
// Çalıştır:  node scripts/test-bizimhesap.mjs
//   Saf eşleyici her zaman; sahte Bizim Hesap sunucusuyla uçtan uca akış
//   yerel DATABASE_URL varsa; HTTP kapısı geliştirme sunucusu açıksa.
//
// NEDEN BU TEST
// Muhasebe programına giden fatura geri çekilemez (yalnız iptal edilir).
// Üç hata pahalı: aynı faturanın iki kez yazılması, tutarın Nextus'takinden
// farklı yazılması, FirmID'nin (fatura yazdıran anahtar) düz metin durması.
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { randomBytes } from 'node:crypto';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-bizimhesap-'));

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

// Test anahtarı: gerçek .env'e dokunmadan, yalnız bu süreçte.
process.env.SIR_ANAHTARI = randomBytes(32).toString('hex');
process.env.BIZIMHESAP_ZAMAN_ASIMI_MS = '600';

const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
let saf, menu, veri = null;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      ...['bizimhesap', 'bizimhesap-veri', 'sir', 'menu-aileleri', 'modules'].map((f) => join(KOK, `src/lib/${f}.ts`)),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
  const duzelt = (dosya, ciftler) => {
    const yol = join(g, dosya);
    let s = readFileSync(yol, 'utf8');
    for (const [a, b] of ciftler) s = s.split(a).join(b);
    writeFileSync(yol, s, 'utf8');
  };
  duzelt('bizimhesap-veri.js', [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@/lib/sir'", "'./sir.js'"], ["'@/lib/bizimhesap'", "'./bizimhesap.js'"]]);
  duzelt('menu-aileleri.js', [["'./modules'", "'./modules.js'"]]);
  saf = await import(pathToFileURL(join(g, 'bizimhesap.js')).href);
  menu = await import(pathToFileURL(join(g, 'menu-aileleri.js')).href);
} catch (e) {
  console.log('✗ derlenemedi:', e?.message);
  rmSync(g, { recursive: true, force: true });
  process.exit(1);
}
const { bizimHesapFaturasi, cevapHatasi, bizimHesapTarihi, yerelTelefon, urunKimligi } = saf;

// ── EŞLEYİCİ ─────────────────────────────────────────────────────────────
console.log('\nBizim Hesap — eşleyici\n');
const FATURA = {
  invoiceNumber: 'SF-FAT-2026-00012', gibNo: null, period: '2026-09',
  invoiceDate: new Date('2026-09-01T09:00:00Z'), dueDate: new Date('2026-09-15T09:00:00Z'),
  vatRate: 20, subtotal: 1000, vatAmount: 200, totalAmount: 1200, notes: null,
};
const MUSTERI = {
  id: 'm1', name: 'Alfa Ofis', legalName: 'ALFA OFİS MAKİNELERİ LTD. ŞTİ.', address: 'Atatürk Cad. No:5',
  district: 'Kadıköy', city: 'İstanbul', taxOffice: 'Kadıköy', taxNo: '1234567890', email: 'a@alfa.com', phone: '0532 123 45 67',
};
const KALEMLER = [
  { id: 'l1', kind: 'RENTAL', description: 'Kyocera 2553 kira — Eylül', quantity: 1, unitPrice: 750, lineTotal: 750, vatRate: null },
  { id: 'l2', kind: 'COUNTER', description: 'S/B 2.500 sayfa × 0,10', quantity: 2500, unitPrice: 0.1, lineTotal: 250, vatRate: null },
];
{
  const r = bizimHesapFaturasi({ firmId: 'FIRM123456', fatura: FATURA, musteri: MUSTERI, kalemler: KALEMLER });
  t('eşleme başarılı', r.ok, r);
  const gv = r.govde;
  t('★ toplam Nextus faturasıyla aynı (1000 + 200 = 1200)', gv.amounts.net === 1000 && gv.amounts.tax === 200 && gv.amounts.total === 1200 && gv.amounts.currency === 'TL', gv.amounts);
  t('satış faturası (tip 3), firmId gövdede', gv.invoiceType === 3 && gv.firmId === 'FIRM123456');
  t('müşteri: ticari unvan, adres birleşik, vergi no, yerel telefon', gv.customer.title === 'ALFA OFİS MAKİNELERİ LTD. ŞTİ.'
    && gv.customer.address === 'Atatürk Cad. No:5, Kadıköy, İstanbul' && gv.customer.taxNo === '1234567890' && gv.customer.phone === '5321234567'
    && gv.customer.customerId === 'm1', gv.customer);
  t('★ kalem türüne göre sabit ürün (her fatura satırı ayrı ürün açmıyor)', gv.details[0].productId === 'NXS-KIRA' && gv.details[1].productId === 'NXS-SAYAC' && gv.details[1].note.includes('2.500'), gv.details.map((d) => d.productId));
  t('birim fiyat satır tutarından (miktar × birim = satır)', gv.details[1].unitPrice === 0.1 && gv.details[1].quantity === 2500 && gv.details[1].grossPrice === 250);
  t('tarihler Türkiye saatiyle', gv.dates.invoiceDate === '2026-09-01T12:00:00.000+03:00' && gv.dates.dueDate.endsWith('+03:00'), gv.dates);
  t('Nextus numarası belge numarası, notta dönem', gv.invoiceNo === 'SF-FAT-2026-00012' && gv.note.includes('Dönem 2026-09'), gv.note);
}
{
  const r = bizimHesapFaturasi({ firmId: 'FIRM123456', fatura: { ...FATURA, gibNo: 'NXS2026000000012' }, musteri: MUSTERI, kalemler: KALEMLER });
  t('★ e-Belge kesildiyse yasal numara (GİB no) gidiyor, Nextus numarası notta', r.ok && r.govde.invoiceNo === 'NXS2026000000012' && r.govde.note.includes('SF-FAT-2026-00012'));
}
{
  // Üç satır × 33,33 = 99,99 matrah, %20 → 20,00 KDV. Satır satır yuvarlasaydık 6,67×3 = 20,01 olurdu.
  const k = [1, 2, 3].map((i) => ({ id: `x${i}`, kind: 'LABOR', description: 'İşçilik', quantity: 1, unitPrice: 33.33, lineTotal: 33.33, vatRate: null }));
  const r = bizimHesapFaturasi({ firmId: 'FIRM123456', fatura: { ...FATURA, subtotal: 99.99, vatAmount: 20, totalAmount: 119.99 }, musteri: MUSTERI, kalemler: k });
  t('★ KDV yuvarlaması faturanınkiyle aynı (fark son satıra yazılıyor)', r.ok && r.govde.amounts.tax === 20 && r.govde.details.reduce((s, d) => s + d.tax, 0).toFixed(2) === '20.00', r.ok && r.govde.details.map((d) => d.tax));
  const karma = bizimHesapFaturasi({ firmId: 'F1234567', fatura: { ...FATURA, subtotal: 200, vatAmount: 30, totalAmount: 230 }, musteri: MUSTERI,
    kalemler: [{ id: 'a', kind: 'PART', partId: 'p9', description: 'Toner', quantity: 1, unitPrice: 100, lineTotal: 100, vatRate: 20 },
      { id: 'b', kind: 'OTHER', description: 'Kitap', quantity: 1, unitPrice: 100, lineTotal: 100, vatRate: 10 }] });
  t('farklı KDV oranları ayrı hesaplanıyor; parça kendi kimliğiyle', karma.ok && karma.govde.amounts.tax === 30 && karma.govde.details[0].productId === 'NXS-PARCA-p9' && karma.govde.details[1].taxRate === 10, karma);
}
{
  const r = bizimHesapFaturasi({ firmId: 'FIRM123456', fatura: { ...FATURA, totalAmount: 1250 }, musteri: MUSTERI, kalemler: KALEMLER });
  t('★ kalemler faturanın toplamını tutmazsa GÖNDERİLMİYOR', !r.ok && r.hata === 'TUTAR_TUTMUYOR' && r.fark === -50, r);
  t('kalemsiz fatura gönderilmiyor', bizimHesapFaturasi({ firmId: 'FIRM123456', fatura: FATURA, musteri: MUSTERI, kalemler: [] }).hata === 'SATIR_YOK');
  t('FirmID yoksa gönderilmiyor', bizimHesapFaturasi({ firmId: ' ', fatura: FATURA, musteri: MUSTERI, kalemler: KALEMLER }).hata === 'FIRMID_YOK');
  const adressiz = bizimHesapFaturasi({ firmId: 'FIRM123456', fatura: FATURA, musteri: { ...MUSTERI, legalName: null, address: null, district: null, city: null }, kalemler: KALEMLER });
  t('adressiz müşteri reddedilmesin diye "-", unvan yoksa ad', adressiz.ok && adressiz.govde.customer.address === '-' && adressiz.govde.customer.title === 'Alfa Ofis');
}
{
  t('telefon biçimleri', yerelTelefon('+90 532 123 45 67') === '5321234567' && yerelTelefon('05321234567') === '5321234567' && yerelTelefon('123') === '' && yerelTelefon(null) === '');
  t('tarih +03:00', bizimHesapTarihi(new Date('2026-12-31T22:30:00Z')) === '2027-01-01T01:30:00.000+03:00');
  t('ürün kimlikleri', urunKimligi({ kind: 'LABOR' }).id === 'NXS-ISCILIK' && urunKimligi({ kind: 'OTHER' }).id === 'NXS-HIZMET' && urunKimligi({ kind: 'PART', partId: null }).id === 'NXS-PARCA');
  t('★ cevap hatası üç biçimde okunuyor', cevapHatasi({ error: 'Hatalı para birimi', guid: '' }) === 'Hatalı para birimi'
    && cevapHatasi({ resultCode: 0, errorText: 'Error message from api.' }) === 'Error message from api.'
    && cevapHatasi({ Message: 'Token is invalid.' }) === 'Token is invalid.');
  t('başarılı cevapta hata yok', cevapHatasi({ error: '', guid: 'ABC', url: 'https://x' }) === '' && cevapHatasi({ resultCode: 1, errorText: '', data: {} }) === '');
  t('anlaşılmaz cevap hata sayılıyor', cevapHatasi(null) !== '' && cevapHatasi('metin') !== '');
}

// ── MENÜ ─────────────────────────────────────────────────────────────────
console.log('\nBizim Hesap — menü\n');
{
  const { hrefErisilir, aileBul } = menu;
  const e = (ek = {}) => ({ rol: 'ADMIN', ulke: 'TR', moduller: ['INVOICING'], whatsappKurulu: false, ...ek });
  t('★ bağlantı kurulmadan sekme görünmüyor', !hrefErisilir('/bizimhesap', e()) && !hrefErisilir('/bizimhesap', e({ bizimHesapKurulu: false })));
  t('bağlantı kurulunca yöneticiye görünüyor, Muhasebe ailesinde', hrefErisilir('/bizimhesap', e({ bizimHesapKurulu: true })) && aileBul('/bizimhesap')?.anahtar === 'muhasebe');
  t('teknisyene, yurt dışı bayiye ve faturası olmayan pakete görünmüyor', !hrefErisilir('/bizimhesap', e({ bizimHesapKurulu: true, rol: 'TECHNICIAN' }))
    && !hrefErisilir('/bizimhesap', e({ bizimHesapKurulu: true, ulke: 'DE' })) && !hrefErisilir('/bizimhesap', e({ bizimHesapKurulu: true, moduller: [] })));
}

// ── SAHTE BİZİM HESAP SUNUCUSU ──────────────────────────────────────────
// Sahte FirmID: onaltılık olmayan harfler bilerek var — sır taraması gerçek anahtar sanmasın.
const TOKEN = 'TESTFIRMA-' + '0'.repeat(22);
const alinan = [];
const sunucu = http.createServer((req, res) => {
  let govde = '';
  req.on('data', (c) => { govde += c; });
  req.on('end', () => {
    const json = govde ? JSON.parse(govde) : null;
    alinan.push({ yol: req.url, token: req.headers.token, json });
    const yaz = (o, kod = 200) => { res.writeHead(kod, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.headers.token !== TOKEN && req.url !== '/cancelinvoice') return yaz({ Message: 'Token is invalid.' }, 401);
    if (req.url === '/customers') return yaz({ resultCode: 1, errorText: '', data: { customers: [{ id: 1 }, { id: 2 }, { id: 3 }] } });
    if (req.url === '/addinvoice') {
      if (json.note.includes('YAVAS')) { setTimeout(() => yaz({ error: '', guid: 'GEC', url: '' }), 1500); return; }
      if (json.note.includes('HATALI')) return yaz({ error: 'Hatalı para birimi', guid: '', url: '' });
      return setTimeout(() => yaz({ error: '', guid: `G-${json.invoiceNo}`, url: `https://bizimhesap.com/fatura/${json.invoiceNo}`, eInvoiceNo: '' }), 80);
    }
    if (req.url === '/cancelinvoice') return yaz({ status: json.FirmId === TOKEN ? '0' : '1' });
    yaz({ error: 'bilinmeyen' }, 404);
  });
});
await new Promise((r) => sunucu.listen(0, '127.0.0.1', r));
process.env.BIZIMHESAP_API_URL = `http://127.0.0.1:${sunucu.address().port}`;

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.log('\n  ⊘ veritabanı katmanı atlandı: DATABASE_URL yerel değil');
} else {
  try { veri = await import(pathToFileURL(join(g, 'bizimhesap-veri.js')).href); }
  catch (e) { console.log('  ✗ veri katmanı derlenemedi —', e?.message); kaldi++; }
}

if (veri) {
  console.log('\nBizim Hesap — sahte sunucuyla uçtan uca\n');
  const { ayarKaydet, ayarDurumu, baglantiDene, faturaGonder, topluGonder, faturaListesi, bizimHesaptaIptal } = veri;
  const p = new PrismaClient();
  const SLUG = 'test-bizimhesap', SLUG2 = 'test-bizimhesap-2';
  try {
    for (const sl of [SLUG, SLUG2]) {
      const eski = await p.tenant.findFirst({ where: { slug: sl }, select: { id: true } });
      if (eski) await p.tenant.delete({ where: { id: eski.id } });
    }
    const bayi = (await p.tenant.create({ data: { name: 'BH Test', slug: SLUG }, select: { id: true } })).id;
    const bayi2 = (await p.tenant.create({ data: { name: 'BH Başka', slug: SLUG2 }, select: { id: true } })).id;
    const m = (await p.customer.create({ data: { tenantId: bayi, name: 'Alfa Ofis', phone: '5321112233', address: 'Moda Cad. 1', city: 'İstanbul', taxNo: '1234567890' }, select: { id: true } })).id;
    let sira = 0;
    const fatura = async (ek = {}, tenantId = bayi, customerId = m) => (await p.customerInvoice.create({
      data: {
        tenantId, customerId, invoiceNumber: `SF-FAT-2026-7${String(++sira).padStart(4, '0')}`, period: '2026-09',
        invoiceDate: new Date('2026-09-01T09:00:00Z'), dueDate: new Date('2026-09-15T09:00:00Z'),
        subtotal: 1000, vatRate: 20, vatAmount: 200, totalAmount: 1200, status: 'OPEN', ...ek,
        lines: { create: [
          { tenantId, kind: 'RENTAL', description: 'Kira', quantity: 1, unitPrice: 750, lineTotal: 750 },
          { tenantId, kind: 'COUNTER', description: 'Sayaç', quantity: 2500, unitPrice: 0.1, lineTotal: 250 },
        ] },
      },
      select: { id: true },
    })).id;

    t('bağlantı yokken gönderilmiyor', (await faturaGonder(bayi, await fatura())).durum === 'AYAR_YOK');
    t('★ yanlış FirmID: bayiye ne yapacağını söyleyen kod (YETKI_YOK)', (await baglantiDene('YANLIS1234')).hata === 'YETKI_YOK');
    const dogru = await baglantiDene(TOKEN);
    t('doğru FirmID: bağlantı çalışıyor, müşteri sayısı okunuyor', dogru.ok && dogru.musteriSayisi === 3, dogru);
    await ayarKaydet(bayi, TOKEN);
    const saklanan = (await p.tenant.findUnique({ where: { id: bayi }, select: { bizimHesapFirmId: true } })).bizimHesapFirmId;
    t('★ FirmID veritabanında ŞİFRELİ (düz metin yok)', saklanan && !saklanan.includes(TOKEN) && saklanan.startsWith('v1.'));
    const ayar = await ayarDurumu(bayi);
    t('ayar ekranına yalnız maske dönüyor', ayar.kurulu && !JSON.stringify(ayar).includes(TOKEN) && ayar.maske, ayar);

    alinan.length = 0;
    const f1 = await fatura();
    const r1 = await faturaGonder(bayi, f1);
    const istek1 = alinan.find((x) => x.yol === '/addinvoice');
    t('★ fatura gönderildi, Bizim Hesap kimliği ve bağlantısı saklandı', r1.durum === 'GONDERILDI' && r1.url?.startsWith('https://bizimhesap.com/'), r1);
    t('istek: token başlığında, firmId gövdede, tutar 1200', istek1?.token === TOKEN && istek1.json.firmId === TOKEN && istek1.json.amounts.total === 1200 && istek1.json.details.length === 2, istek1?.json?.amounts);
    const k1 = await p.customerInvoice.findUnique({ where: { id: f1 }, select: { bizimHesapDurum: true, bizimHesapGuid: true } });
    t('faturada durum ve kimlik', k1.bizimHesapDurum === 'GONDERILDI' && k1.bizimHesapGuid?.startsWith('G-SF-FAT'), k1);
    const once = alinan.length;
    const r1b = await faturaGonder(bayi, f1);
    t('★ ikinci gönderim: ZATEN, Bizim Hesap\'a istek ATILMADI', r1b.durum === 'ZATEN' && alinan.length === once);

    const f2 = await fatura();
    alinan.length = 0;
    const [e1, e2] = await Promise.all([faturaGonder(bayi, f2), faturaGonder(bayi, f2)]);
    t('★ aynı faturaya aynı anda iki tıklama: Bizim Hesap\'a TEK istek', [e1.durum, e2.durum].sort().join() === 'GONDERILDI,ZATEN' && alinan.filter((x) => x.yol === '/addinvoice').length === 1, [e1, e2, alinan.length]);

    const f3 = await fatura({ notes: 'HATALI' });
    const r3 = await faturaGonder(bayi, f3);
    t('Bizim Hesap reddedince hata faturada saklanıyor', r3.durum === 'HATA' && r3.hata === 'Hatalı para birimi', r3);
    await p.customerInvoice.update({ where: { id: f3 }, data: { notes: null } });
    t('hata düzelince tekrar gönderilebiliyor', (await faturaGonder(bayi, f3)).durum === 'GONDERILDI');

    const f4 = await fatura({ notes: 'YAVAS' });
    const r4 = await faturaGonder(bayi, f4);
    t('★ cevap gelmezse ZAMAN_ASIMI (fatura orada oluşmuş olabilir — ekran uyarıyor)', r4.durum === 'HATA' && r4.hata === 'ZAMAN_ASIMI', r4);

    const f5 = await fatura({ totalAmount: 1300 });
    alinan.length = 0;
    const r5 = await faturaGonder(bayi, f5);
    t('★ tutarı tutmayan fatura: hata, Bizim Hesap\'a istek YOK', r5.durum === 'HATA' && r5.hata === 'TUTAR_TUTMUYOR' && alinan.length === 0, r5);

    t('taslak ve iptal fatura gönderilmiyor', (await faturaGonder(bayi, await fatura({ status: 'DRAFT' }))).durum === 'GONDERILEMEZ'
      && (await faturaGonder(bayi, await fatura({ status: 'CANCELLED' }))).durum === 'GONDERILEMEZ');
    const baskaninki = await fatura({}, bayi2, (await p.customer.create({ data: { tenantId: bayi2, name: 'X', phone: '5320000009' }, select: { id: true } })).id);
    t('★ başka bayinin faturası gönderilemiyor', (await faturaGonder(bayi, baskaninki)).durum === 'YOK');

    t('iptal: fatura Nextus\'ta iptal değilse Bizim Hesap\'ta iptal edilemiyor', (await bizimHesaptaIptal(bayi, f1)).durum === 'GONDERILEMEZ');
    await p.customerInvoice.update({ where: { id: f1 }, data: { status: 'CANCELLED' } });
    const ip = await bizimHesaptaIptal(bayi, f1);
    const iptalIstegi = alinan.find((x) => x.yol === '/cancelinvoice');
    t('★ Nextus\'ta iptal edilen fatura Bizim Hesap\'ta da iptal ediliyor', ip.durum === 'IPTAL' && iptalIstegi?.json.Guid?.startsWith('G-SF-FAT') && iptalIstegi.json.FirmId === TOKEN, { ip, iptalIstegi });

    const toplu = await topluGonder(bayi, [await fatura(), await fatura({ notes: 'HATALI' }), f2]);
    t('toplu: biri hata verse de diğerleri devam ediyor', toplu.map((x) => x.durum).join() === 'GONDERILDI,HATA,ZATEN', toplu);

    const liste = await faturaListesi(bayi, '2026-09');
    t('liste: taslak yok, durumlar ve dönemler geliyor', liste.faturalar.every((x) => x.durum !== 'DRAFT') && liste.donemler.includes('2026-09')
      && liste.faturalar.some((x) => x.bhDurum === 'IPTAL') && liste.faturalar.some((x) => x.bhHata === 'TUTAR_TUTMUYOR'), liste.faturalar.map((x) => x.bhDurum));
    t('başka bayinin listesi ayrı', (await faturaListesi(bayi2, '2026-09')).faturalar.every((x) => x.id === baskaninki));

    await ayarKaydet(bayi, null);
    t('bağlantı kaldırılınca gönderim durur', (await faturaGonder(bayi, await fatura())).durum === 'AYAR_YOK' && !(await ayarDurumu(bayi)).kurulu);
  } catch (e) {
    kaldi++;
    console.log('  ✗ veritabanı testi çöktü —', e?.message);
  } finally {
    for (const sl of [SLUG, SLUG2]) {
      const eski = await p.tenant.findFirst({ where: { slug: sl }, select: { id: true } }).catch(() => null);
      if (eski) await p.tenant.delete({ where: { id: eski.id } }).catch(() => {});
    }
    await p.$disconnect();
    const shim = await import(pathToFileURL(join(g, 'prisma-shim.js')).href);
    await shim.prisma.$disconnect();
  }
}

// ── KAYNAK VE HTTP ───────────────────────────────────────────────────────
console.log('\nBizim Hesap — bağlantılar\n');
{
  const oku = (p2) => readFileSync(join(KOK, p2), 'utf8');
  const uclar = ['src/app/api/bizimhesap/route.ts', 'src/app/api/bizimhesap/ayar/route.ts', 'src/app/api/bizimhesap/iptal/route.ts'];
  t('★ bütün uçlar yalnız yönetici', uclar.every((u) => (oku(u).match(/requireAdminUser\(\)/g) ?? []).length === (oku(u).match(/export async function/g) ?? []).length));
  t('ayar ucu kaydetmeden önce bağlantıyı deniyor', /baglantiDene\(firmId\)[\s\S]*ayarKaydet\(tenantId, firmId\)/.test(oku('src/app/api/bizimhesap/ayar/route.ts')));
  t('ayar ekranına kurulum kartı var (yalnız Türkiye)', /ulke === 'TR' && \(/.test(oku('src/app/(dashboard)/settings/page.tsx')) && /href="\/bizimhesap"/.test(oku('src/app/(dashboard)/settings/page.tsx')));
  t('menü bayrağı sunucuda FirmID\'den', /bizimHesapKurulu: Boolean\(tenant\?\.bizimHesapFirmId\)/.test(oku('src/app/(dashboard)/layout.tsx')));
}
{
  const SUNUCU = process.env.TEST_SUNUCU || 'http://localhost:3002';
  const durum = async (...a) => { const r = await fetch(...a); await r.arrayBuffer().catch(() => {}); return r.status; };
  const acik = await durum(`${SUNUCU}/api/bizimhesap`, { signal: AbortSignal.timeout(4000) }).then(() => true).catch(() => false);
  if (!acik) console.log('\n  ⊘ HTTP katmanı atlandı: sunucu kapalı');
  else {
    t('liste oturumsuz açılmıyor', (await durum(`${SUNUCU}/api/bizimhesap`)) === 401);
    t('gönderim oturumsuz açılmıyor', (await durum(`${SUNUCU}/api/bizimhesap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"ids":["x"]}' })) === 401);
    t('ayar oturumsuz açılmıyor', (await durum(`${SUNUCU}/api/bizimhesap/ayar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"firmId":"x"}' })) === 401);
  }
}

sunucu.close();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
// process.exit() değil: Windows'ta Prisma motoru kapanırken libuv onayı patlıyordu.
process.exitCode = kaldi ? 1 : 0;
