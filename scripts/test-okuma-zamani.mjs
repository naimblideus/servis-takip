// OKUMA ZAMANI VE FATURA DÖNEMİ — lib/fatura-donemi + createReading + fatura
// Çalıştır:  node scripts/test-okuma-zamani.mjs   (yerel veritabanı; yoksa DB kısmı atlanır)
//
// NEDEN BU TEST
// · Ay sınırı sunucunun saat dilimine göre hesaplanıyordu (canlıda UTC):
//   İstanbul'da 1 Kasım 00:30'daki okuma Ekim'e yazılıyordu.
// · Her okuma "şimdi" tarihiyle yazılıyordu: 30 Ekim'de portala girilen sayaç
//   4 Kasım'da onaylanınca Kasım'ın okuması oluyordu.
// · Gerçek tarih saklanınca yeni bir risk doğar: koşusu bitmiş bir aya düşen
//   geç okuma bir daha hiçbir faturaya girmez. Kural: o okuma ilk açık döneme kayar.
// · Kesim günü 3 olan bayide ayın 1'inde gelen cihaz raporu GEÇEN ayındır.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derle, KOK } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const { ice, prismaIstemci: P } = derle({ girisler: ['src/lib/readings.ts', 'src/lib/fatura-turu.ts'], onEk: 'st-okuma-zamani-' });
const d = await ice('lib/fatura-donemi');
const { okumaAni, createReading } = await ice('lib/readings');
const { kosuDonemiKapatir, kosuyuKaydet } = await ice('lib/fatura-turu');
const { buildInvoiceForCustomerPeriod } = await ice('lib/invoicing');

// İstanbul yerel saatiyle an kur: ist(2026, 11, 1, 10) = 1 Kasım 10:00 İstanbul.
const ist = (y, m, gun, saat = 0, dk = 0) => new Date(Date.UTC(y, m - 1, gun, saat, dk) - 3 * 3_600_000);

console.log('\nAY SINIRI İSTANBUL SAATİYLE\n');
t('31 Ekim 23:59 İstanbul → Ekim', d.donemOf(ist(2026, 10, 31, 23, 59)) === '2026-10');
t('★ 1 Kasım 00:30 İstanbul → Kasım (UTC\'de hâlâ 31 Ekim)', d.donemOf(ist(2026, 11, 1, 0, 30)) === '2026-11');
const ar = d.donemAraligi('2026-11');
t('Kasım aralığı İstanbul gece yarısından gece yarısına',
  ar.start.toISOString() === '2026-10-31T21:00:00.000Z' && ar.end.toISOString() === '2026-11-30T21:00:00.000Z',
  { start: ar.start.toISOString(), end: ar.end.toISOString() });
t('yıl geçişi', d.sonrakiDonem('2026-12') === '2027-01' && d.oncekiDonem('2026-01') === '2025-12');
t('dönem biçimi denetimi', d.gecerliDonem('2026-09') && !d.gecerliDonem('2026-13') && !d.gecerliDonem('2026-9') && !d.gecerliDonem(null));
t('kesim günü 1–28, geçersizse 1', d.kesimGunu(5) === 5 && d.kesimGunu(0) === 1 && d.kesimGunu(29) === 1 && d.kesimGunu('x') === 1);

