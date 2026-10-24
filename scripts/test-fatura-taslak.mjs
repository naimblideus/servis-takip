// TASLAK → KONTROL → KES — şüpheli / şoklu fatura kendiliğinden kesilmez (lib/fatura-bekletme)
// Çalıştır:  node scripts/test-fatura-taslak.mjs   (yerel veritabanı; yoksa DB kısmı atlanır)
//
// NEDEN BU TEST
// Sayaç insansız geliyor, fatura insansız kesiliyordu: makinenin kendi hızına
// göre inanılmaz bir okuma da müşteriye fatura olarak gidiyordu. Artık böyle
// fatura taslakta bekler; taslak hiçbir işareti (billed, kira dönemi) değiştirmez,
// bayi onaylayınca hesap yeniden yapılır ve tutar değiştiyse kesilmez.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derle, KOK } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const { ice, prismaIstemci: P } = derle({ girisler: ['src/lib/invoicing.ts', 'src/lib/fatura-bekletme.ts'], onEk: 'st-fatura-taslak-' });
const d = await ice('lib/fatura-donemi');
const bk = await ice('lib/fatura-bekletme');
const { donemFaturasiHazirla, buildInvoiceForCustomerPeriod } = await ice('lib/invoicing');

console.log('\nFATURA ŞOKU (saf)\n');
const c = (sayfa, tutar, carpan = 1) => ({ sayfa, tutar, carpan });
t('geçmiş yoksa şok yok', !bk.sokMu(c(10000, 5000), []).sok);
t('tek dönem geçmiş yetmez', !bk.sokMu(c(10000, 5000), [1000]).sok);
t('★ 3 dönem ~1.000, bu ay 5.000 ve ₺2.500 → şok', bk.sokMu(c(5000, 2500), [1000, 1100, 900]).sok);
t('iki katı tam sınırda şok değil', !bk.sokMu(c(2000, 2500), [1000, 1000, 1000]).sok);
t('tutar 400 altındaysa şok değil (küçük makine)', !bk.sokMu(c(5000, 399), [1000, 1000]).sok);
t('★ okunmayan ay: 2 ayın sayfası tek okumada şok sayılmaz', !bk.sokMu(c(3800, 1900, 2), [1000, 1000, 1000]).sok);
t('yalnız son 3 dönem sayılır', bk.sokMu(c(5000, 2500), [1000, 1000, 1000, 90000]).ortalama === 1000);
const g = bk.gerekceleriBul([{ deviceId: 'a', cihaz: 'K', sayfa: 100, tutar: 50, carpan: 1, supheli: 2 }], new Map());
t('şüpheli okuma gerekçesi', g.length === 1 && g[0].kod === 'SUPHELI_OKUMA' && g[0].okumaSayisi === 2, g);

