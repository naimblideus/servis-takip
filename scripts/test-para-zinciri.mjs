// PARA ZİNCİRİ — sayaç → fatura → tahsilat: sıradan bağımsız kira, eşzamanlı okuma,
// avans, beyanın korunması, taşınan cihaz, hata alan koşu.
// Çalıştır:  node scripts/test-para-zinciri.mjs   (yerel veritabanı; yoksa DB kısmı atlanır)
//
// NEDEN BU TEST
// 2026-11-10 denetiminde buradaki her senaryo yerel veritabanında YANLIŞ sonuç
// veriyordu ve hiçbir ekran söylemiyordu:
//   · Temmuz taslakta beklerken Ağustos kesilince Temmuz'un kirası kayboluyor,
//     dahil paket iki kez veriliyordu (₺4.000 yerine ₺2.500).
//   · Aynı cihaza aynı anda beş okuma 500 sayfayı 1.200 sayfa yazıyordu.
//   · ₺6.000 borca ₺10.000 ödeyen müşterinin sonraki faturası tam açık duruyordu.
//   · "Cihaz değişti" okumasındaki yazım hatasını düzeltmek yeni makinenin ömür
//     boyu sayacını o ayın kullanımı yapıyordu.
//   · Cihaz başka müşteriye taşınınca eski müşteride basılan sayfalar yenisine
//     faturalanıyordu.
//   · Koşuda hata alan müşteri bir daha denenmiyordu.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derle, KOK } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const { ice, prismaIstemci: P, temizle } = derle({
  girisler: ['src/lib/invoicing.ts', 'src/lib/readings.ts', 'src/lib/fatura-kosusu.ts', 'src/lib/period-charges.ts', 'src/lib/okuma-sahibi.ts', 'src/lib/musteri-bakiye.ts', 'src/lib/kira-donemi.ts'],
  onEk: 'st-para-zinciri-',
});
const d = await ice('lib/fatura-donemi');
const kd = await ice('lib/kira-donemi');
const { donemFaturasiHazirla, buildInvoiceForCustomerPeriod, allocatePayment } = await ice('lib/invoicing');
const { createReading, okumaDuzelt, okumaSil, okumaBeyani } = await ice('lib/readings');
const { bayiDoneminiFaturala, faturasizKalanMusteriler } = await ice('lib/fatura-kosusu');
const { bitmemisDonemler, donemKapaliMi } = await ice('lib/fatura-turu');
const { commitPeriodCharges, cariKaydiSil } = await ice('lib/period-charges');
const { cihazAyriliyor } = await ice('lib/okuma-sahibi');
const { bakiye } = await ice('lib/musteri-bakiye');

console.log('\nKİRA KURALI (saf)\n');
{
  const c = { isRental: true, monthlyRent: 1000, lastInvoicedPeriod: '2026-06', createdAt: new Date('2025-01-01T00:00:00Z') };
  const son = (p) => d.donemAraligi(p).end;
  t('tabandan sonraki dönem kesilir', kd.kiraKesilir(c, '2026-07', son('2026-07'), false));
  t('taban ve öncesi kesilmez', !kd.kiraKesilir(c, '2026-06', son('2026-06'), false) && !kd.kiraKesilir(c, '2026-05', son('2026-05'), false));
  t('★ dönemin kaydı varsa bir daha kesilmez', !kd.kiraKesilir(c, '2026-07', son('2026-07'), true));
  t('★ sıra önemsiz: Ağustos kesilmiş olsa da Temmuz kesilebilir', kd.kiraKesilir(c, '2026-07', son('2026-07'), false));
  t('cihaz dönem bittikten sonra eklendiyse kira yok', !kd.kiraKesilir({ ...c, lastInvoicedPeriod: null, createdAt: new Date('2026-08-05T00:00:00Z') }, '2026-07', son('2026-07'), false));
  t('kiralık değil / kira 0 → kesilmez', !kd.kiraKesilir({ ...c, isRental: false }, '2026-07', son('2026-07'), false) && !kd.kiraKesilir({ ...c, monthlyRent: 0 }, '2026-07', son('2026-07'), false));
  const eksik = kd.kesilmemisKiraDonemleri(c, '2026-10', new Set(['2026-08', '2026-10']), son);
  t('★ atlanan aylar görünür kalır: Temmuz ve Eylül', JSON.stringify(eksik) === JSON.stringify(['2026-07', '2026-09']), eksik);
}

