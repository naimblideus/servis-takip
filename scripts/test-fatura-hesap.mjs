// OKUNMAYAN AY FAZLA FATURA ÜRETMEZ — dahil paket çarpanı (lib/invoicing sayacAyCarpanlari)
// Çalıştır:  node scripts/test-fatura-hesap.mjs   (yerel veritabanı; yoksa DB kısmı atlanır)
//
// NEDEN BU TEST
// Eylül'de sayaç okunmadıysa Ekim okuması iki ayın sayfasını taşır. Dahil
// paket TEK ay uygulanınca "ayda 1.000 dahil" anlaşmasında 2.500 sayfa için
// 1.500 aşım kesiliyordu; doğrusu 500. Renkli sayaç e-postada gelmeyince son
// değer taşınıyor, renkli sayfalar sonra topluca geliyordu — aynı hata.
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const g = mkdtempSync(join(tmpdir(), 'st-fatura-hesap-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/fatura-donemi.ts'), join(KOK, 'src/lib/invoicing.ts'),
    join(KOK, 'src/lib/invoice-appendix.ts'), join(KOK, 'src/lib/prisma.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları ayrıca koşuyor */ }
const P = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(P)};\nexport const prisma = new PrismaClient();\n`);
const duzelt = (dosya, esle) => {
  const y = join(g, dosya); let s = readFileSync(y, 'utf8');
  for (const [a, b] of esle) s = s.split(a).join(b);
  writeFileSync(y, s);
};
const ORTAK = [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(P)], ["'@/lib/fatura-donemi'", "'./fatura-donemi.js'"]];
duzelt('invoicing.js', ORTAK);
duzelt('invoice-appendix.js', ORTAK);

const d = await import(pathToFileURL(join(g, 'fatura-donemi.js')).href);
const { buildInvoiceForCustomerPeriod } = await import(pathToFileURL(join(g, 'invoicing.js')).href);
const { buildCounterAppendix } = await import(pathToFileURL(join(g, 'invoice-appendix.js')).href);

console.log('\nAY ÇARPANI (saf)\n');
t('hiç faturalanmış okuma yoksa 1', d.ayCarpani(null, '2026-07') === 1);
t('geçen ay faturalandıysa 1', d.ayCarpani('2026-06', '2026-07') === 1);
t('★ bir ay okunmadıysa 2', d.ayCarpani('2026-05', '2026-07') === 2);
t('yıl geçişi', d.ayCarpani('2025-11', '2026-02') === 3);
t('aynı dönem (ara fatura) 1', d.ayCarpani('2026-07', '2026-07') === 1);
t('★ en çok 12 ay (veri hatası paketi şişirmesin)', d.ayCarpani('2025-01', '2026-07') === 12);

const dbUrl = (() => { try { return readFileSync(join(KOK, '.env'), 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1] ?? ''; } catch { return process.env.DATABASE_URL ?? ''; } })();
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  const { PrismaClient } = await import(P);
  const p = new PrismaClient();
  const SLUG = 'test-fatura-hesap';
  let bayi;
  try {
    const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
    if (eski) await p.tenant.delete({ where: { id: eski.id } });
    bayi = await p.tenant.create({ data: { name: 'Fatura Hesap Testi', slug: SLUG, plan: 'professional', pricePerBlack: 0.5, pricePerColor: 2, vatRate: 20 } });
    const musteri = await p.customer.create({ data: { tenantId: bayi.id, name: 'Hesap Testi', phone: '05000000997' } });
    let n = 0;
    // Cihaz Ocak'ta kurulmuş sayılır (geçmiş dönemlerin kirası kesilebilsin, fatura boş kalmasın).
    const cihaz = async (dahilS, dahilR, basDonem, basS = 10000, basR = 1000) => {
      n++;
      const c = await p.device.create({
        data: {
          tenantId: bayi.id, customerId: musteri.id, brand: 'Kyocera', model: `H-${n}`,
          serialNo: `HSP-${n}`, publicCode: `HSP-${n}-${Date.now()}`, qrTokenHash: 'x', createdAt: new Date('2025-01-01T00:00:00Z'),
          isRental: true, monthlyRent: 100, pricePerBlack: 0.5, pricePerColor: 2, includedBlack: dahilS, includedColor: dahilR,
          counterBlack: basS, counterColor: basR,
        },
      });
      await p.counterReading.create({ data: { tenantId: bayi.id, deviceId: c.id, counterBlack: basS, counterColor: basR, deltaBlack: 0, deltaColor: 0, billed: true, source: 'TOPLU', faturaDonemi: basDonem, readingDate: d.donemAraligi(basDonem).start } });
      return c;
    };
    const okuma = (c, donem, s, r, ds, dr, olculdu = true) => p.counterReading.create({
      data: { tenantId: bayi.id, deviceId: c.id, counterBlack: s, counterColor: r, deltaBlack: ds, deltaColor: dr, billed: false, source: 'CIHAZ_EPOSTA', faturaDonemi: donem, renkliOlculdu: olculdu, readingDate: new Date(d.donemAraligi(donem).start.getTime() + 20 * 86_400_000) },
    });
    const satir = (fat, c, renkli) => p.invoiceLine.findFirst({ where: { invoiceId: fat.id, deviceId: c.id, kind: 'COUNTER', description: { contains: renkli ? 'Renkli' : 'S/B' } } });

    // D: Mayıs okundu, Haziran HİÇ okunmadı, Temmuz 2.500 S/B + 600 renkli.
    const D = await cihaz(1000, 200, '2026-05');
    await okuma(D, '2026-07', 12500, 1600, 2500, 600);
    // E: Haziran'da renkli taşındı (ölçülmedi), Temmuz renkli geldi.
    const E = await cihaz(1000, 200, '2026-05');
    await okuma(E, '2026-06', 11000, 1000, 1000, 0, false);
    await okuma(E, '2026-07', 12000, 1500, 1000, 500, true);
    // F: her ay okunuyor.
    const F = await cihaz(1000, 0, '2026-05');
    await okuma(F, '2026-06', 11500, 1000, 1500, 0);
    await okuma(F, '2026-07', 13000, 1000, 1500, 0);
    // G: Temmuz'da hiç okuma yok.
    const G = await cihaz(1000, 0, '2026-06');
    // H: son faturalanmış okuma 18 ay önce (veri hatası) → en çok 12 ay.
    const H = await cihaz(100, 0, '2025-01');
    await okuma(H, '2026-07', 15000, 1000, 5000, 0);

    console.log('\nVERİTABANI: Haziran faturası\n');
    const haziran = await buildInvoiceForCustomerPeriod(bayi.id, musteri.id, '2026-06', 'AUTO_MONTHLY');
    t('Haziran faturası kesildi', !!haziran);
    const fH = haziran && await satir(haziran, F, false);
    t('F Haziran: 1.500 okundu, 1.000 dahil (1 ay) → 500 aşım', !!fH && Number(fH.quantity) === 500 && fH.ayCarpani === 1, fH && { q: Number(fH.quantity), k: fH.ayCarpani });

    console.log('\nVERİTABANI: Temmuz faturası\n');
    const temmuz = await buildInvoiceForCustomerPeriod(bayi.id, musteri.id, '2026-07', 'AUTO_MONTHLY');
    t('Temmuz faturası kesildi', !!temmuz);
    const dS = await satir(temmuz, D, false), dR = await satir(temmuz, D, true);
    t('★ D S/B: Haziran okunmadı → 2 ayın paketi (2.000) → 500 aşım (eskiden 1.500)',
      !!dS && Number(dS.quantity) === 500 && dS.dahilSayfa === 2000 && dS.ayCarpani === 2, dS && { q: Number(dS.quantity), dahil: dS.dahilSayfa, k: dS.ayCarpani });
    t('★ D renkli: 2 ayın paketi (400) → 200 aşım', !!dR && Number(dR.quantity) === 200 && dR.dahilSayfa === 400, dR && { q: Number(dR.quantity), dahil: dR.dahilSayfa });
    t('satır açıklaması müşteriye "(2 ay)" der', !!dS && dS.description.includes('dahil (2 ay)'), dS?.description);
    const eS = await satir(temmuz, E, false), eR = await satir(temmuz, E, true);
    t('E S/B: Haziran faturalandı → 1 ay, 1.000 sayfa paket içinde (satır yok)', !eS, eS && Number(eS.quantity));
    t('★ E renkli: Haziran\'da renkli ölçülmedi → 2 ayın paketi (400) → 100 aşım', !!eR && Number(eR.quantity) === 100 && eR.ayCarpani === 2, eR && { q: Number(eR.quantity), k: eR.ayCarpani });
    const fT = await satir(temmuz, F, false);
    t('F Temmuz: her ay okunan cihazda çarpan 1 → 500 aşım', !!fT && Number(fT.quantity) === 500 && fT.ayCarpani === 1);
    const gSatirlar = await p.invoiceLine.findMany({ where: { invoiceId: temmuz.id, deviceId: G.id } });
    t('G: okuma yoksa sayaç satırı yok, kira var', gSatirlar.length === 1 && gSatirlar[0].kind === 'RENTAL', gSatirlar.map((s) => s.kind));
    const hS = await satir(temmuz, H, false);
    t('★ H: 18 ay boşluk en çok 12 ay paket (1.200) → 3.800 aşım', !!hS && Number(hS.quantity) === 3800 && hS.ayCarpani === 12, hS && { q: Number(hS.quantity), k: hS.ayCarpani });

    console.log('\nVERİTABANI: fatura eki ve tekrar\n');
    const tam = await p.customerInvoice.findUnique({ where: { id: temmuz.id }, include: { lines: true } });
    const ek = await buildCounterAppendix(bayi.id, tam);
    const ekD = ek?.rows.find((r) => r.device.endsWith(D.model) && r.channel === 'BLACK');
    t('★ fatura eki faturada uygulanan dahil sayfayı gösterir (2.000, cihaz kartındaki 1.000 değil)', ekD?.included === 2000, ekD);
    const tekrar = await buildInvoiceForCustomerPeriod(bayi.id, musteri.id, '2026-07', 'AUTO_MONTHLY');
    t('aynı dönem tekrar kesilmez', tekrar === null);
  } catch (e) {
    kaldi++; console.log('  ✗ veritabanı kısmı patladı —', e?.message ?? e);
  } finally {
    if (bayi) { await p.tenant.delete({ where: { id: bayi.id } }).catch(() => {}); console.log('\n  (temizlik: geçici bayi silindi)'); }
    await p.$disconnect();
  }
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi ? 1 : 0);