console.log('\nKESİM GÜNÜ\n');
t('kesim 1: ayın 1\'indeki okuma o ayın', d.okumaDonemi(ist(2026, 11, 1, 10), 1) === '2026-11');
t('★ kesim 3: ayın 1\'indeki cihaz raporu GEÇEN ayın', d.okumaDonemi(ist(2026, 11, 1, 10), 3) === '2026-10');
t('kesim 3: ayın 3\'ü yeni ayın', d.okumaDonemi(ist(2026, 11, 3, 0, 30), 3) === '2026-11');
t('kapanan dönem (kesim 1, 1 Kasım) = Ekim', d.kapananDonem(ist(2026, 11, 1, 10), 1) === '2026-10');
t('kapanan dönem (kesim 3, 2 Kasım) = Eylül — Ekim hâlâ açık', d.kapananDonem(ist(2026, 11, 2, 10), 3) === '2026-09');
t('kapanan dönem (kesim 3, 3 Kasım) = Ekim', d.kapananDonem(ist(2026, 11, 3, 1), 3) === '2026-10');
t('kesim anı: kesim 3 → 3 Kasım 00:00 İstanbul', d.kesimAni('2026-10', 3).toISOString() === '2026-11-02T21:00:00.000Z');
t('kesim anı: kesim 1 → dönem sonu (bugünkü davranış)', d.kesimAni('2026-10', 1).getTime() === d.donemAraligi('2026-10').end.getTime());
t('★ elle düğme: ayın başında kapanan ay', d.varsayilanElleDonem(ist(2026, 10, 5, 12), 1) === '2026-09');
t('elle düğme: ayın ikinci yarısında bu ay', d.varsayilanElleDonem(ist(2026, 10, 20, 12), 1) === '2026-10');

console.log('\nGEÇ OKUMA KAYBOLMAZ\n');
const kapali = new Set(['2026-10']);
t('★ koşusu bitmiş aya düşen okuma ilk açık döneme kayar',
  (await d.okumaDonemiAta(ist(2026, 10, 30, 12), 1, async (p) => kapali.has(p))) === '2026-11');
t('koşusu bitmemişse kendi ayında kalır',
  (await d.okumaDonemiAta(ist(2026, 10, 30, 12), 1, async () => false)) === '2026-10');
t('damgasız okuma: dönemi tarihinin İstanbul ayı',
  d.okumaninDonemi({ faturaDonemi: null, readingDate: ist(2026, 11, 1, 0, 30) }) === '2026-11');
const kosul = d.donemOkumaKosulu('2026-10');
t('dönem koşulu: damgalı + damgasız (tarih aralığı) iki yol',
  Array.isArray(kosul.OR) && kosul.OR.length === 2 && kosul.OR[0].faturaDonemi === '2026-10' && kosul.OR[1].faturaDonemi === null);
t('ara fatura dönemi kapatmaz, kapanmış ayın koşusu kapatır',
  !kosuDonemiKapatir(d.acikDonem(new Date(), 1), 1) && kosuDonemiKapatir(d.kapananDonem(new Date(), 1), 1));

console.log('\nOKUMANIN KAYDEDİLEN ANI\n');
const simdi = new Date();
const yakin = (a, b, ms = 2000) => Math.abs(a.getTime() - b.getTime()) <= ms;
t('verilmediyse şimdi (bugünkü davranış)', yakin(okumaAni(undefined, null, simdi), simdi));
t('geçersizse şimdi', yakin(okumaAni('dün öğlen', null, simdi), simdi));
t('★ gelecekteyse şimdi (saati ileri cihaz)', yakin(okumaAni(new Date(simdi.getTime() + 3_600_000), null, simdi), simdi));
const ikiGunOnce = new Date(simdi.getTime() - 2 * 86_400_000);
t('geçmişte ve zincirden yeniyse olduğu gibi', okumaAni(ikiGunOnce, new Date(simdi.getTime() - 5 * 86_400_000), simdi).getTime() === ikiGunOnce.getTime());
t('★ son okumadan eskiyse şimdi (zincir sırası bozulmaz)', yakin(okumaAni(ikiGunOnce, new Date(simdi.getTime() - 86_400_000), simdi), simdi));