console.log('\nOKUMANIN BEYANI (saf)\n');
{
  const o = { counterBlack: 10000, counterColor: 0 };
  t('saklı beyan aynen döner', okumaBeyani({ counterBlack: 480000, counterColor: 0, deltaBlack: 0, deltaColor: 0, sifirlama: 'CIHAZ_DEGISTI' }, o) === 'CIHAZ_DEGISTI');
  t('olağan okuma: fark = sayaç − önceki', okumaBeyani({ counterBlack: 10500, counterColor: 0, deltaBlack: 500, deltaColor: 0, sifirlama: null }, o) === null);
  t('★ eski kayıt: fark 0 ama sayaç değişmiş → cihaz değişti', okumaBeyani({ counterBlack: 480000, counterColor: 0, deltaBlack: 0, deltaColor: 0, sifirlama: null }, o) === 'CIHAZ_DEGISTI');
  t('★ eski kayıt: sayaç düşmüş, fark = sayaç → sayaç sıfırlandı', okumaBeyani({ counterBlack: 300, counterColor: 0, deltaBlack: 300, deltaColor: 0, sifirlama: null }, o) === 'SAYAC_SIFIRLANDI');
  t('aynı sayaç iki kez (fark 0, sayaç aynı) olağan', okumaBeyani({ counterBlack: 10000, counterColor: 0, deltaBlack: 0, deltaColor: 0, sifirlama: null }, o) === null);
  t('zincirin başında beyan yok', okumaBeyani({ counterBlack: 10000, counterColor: 0, deltaBlack: 0, deltaColor: 0, sifirlama: null }, null) === null);
}