const dbUrl = (() => { try { return readFileSync(join(KOK, '.env'), 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1] ?? ''; } catch { return process.env.DATABASE_URL ?? ''; } })();
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  const { PrismaClient } = await import(P);
  const p = new PrismaClient();
  const SLUG = 'test-fatura-taslak';
  const DONEM = '2026-07';
  let bayi, bayi2;
  try {
    for (const s of [SLUG, SLUG + '-elle']) {
      const eski = await p.tenant.findFirst({ where: { slug: s } });
      if (eski) await p.tenant.delete({ where: { id: eski.id } });
    }
    bayi = await p.tenant.create({ data: { name: 'Taslak Testi', slug: SLUG, plan: 'professional', pricePerBlack: 0.5, pricePerColor: 2, vatRate: 20 } });
    let n = 0;
    const musteri = (b, ad) => p.customer.create({ data: { tenantId: b.id, name: ad, phone: `0500000${String(++n).padStart(4, '0')}` } });
    const cihaz = async (b, m) => p.device.create({
      data: {
        tenantId: b.id, customerId: m.id, brand: 'Kyocera', model: `T-${++n}`, serialNo: `TSL-${n}`, publicCode: `TSL-${n}-${Date.now()}`,
        qrTokenHash: 'x', createdAt: new Date('2025-01-01T00:00:00Z'), isRental: true, monthlyRent: 100, pricePerBlack: 0.5, pricePerColor: 2,
      },
    });
    const okuma = (b, c, donem, delta, ek = {}) => p.counterReading.create({
      data: { tenantId: b.id, deviceId: c.id, counterBlack: 10000 + delta, counterColor: 0, deltaBlack: delta, deltaColor: 0, billed: false, source: 'CIHAZ_EPOSTA', faturaDonemi: donem, readingDate: new Date(d.donemAraligi(donem).start.getTime() + 20 * 86_400_000), ...ek },
    });
    const faturaSayisi = (m) => p.customerInvoice.count({ where: { customerId: m.id } });

    console.log('\nVERİTABANI: otomatik bayi\n');
    const A = await musteri(bayi, 'Normal'); const aC = await cihaz(bayi, A);
    await okuma(bayi, aC, DONEM, 1000);
    const sA = await donemFaturasiHazirla(bayi.id, A.id, DONEM);
    t('normal fatura kendiliğinden kesilir', sA?.tur === 'KESILDI', sA?.tur);

    const B = await musteri(bayi, 'Şüpheli'); const bC = await cihaz(bayi, B);
    const bOk = await okuma(bayi, bC, DONEM, 150000, { supheli: true });
    const sB = await donemFaturasiHazirla(bayi.id, B.id, DONEM);
    t('★ şüpheli okumalı fatura KESİLMEZ, taslakta bekler', sB?.tur === 'TASLAK' && sB.gerekceler.some((x) => x.kod === 'SUPHELI_OKUMA'), sB);
    t('taslakta fatura yok (bakiye, KDV, portal görmez)', (await faturaSayisi(B)) === 0);
    t('taslak okumayı faturalandı yapmaz', (await p.counterReading.findUnique({ where: { id: bOk.id } })).billed === false);
    t('taslak kira işaretini ilerletmez', (await p.device.findUnique({ where: { id: bC.id } })).lastInvoicedPeriod === null);
    const sB2 = await donemFaturasiHazirla(bayi.id, B.id, DONEM);
    t('tekrar koşu yeni taslak açmaz, aynısını tazeler', sB2?.tur === 'TASLAK' && sB2.taslakId === sB.taslakId
      && (await p.faturaTaslagi.count({ where: { customerId: B.id } })) === 1);
    const kB = await donemFaturasiHazirla(bayi.id, B.id, DONEM, { taslakId: sB.taslakId });
    t('★ "yine de kes" faturayı keser', kB?.tur === 'KESILDI' && Math.abs(Number(kB.invoice.totalAmount) - sB.toplam) < 0.01, kB?.tur);
    const tB = await p.faturaTaslagi.findUnique({ where: { id: sB.taslakId } });
    t('taslak KESILDI, faturaya bağlı', tB.durum === 'KESILDI' && tB.invoiceId === kB.invoice.id);
    t('kesilince okuma faturalandı', (await p.counterReading.findUnique({ where: { id: bOk.id } })).billed === true);
    t('kesilmiş taslak ikinci kez kesilmez', (await donemFaturasiHazirla(bayi.id, B.id, DONEM, { taslakId: sB.taslakId })) === null);

    console.log('\nVERİTABANI: onay anında tutar değişti\n');
    const C = await musteri(bayi, 'Değişen'); const cC = await cihaz(bayi, C);
    await okuma(bayi, cC, DONEM, 2000, { supheli: true });
    const sC = await donemFaturasiHazirla(bayi.id, C.id, DONEM);
    await okuma(bayi, cC, DONEM, 500);
    const kC = await donemFaturasiHazirla(bayi.id, C.id, DONEM, { taslakId: sC.taslakId });
    t('★ tutar değiştiyse kesilmez (bayi gördüğünü onayladı)', kC?.tur === 'DEGISTI' && (await faturaSayisi(C)) === 0, kC);
    const tC = await p.faturaTaslagi.findUnique({ where: { id: sC.taslakId } });
    t('taslak yeni tutarla güncellendi', Number(tC.toplam) > sC.toplam && tC.durum === 'BEKLIYOR', { once: sC.toplam, sonra: Number(tC.toplam) });
    const kC2 = await donemFaturasiHazirla(bayi.id, C.id, DONEM, { taslakId: sC.taslakId });
    t('yeni tutar görülüp onaylanınca kesilir', kC2?.tur === 'KESILDI');

    console.log('\nVERİTABANI: fatura şoku\n');
    const D = await musteri(bayi, 'Şok'); const dC = await cihaz(bayi, D);
    for (const donem of ['2026-04', '2026-05', '2026-06']) await okuma(bayi, dC, donem, 1000, { billed: true });
    await okuma(bayi, dC, DONEM, 6000);
    const sD = await donemFaturasiHazirla(bayi.id, D.id, DONEM);
    t('★ her zamanki 1.000 sayfa, bu ay 6.000 (₺3.000) → taslak', sD?.tur === 'TASLAK' && sD.gerekceler[0]?.kod === 'FATURA_SOKU' && sD.gerekceler[0].ortalama === 1000, sD);

    console.log('\nVERİTABANI: başka yoldan kesilen taslak düşer\n');
    const E = await musteri(bayi, 'Düşen'); const eC = await cihaz(bayi, E);
    await okuma(bayi, eC, DONEM, 900, { supheli: true });
    const sE = await donemFaturasiHazirla(bayi.id, E.id, DONEM);
    await buildInvoiceForCustomerPeriod(bayi.id, E.id, DONEM);
    t('faturalanacak şey kalmayınca hazırlık boş döner', (await donemFaturasiHazirla(bayi.id, E.id, DONEM)) === null);
    t('ve bekleyen taslak ATILDI olur', (await p.faturaTaslagi.findUnique({ where: { id: sE.taslakId } })).durum === 'ATILDI');

    console.log('\nVERİTABANI: bayi onayı açık (ELLE)\n');
    bayi2 = await p.tenant.create({ data: { name: 'Taslak Testi Elle', slug: SLUG + '-elle', plan: 'professional', pricePerBlack: 0.5, pricePerColor: 2, vatRate: 20, faturaOnayi: 'ELLE' } });
    const F = await musteri(bayi2, 'Elle'); const fC = await cihaz(bayi2, F);
    await okuma(bayi2, fC, DONEM, 1000);
    const sF = await donemFaturasiHazirla(bayi2.id, F.id, DONEM);
    t('★ onay açıkken normal fatura da taslakta bekler (gerekçesiz)', sF?.tur === 'TASLAK' && sF.gerekceler.length === 0, sF);
    t('onaylanınca kesilir', (await donemFaturasiHazirla(bayi2.id, F.id, DONEM, { taslakId: sF.taslakId }))?.tur === 'KESILDI');
  } catch (e) {
    kaldi++; console.log('  ✗ veritabanı kısmı patladı —', e?.message ?? e);
  } finally {
    for (const b of [bayi, bayi2]) if (b) await p.tenant.delete({ where: { id: b.id } }).catch(() => {});
    console.log('\n  (temizlik: geçici bayiler silindi)');
    await p.$disconnect();
  }
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