// ── VERİTABANI ───────────────────────────────────────────────────────────
const dbUrl = (() => { try { return readFileSync(join(KOK, '.env'), 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1] ?? ''; } catch { return process.env.DATABASE_URL ?? ''; } })();
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  const { PrismaClient } = await import(P);
  const p = new PrismaClient();
  const SLUG = 'test-okuma-zamani';
  let bayi;
  try {
    const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
    if (eski) await p.tenant.delete({ where: { id: eski.id } });
    bayi = await p.tenant.create({
      data: { name: 'Okuma Zamanı Testi', slug: SLUG, plan: 'professional', pricePerBlack: 0.5, pricePerColor: 2, vatRate: 20, invoiceDayOfMonth: 1 },
    });
    const musteri = await p.customer.create({ data: { tenantId: bayi.id, name: 'Zaman Testi', phone: '05000000998' } });
    const altmisGunOnce = new Date(Date.now() - 60 * 86_400_000);
    let n = 0;
    const cihazKur = async () => {
      n++;
      const c = await p.device.create({
        data: {
          tenantId: bayi.id, customerId: musteri.id, brand: 'Kyocera', model: `Z-${n}`,
          serialNo: `ZMN-${n}`, publicCode: `ZMN-${n}-${Date.now()}`, qrTokenHash: 'x',
          isRental: true, monthlyRent: 500, pricePerBlack: 0.5, includedBlack: 0, counterBlack: 10000, counterColor: 0,
        },
      });
      // Zincirin başı — 60 gün önce, faturalanmış.
      await p.counterReading.create({
        data: { tenantId: bayi.id, deviceId: c.id, counterBlack: 10000, counterColor: 0, deltaBlack: 0, deltaColor: 0, billed: true, source: 'TOPLU', readingDate: altmisGunOnce },
      });
      return c;
    };

    console.log('\nVERİTABANI: createReading\n');
    const a = await cihazKur();
    const iki = new Date(Date.now() - 2 * 86_400_000);
    const r1 = await createReading({ tenantId: bayi.id, deviceId: a.id, counterBlack: 11000, counterColor: 0, source: 'PORTAL', readingDate: iki });
    t('★ gerçek okuma anı saklanır (portal talebinin anı)', r1.reading.readingDate.getTime() === iki.getTime(), r1.reading.readingDate);
    t('dönem damgası okumanın İstanbul ayı', r1.reading.faturaDonemi === d.okumaDonemi(iki, 1), r1.reading.faturaDonemi);
    const r2 = await createReading({ tenantId: bayi.id, deviceId: a.id, counterBlack: 11500, counterColor: 0, source: 'ELLE', readingDate: new Date(Date.now() + 86_400_000) });
    t('gelecek tarih şimdi olarak yazılır', yakin(r2.reading.readingDate, new Date(), 5000), r2.reading.readingDate);
    const r3 = await createReading({ tenantId: bayi.id, deviceId: a.id, counterBlack: 11800, counterColor: 0, source: 'ELLE', readingDate: iki });
    t('zincirden eski tarih şimdi olarak yazılır, fark doğru', yakin(r3.reading.readingDate, new Date(), 5000) && r3.reading.deltaBlack === 300,
      { tarih: r3.reading.readingDate, fark: r3.reading.deltaBlack });

    console.log('\nVERİTABANI: kesim günü 3\n');
    await p.tenant.update({ where: { id: bayi.id }, data: { invoiceDayOfMonth: 3 } });
    const bugunIst = d.istanbulTakvim(new Date());
    // Ayın 1'i 10:00 (geçmişte kalan en yakın): bu ay geçmediyse geçen ayın 1'i.
    let birinci = ist(bugunIst.yil, bugunIst.ay, 1, 10);
    if (birinci.getTime() > Date.now() - 3_600_000) {
      const onceki = d.oncekiDonem(d.donemOf(new Date())).split('-').map(Number);
      birinci = ist(onceki[0], onceki[1], 1, 10);
    }
    const beklenen = d.oncekiDonem(d.donemOf(birinci));
    const b = await cihazKur();
    const r4 = await createReading({ tenantId: bayi.id, deviceId: b.id, counterBlack: 12000, counterColor: 0, source: 'CIHAZ_EPOSTA', readingDate: birinci });
    t('★ ayın 1\'inde gelen cihaz raporu geçen aya damgalanır', r4.reading.faturaDonemi === beklenen, { damga: r4.reading.faturaDonemi, beklenen });
    const fat = await buildInvoiceForCustomerPeriod(bayi.id, musteri.id, beklenen, 'AUTO_MONTHLY');
    const satir = fat ? await p.invoiceLine.findFirst({ where: { invoiceId: fat.id, deviceId: b.id, kind: 'COUNTER' } }) : null;
    t('★ ve o ayın faturasına girer (2.000 sayfa)', !!satir && Number(satir.quantity) === 2000, satir && Number(satir.quantity));
    const r4b = await p.counterReading.findUnique({ where: { id: r4.reading.id }, select: { billed: true } });
    t('faturalandı işareti konur', r4b?.billed === true);

    console.log('\nVERİTABANI: damgasız eski kayıt\n');
    await p.tenant.update({ where: { id: bayi.id }, data: { invoiceDayOfMonth: 1 } });
    const c = await cihazKur();
    const X = d.oncekiDonem(d.acikDonem(new Date(), 1));
    const xOrta = new Date(d.donemAraligi(X).start.getTime() + 14 * 86_400_000);
    await p.counterReading.create({
      data: { tenantId: bayi.id, deviceId: c.id, counterBlack: 10700, counterColor: 0, deltaBlack: 700, deltaColor: 0, billed: false, source: 'TOPLU', readingDate: xOrta },
    });
    const fat2 = await buildInvoiceForCustomerPeriod(bayi.id, musteri.id, X, 'AUTO_MONTHLY');
    const satir2 = fat2 ? await p.invoiceLine.findFirst({ where: { invoiceId: fat2.id, deviceId: c.id, kind: 'COUNTER' } }) : null;
    t('★ damgasız okuma tarihinin ayıyla faturalanır (geriye uyum)', !!satir2 && Number(satir2.quantity) === 700, satir2 && Number(satir2.quantity));

    console.log('\nVERİTABANI: koşusu bitmiş ay\n');
    const e = await cihazKur();
    await kosuyuKaydet(bayi.id, X, 'ELLE', { faturaSayisi: 0, toplam: 0, hataSayisi: 0 }, true);
    const tur = await p.faturaTuru.findUnique({ where: { tenantId_period: { tenantId: bayi.id, period: X } } });
    t('kapanmış ayın koşusu TAMAM yazılır', tur?.durum === 'TAMAM' && !!tur?.bitis, tur?.durum);
    const xSon = new Date(d.donemAraligi(X).end.getTime() - 86_400_000);
    const r5 = await createReading({ tenantId: bayi.id, deviceId: e.id, counterBlack: 10400, counterColor: 0, source: 'PORTAL', readingDate: xSon });
    t('★ koşusu bitmiş aya düşen geç okuma bir sonraki döneme damgalanır',
      r5.reading.faturaDonemi === d.sonrakiDonem(X) && r5.reading.readingDate.getTime() === xSon.getTime(),
      { damga: r5.reading.faturaDonemi, tarih: r5.reading.readingDate });
    const acik = d.acikDonem(new Date(), 1);
    await kosuyuKaydet(bayi.id, acik, 'ELLE', { faturaSayisi: 1, toplam: 10, hataSayisi: 0 }, false);
    const tur2 = await p.faturaTuru.findUnique({ where: { tenantId_period: { tenantId: bayi.id, period: acik } } });
    t('ara fatura dönemi açık bırakır (CALISIYOR)', tur2?.durum === 'CALISIYOR', tur2?.durum);
  } catch (e) {
    kaldi++; console.log('  ✗ veritabanı kısmı patladı —', e?.message ?? e);
  } finally {
    if (bayi) {
      await p.tenant.delete({ where: { id: bayi.id } }).catch(() => {});
      console.log('\n  (temizlik: geçici bayi silindi)');
    }
    await p.$disconnect();
  }
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