const dbUrl = (() => { try { return readFileSync(join(KOK, '.env'), 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1] ?? ''; } catch { return process.env.DATABASE_URL ?? ''; } })();
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  const { PrismaClient } = await import(P);
  const p = new PrismaClient();
  const SLUG = 'test-para-zinciri';
  const bayiler = [];
  try {
    for (const s of [SLUG, SLUG + '-kosu']) {
      const eski = await p.tenant.findFirst({ where: { slug: s } });
      if (eski) await p.tenant.delete({ where: { id: eski.id } });
    }
    const bayi = await p.tenant.create({ data: { name: 'Para Zinciri', slug: SLUG, plan: 'professional', pricePerBlack: 0.5, pricePerColor: 2, vatRate: 20, paymentTermDays: 15 } });
    bayiler.push(bayi);
    let n = 0;
    const musteri = (ad, b = bayi) => p.customer.create({ data: { tenantId: b.id, name: ad, phone: `0500222${String(++n).padStart(4, '0')}` } });
    // Kira ₺1.000, ayda 1.000 sayfa dahil, aşım ₺0,50. Haziran ve öncesi kapalı.
    const cihaz = (m, ek = {}, b = bayi) => p.device.create({
      data: {
        tenantId: b.id, customerId: m.id, brand: 'Kyocera', model: `Z-${++n}`, serialNo: `PZ-${n}`, publicCode: `PZ-${n}-${Date.now()}`, qrTokenHash: 'x',
        createdAt: new Date('2025-01-01T00:00:00Z'), isRental: true, monthlyRent: 1000, includedBlack: 1000, pricePerBlack: 0.5, pricePerColor: 2, lastInvoicedPeriod: '2026-06', ...ek,
      },
    });
    const okuma = (c, donem, delta, ek = {}, b = bayi) => p.counterReading.create({
      data: { tenantId: b.id, deviceId: c.id, counterBlack: 10000 + delta, counterColor: 0, deltaBlack: delta, deltaColor: 0, billed: false, source: 'CIHAZ_EPOSTA', faturaDonemi: donem, readingDate: new Date(d.donemAraligi(donem).start.getTime() + 20 * 86_400_000), ...ek },
    });
    const baslangic = (c, sayac = 10000, b = bayi) => p.counterReading.create({
      data: { tenantId: b.id, deviceId: c.id, counterBlack: sayac, counterColor: 0, deltaBlack: 0, deltaColor: 0, billed: true, source: 'ELLE', readingDate: new Date(Date.now() - 40 * 86_400_000) },
    });
    const net = async (m) => Number((await p.customerInvoice.aggregate({ where: { customerId: m.id, deletedAt: null }, _sum: { subtotal: true } }))._sum.subtotal ?? 0);
    const satirlar = (m, kind) => p.invoiceLine.findMany({ where: { invoice: { customerId: m.id }, kind }, select: { quantity: true, lineTotal: true, deviceId: true, invoice: { select: { period: true } } } });

    console.log('\nSIRADAN BAĞIMSIZ KİRA VE PAKET\n');
    {
      // Temmuz şüpheli → taslak. Ağustos kesilir. Sonra Temmuz onaylanır.
      const A = await musteri('Taslak sonra'); const c = await cihaz(A);
      await okuma(c, '2026-06', 1000, { billed: true });
      await okuma(c, '2026-07', 3000, { supheli: true });
      await okuma(c, '2026-08', 3000);
      const s7 = await donemFaturasiHazirla(bayi.id, A.id, '2026-07');
      const s8 = await donemFaturasiHazirla(bayi.id, A.id, '2026-08');
      const onay = await donemFaturasiHazirla(bayi.id, A.id, '2026-07', { taslakId: s7?.taslakId });
      t('Temmuz taslakta bekledi, Ağustos kesildi', s7?.tur === 'TASLAK' && s8?.tur === 'KESILDI', { s7: s7?.tur, s8: s8?.tur });
      t('★ Temmuz onaylanınca tutar DEĞİŞMEDEN kesilir (kirası duruyor)', onay?.tur === 'KESILDI', onay?.tur);
      const kira = await satirlar(A, 'RENTAL');
      t('★ iki ayın kirası da kesildi', kira.length === 2 && new Set(kira.map((k) => k.invoice.period)).size === 2, kira.map((k) => k.invoice.period));
      t('★ iki ay için toplam ₺4.000 (2 kira + 2×1.000 sayfa aşım)', (await net(A)) === 4000, await net(A));
      const kayit = await p.kiraDonemi.findMany({ where: { deviceId: c.id }, orderBy: { period: 'asc' }, select: { period: true, kaynak: true, invoiceId: true } });
      t('kira dönem kaydı: Temmuz ve Ağustos, faturasına bağlı', kayit.length === 2 && kayit[0].period === '2026-07' && kayit.every((k) => k.kaynak === 'FATURA' && k.invoiceId), kayit);
      t('işaret ilerlemedi (taban Haziran)', (await p.device.findUnique({ where: { id: c.id }, select: { lastInvoicedPeriod: true } })).lastInvoicedPeriod === '2026-06');
      const okumalar = await p.counterReading.findMany({ where: { deviceId: c.id, faturaDonemi: { in: ['2026-07', '2026-08'] } }, select: { billed: true, faturaId: true } });
      t('okuma hangi faturanın faturaladığını taşır', okumalar.every((o) => o.billed && o.faturaId), okumalar);
    }
    {
      const B = await musteri('Sıra dışı'); const c = await cihaz(B);
      await okuma(c, '2026-06', 1000, { billed: true });
      await okuma(c, '2026-07', 3000);
      await okuma(c, '2026-08', 3000);
      await buildInvoiceForCustomerPeriod(bayi.id, B.id, '2026-08');
      await buildInvoiceForCustomerPeriod(bayi.id, B.id, '2026-07');
      t('★ önce Ağustos sonra Temmuz kesilse de toplam ₺4.000', (await net(B)) === 4000, await net(B));
      t('aynı dönem ikinci kez kesilmez', (await buildInvoiceForCustomerPeriod(bayi.id, B.id, '2026-07')) === null);
      // Eylül okunmadı, Ekim okundu: iki okuma arası iki ay → iki paket.
      await okuma(c, '2026-10', 2500);
      await buildInvoiceForCustomerPeriod(bayi.id, B.id, '2026-10');
      const ekim = (await satirlar(B, 'COUNTER')).find((x) => x.invoice.period === '2026-10');
      t('okunmayan ayın paketi sonraki okumaya taşınır (2.500 − 2.000 = 500)', Number(ekim?.quantity) === 500, ekim);
    }
    {
      // Kurulumdan ilk okumaya bir ay: bir paket (iki okuma arası kaç aysa o kadar paket).
      const E = await musteri('Yeni kurulum'); const c = await cihaz(E, { lastInvoicedPeriod: null, createdAt: new Date('2026-07-10T09:00:00Z') });
      await p.counterReading.create({ data: { tenantId: bayi.id, deviceId: c.id, counterBlack: 5000, counterColor: 0, deltaBlack: 0, deltaColor: 0, billed: true, source: 'ELLE', readingDate: new Date('2026-07-10T09:00:00Z') } });
      await buildInvoiceForCustomerPeriod(bayi.id, E.id, '2026-07');
      await okuma(c, '2026-08', 3000, { counterBlack: 8000 });
      await buildInvoiceForCustomerPeriod(bayi.id, E.id, '2026-08');
      const asim = (await satirlar(E, 'COUNTER'))[0];
      t('kurulum ayı: Temmuz + Ağustos kirası, Ağustos okumasına bir paket', (await satirlar(E, 'RENTAL')).length === 2 && Number(asim?.quantity) === 2000, asim);
    }

    console.log('\nEŞZAMANLI OKUMA\n');
    {
      const C = await musteri('Eşzamanlı'); const c = await cihaz(C);
      await baslangic(c);
      const r = await Promise.allSettled([10100, 10200, 10300, 10400, 10500].map((v) => createReading({ tenantId: bayi.id, deviceId: c.id, counterBlack: v, counterColor: 0, source: 'AG_TARAMA' })));
      const top = await p.counterReading.aggregate({ where: { deviceId: c.id, billed: false }, _sum: { deltaBlack: true } });
      const son = await p.counterReading.findFirst({ where: { deviceId: c.id }, orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }], select: { counterBlack: true } });
      // Sıraya giren okumalardan düşük gelenler "sayaç düştü" diye reddedilebilir; önemli olan toplam.
      t('★ beş eşzamanlı okuma: faturalanacak sayfa = son sayaç − başlangıç', top._sum.deltaBlack === son.counterBlack - 10000, { toplam: top._sum.deltaBlack, son: son.counterBlack, sonuc: r.map((x) => x.status) });
      const ikiz = await Promise.allSettled([1, 2].map(() => createReading({ tenantId: bayi.id, deviceId: c.id, counterBlack: 11000, counterColor: 0, source: 'CIHAZ_EPOSTA' })));
      const top2 = await p.counterReading.aggregate({ where: { deviceId: c.id, billed: false }, _sum: { deltaBlack: true } });
      t('★ aynı okuma iki kanaldan aynı anda: sayfa bir kez sayılır', top2._sum.deltaBlack === 1000, { toplam: top2._sum.deltaBlack, sonuc: ikiz.map((x) => x.status) });
      const yeni = await p.counterReading.findFirst({ where: { deviceId: c.id }, orderBy: { createdAt: 'desc' }, select: { customerId: true } });
      t('okuma, alındığı andaki müşteriyle yazılır', yeni.customerId === C.id);
    }

    console.log('\nBEYAN DÜZELTME VE SİLMEDE KORUNUR\n');
    {
      const M = await musteri('Beyan');
      // Cihaz değişti: 10.000'lik makinenin yerine 480.000 sayfalık ikinci el.
      const c1 = await cihaz(M); await baslangic(c1);
      const sw = await createReading({ tenantId: bayi.id, deviceId: c1.id, counterBlack: 480000, counterColor: 0, reset: true, resetTur: 'CIHAZ_DEGISTI' });
      t('cihaz değişti: fark 0, beyan saklandı', sw.deltaBlack === 0 && sw.reading.sifirlama === 'CIHAZ_DEGISTI', { f: sw.deltaBlack, b: sw.reading.sifirlama });
      const dz = await okumaDuzelt({ tenantId: bayi.id, deviceId: c1.id, readingId: sw.reading.id, counterBlack: 480100, counterColor: 0 });
      t('★ yazım hatası düzeltilince fark 0 kalır (eskiden 470.100 sayfa)', dz.updated.deltaBlack === 0 && dz.updated.counterBlack === 480100, { f: dz.updated.deltaBlack });
      const n3 = await createReading({ tenantId: bayi.id, deviceId: c1.id, counterBlack: 481600, counterColor: 0 });
      t('sonraki olağan okuma yeni makinenin sayacından sayar (1.500)', n3.deltaBlack === 1500, n3.deltaBlack);
      await okumaSil({ tenantId: bayi.id, deviceId: c1.id, readingId: sw.reading.id });
      const n3s = await p.counterReading.findUnique({ where: { id: n3.reading.id }, select: { deltaBlack: true, sifirlama: true } });
      t('★ beyanlı okuma silinince beyan sonrakine geçer: fark 471.600 OLMAZ', n3s.deltaBlack === 0 && n3s.sifirlama === 'CIHAZ_DEGISTI', n3s);

      // Sayaç sıfırlandı: 620.000'de sıfırlanan makine.
      const c2 = await cihaz(M); await baslangic(c2, 620000);
      const rs = await createReading({ tenantId: bayi.id, deviceId: c2.id, counterBlack: 300, counterColor: 0, reset: true, resetTur: 'SAYAC_SIFIRLANDI' });
      const r3 = await createReading({ tenantId: bayi.id, deviceId: c2.id, counterBlack: 2300, counterColor: 0 });
      t('sayaç sıfırlandı: fark = okunan (300), sonraki 2.000', rs.deltaBlack === 300 && r3.deltaBlack === 2000, { rs: rs.deltaBlack, r3: r3.deltaBlack });
      await okumaSil({ tenantId: bayi.id, deviceId: c2.id, readingId: rs.reading.id });
      const r3s = await p.counterReading.findUnique({ where: { id: r3.reading.id }, select: { deltaBlack: true } });
      t('★ sıfırlama okuması silinince sonraki 2.300 olur (eskiden 0: sayfa kayboluyordu)', r3s.deltaBlack === 2300, r3s);

      // Eski kayıt (beyan saklanmamış) + ortadaki okuma: beyan farktan çıkarılır.
      const c3 = await cihaz(M); await baslangic(c3);
      const ara = await createReading({ tenantId: bayi.id, deviceId: c3.id, counterBlack: 12000, counterColor: 0 });
      const eski = await p.counterReading.create({ data: { tenantId: bayi.id, deviceId: c3.id, counterBlack: 480000, counterColor: 0, deltaBlack: 0, deltaColor: 0, billed: false, source: 'ELLE', readingDate: new Date() } });
      await okumaDuzelt({ tenantId: bayi.id, deviceId: c3.id, readingId: ara.reading.id, counterBlack: 12500, counterColor: 0 });
      const e1 = await p.counterReading.findUnique({ where: { id: eski.id }, select: { deltaBlack: true, sifirlama: true } });
      t('★ önceki okuma düzeltilince eski "cihaz değişti" kaydının farkı 0 kalır', e1.deltaBlack === 0 && e1.sifirlama === 'CIHAZ_DEGISTI', e1);
      await okumaSil({ tenantId: bayi.id, deviceId: c3.id, readingId: ara.reading.id });
      const e2 = await p.counterReading.findUnique({ where: { id: eski.id }, select: { deltaBlack: true } });
      t('★ önceki okuma silinince de 0 kalır (eskiden 470.000)', e2.deltaBlack === 0, e2);

      // Olağan zincir: ortadaki okuma silinince sayfa kaybolmaz.
      const c4 = await cihaz(M); await baslangic(c4);
      const o1 = await createReading({ tenantId: bayi.id, deviceId: c4.id, counterBlack: 12000, counterColor: 0 });
      const o2 = await createReading({ tenantId: bayi.id, deviceId: c4.id, counterBlack: 15000, counterColor: 0 });
      await okumaSil({ tenantId: bayi.id, deviceId: c4.id, readingId: o1.reading.id });
      t('olağan zincir: ortadaki silinince sonraki 5.000 olur', (await p.counterReading.findUnique({ where: { id: o2.reading.id } })).deltaBlack === 5000);
      await p.counterReading.update({ where: { id: o2.reading.id }, data: { billed: true } });
      const red = await okumaDuzelt({ tenantId: bayi.id, deviceId: c4.id, readingId: o2.reading.id, counterBlack: 16000, counterColor: 0 }).then(() => null, (e) => e.code);
      t('faturalanmış okuma düzeltilemez', red === 'BILLED', red);
    }

    console.log('\nTAŞINAN CİHAZ\n');
    {
      const A = await musteri('Hastane A'); const B = await musteri('Klinik B');
      const c = await cihaz(A); await baslangic(c);
      // A'dayken 6.000 sayfa (Kasım). Eski kayıt gibi: okumada müşteri yok.
      const donem = d.donemOf(new Date());
      await p.counterReading.create({ data: { tenantId: bayi.id, deviceId: c.id, counterBlack: 16000, counterColor: 0, deltaBlack: 6000, deltaColor: 0, billed: false, source: 'CIHAZ_EPOSTA', faturaDonemi: donem, readingDate: new Date(Date.now() - 3 * 86_400_000) } });
      // Taşı: A'da okunan sayfalar A'da kalsın.
      await cihazAyriliyor(p, bayi.id, c.id, A.id);
      await p.device.update({ where: { id: c.id }, data: { customerId: B.id } });
      const bOk = await createReading({ tenantId: bayi.id, deviceId: c.id, counterBlack: 16800, counterColor: 0 });
      t('B\'deki okuma B ile yazıldı', bOk.reading.customerId === B.id && bOk.reading.faturaDonemi === donem, bOk.reading.faturaDonemi);
      await buildInvoiceForCustomerPeriod(bayi.id, A.id, donem);
      await buildInvoiceForCustomerPeriod(bayi.id, B.id, donem);
      const aS = await satirlar(A, 'COUNTER'); const bS = await satirlar(B, 'COUNTER');
      t('★ A\'da basılan 6.000 sayfa A\'ya faturalanır (5.000 aşım)', aS.length === 1 && Number(aS[0].quantity) === 5000, aS);
      t('★ B yalnız kendi 800 sayfasından sorumlu (paket içinde, sayaç satırı yok)', bS.length === 0, bS);
      const aK = await satirlar(A, 'RENTAL'); const bK = await satirlar(B, 'RENTAL');
      t('kira bir kez, cihazın şimdiki müşterisine', aK.length === 0 && bK.length === 1, { a: aK.length, b: bK.length });
    }

    console.log('\nAVANS\n');
    {
      const D = await musteri('Avans'); await cihaz(D, { monthlyRent: 5000, includedBlack: 0 });
      await buildInvoiceForCustomerPeriod(bayi.id, D.id, '2026-07');
      const od = await allocatePayment({ tenantId: bayi.id, customerId: D.id, amount: 10000, method: 'TRANSFER' });
      const b1 = await bakiye(bayi.id, D.id);
      t('₺6.000 borca ₺10.000: ₺4.000 artar', od.unallocated === 4000 && od.allocated === 6000, od);
      t('★ bakiyede müşteri ₺4.000 alacaklı görünür (eskiden 0)', b1.avans === 4000 && b1.toplamBorc === -4000, b1);
      await buildInvoiceForCustomerPeriod(bayi.id, D.id, '2026-08');
      const f = await p.customerInvoice.findFirst({ where: { customerId: D.id, period: '2026-08' }, select: { status: true, paidAmount: true, totalAmount: true } });
      t('★ sonraki fatura kesilir kesilmez avans düşer: 4.000/6.000, kısmi', Number(f.paidAmount) === 4000 && f.status === 'PARTIAL', f);
      const b2 = await bakiye(bayi.id, D.id);
      t('★ açık borç ₺2.000, avans 0', b2.toplamBorc === 2000 && b2.avans === 0 && b2.faturaBorc === 2000, b2);
      const gelir = await p.financialTransaction.aggregate({ where: { tenantId: bayi.id, customerId: D.id, type: 'INCOME' }, _sum: { amount: true } });
      t('gelir kaydı tahsil edilen ₺10.000 kadar', Number(gelir._sum.amount) === 10000, gelir._sum);
      const mahsup = await p.invoicePayment.aggregate({ where: { paymentId: od.paymentId }, _sum: { amount: true } });
      t('mahsup toplamı tahsilatı aşmaz', Number(mahsup._sum.amount) === 10000, mahsup._sum);
      // Vadesi geçmiş fatura kısmi ödemeyle "vadesi geçmiş" olmaktan çıkmaz.
      const G = await musteri('Gecikmiş'); await cihaz(G, { monthlyRent: 5000, includedBlack: 0 });
      const gf = await buildInvoiceForCustomerPeriod(bayi.id, G.id, '2026-07');
      await p.customerInvoice.update({ where: { id: gf.id }, data: { status: 'OVERDUE' } });
      await allocatePayment({ tenantId: bayi.id, customerId: G.id, amount: 1000, method: 'CASH' });
      t('vadesi geçmiş fatura kısmi ödemeyle vadesi geçmiş kalır', (await p.customerInvoice.findUnique({ where: { id: gf.id } })).status === 'OVERDUE');
    }

    console.log('\nCARİYE EKLENEN KALEM SİLİNİNCE GERİ AÇILIR\n');
    {
      const H = await musteri('Cari'); const c = await cihaz(H, { lastInvoicedPeriod: null }); await baslangic(c);
      const donem = d.donemOf(new Date());
      await createReading({ tenantId: bayi.id, deviceId: c.id, counterBlack: 13000, counterColor: 0 });
      const r = await commitPeriodCharges(bayi.id, H.id);
      t('cariye kira ₺1.200 + sayaç ₺1.200 yazıldı (KDV dahil)', r.rent === 1200 && r.counter === 1200 && r.added === 2, r);
      t('fatura yolu aynı dönemi bir daha kesmez', (await buildInvoiceForCustomerPeriod(bayi.id, H.id, donem)) === null);
      const kayitlar = await p.accountEntry.findMany({ where: { customerId: H.id }, select: { id: true, product: true } });
      for (const k of kayitlar) await cariKaydiSil(bayi.id, k.id);
      const acik = await p.counterReading.count({ where: { deviceId: c.id, billed: false } });
      t('★ kalem silinince okuma yeniden faturalanabilir', acik === 1 && (await p.kiraDonemi.count({ where: { deviceId: c.id } })) === 0, { acik });
      const f = await buildInvoiceForCustomerPeriod(bayi.id, H.id, donem);
      t('★ ve fatura kesilebilir: ₺2.000 + KDV', !!f && Number(f.subtotal) === 2000, f && Number(f.subtotal));
    }

    console.log('\nHATA ALAN KOŞU KAPANMAZ, YENİDEN DENENİR\n');
    {
      const b2 = await p.tenant.create({ data: { name: 'Koşu', slug: SLUG + '-kosu', plan: 'professional', pricePerBlack: 0.5, pricePerColor: 2, vatRate: 20 } });
      bayiler.push(b2);
      const iyi = await musteri('İyi', b2); await cihaz(iyi, {}, b2);
      const ikinci = await musteri('İkinci', b2); await cihaz(ikinci, {}, b2);
      // HATA ÜRET: ikinci kesilecek faturanın numarası dolu olsun. Sıra sayacı
      // 1'den başlar ve ilk fatura 00002'yi alır; 00003'ü biz tutuyoruz.
      const engel = await musteri('Engel', b2);
      const yil = d.donemOf(new Date()).slice(0, 4);
      const blok = await p.customerInvoice.create({
        data: {
          tenantId: b2.id, customerId: engel.id, invoiceNumber: `SF-FAT-${yil}-00003`, period: '2025-01',
          invoiceDate: new Date(), dueDate: new Date(), status: 'PAID', subtotal: 0, vatRate: 20, vatAmount: 0, totalAmount: 0, paidAmount: 0, source: 'AUTO_MONTHLY',
        },
      });
      const r1 = await bayiDoneminiFaturala(b2.id, '2026-07', 'CRON', 1);
      t('bir müşteri kesildi, biri hata aldı', r1.invoices === 1 && r1.errors === 1, r1);
      const tur1 = await p.faturaTuru.findUnique({ where: { tenantId_period: { tenantId: b2.id, period: '2026-07' } } });
      t('★ hata varken dönem TAMAM olmaz (HATA)', tur1.durum === 'HATA' && !r1.kapandi && !(await donemKapaliMi(b2.id, '2026-07')), tur1.durum);
      t('★ gece işinin yeniden deneyeceği dönemler arasında', (await bitmemisDonemler(b2.id, '2026-09')).includes('2026-07'));
      await p.customerInvoice.delete({ where: { id: blok.id } });
      const r2 = await bayiDoneminiFaturala(b2.id, '2026-07', 'CRON', 1);
      t('★ yeniden denemede yalnız kalan müşteri kesilir', r2.invoices === 1 && r2.errors === 0 && r2.kapandi, r2);
      const tur2 = await p.faturaTuru.findUnique({ where: { tenantId_period: { tenantId: b2.id, period: '2026-07' } } });
      t('dönem TAMAM, toplam 2 fatura, hata 0', tur2.durum === 'TAMAM' && tur2.faturaSayisi === 2 && tur2.hataSayisi === 0, { d: tur2.durum, f: tur2.faturaSayisi, h: tur2.hataSayisi });
      t('her müşteriye tek fatura (idempotent)', (await p.customerInvoice.count({ where: { tenantId: b2.id, period: '2026-07' } })) === 2);
      // Süpürme: kapanan dönemde faturasız sayfası kalan müşteri bulunur; taslağı bekleyen sayılmaz.
      const cI = await p.device.findFirst({ where: { customerId: iyi.id } });
      await okuma(cI, '2026-07', 700, {}, b2);
      t('★ kapanan dönemde faturasız sayfası kalan müşteri bulunur', JSON.stringify(await faturasizKalanMusteriler(b2.id, '2026-07')) === JSON.stringify([iyi.id]));
      await p.faturaTaslagi.create({ data: { tenantId: b2.id, customerId: iyi.id, period: '2026-07', gerekceler: [], satirlar: [], araToplam: 0, toplam: 0 } });
      t('taslağı bekleyen müşteri süpürülmez', (await faturasizKalanMusteriler(b2.id, '2026-07')).length === 0);
    }
  } catch (e) {
    kaldi++; console.log('  ✗ veritabanı kısmı patladı —', e?.stack ?? e);
  } finally {
    for (const b of bayiler) await p.tenant.delete({ where: { id: b.id } }).catch(() => {});
    console.log('\n  (temizlik: geçici bayiler silindi)');
    await p.$disconnect();
  }
}
temizle();

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
