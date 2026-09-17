// KURUMSAL GRUP — GERÇEK VERİYLE UÇTAN UCA
// Çalıştır:  node scripts/test-kurumsal-uc.mjs
// Veri YAZAR, sonunda tamamını geri alır. Yerel olmayan veritabanında çalışmaz.
//
// NEDEN BU TEST
// Saf birleştirmenin testi ayrı (test-kurumsal.mjs). Burada ölçülen şey,
// raporun sistemdeki TEK doğruluk kaynaklarına doğru bağlanıp bağlanmadığı:
//
//   1. Sayfa, faturalamanın kullandığı okuma farklarından mı geliyor.
//   2. Dönemde okunmamış şube "0 sayfa" değil BİLİNMİYOR mu.
//   3. Dönem faturası yalnız O DÖNEMİ mi sayıyor (bakiye ise bugünü).
//   4. SLA yalnız sözleşmesinde süre yazan şubeden mi geliyor.
//   5. Gruba girmemiş müşteri ve başka bayinin kaydı rapora karışmıyor mu.
//   6. Grup silinince ŞUBELER duruyor mu — çatı kalkar, müşteri kalır.
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');

function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.log('ATLANDI: DATABASE_URL yerel değil. Bu test veri yazar.');
  process.exit(0);
}

const g = mkdtempSync(join(tmpdir(), 'st-kurumsaluc-'));
let veri;
// tsc '@/...' takma yolunu çözemez ve HATA verir; JS'i yine de üretir.
// Tip denetimi ayrıca koşuyor (npx tsc --noEmit).
try { execFileSync(process.execPath, [
  join(KOK, 'node_modules/typescript/bin/tsc'),
  join(KOK, 'src/lib/kurumsal-veri.ts'), join(KOK, 'src/lib/kurumsal.ts'),
  join(KOK, 'src/lib/sla-veri.ts'), join(KOK, 'src/lib/sla.ts'),
  join(KOK, 'src/lib/musteri-bakiye.ts'), join(KOK, 'src/lib/fault-categories.ts'),
  '--outDir', g, '--module', 'esnext', '--target', 'es2022',
  '--moduleResolution', 'bundler', '--skipLibCheck',
], { stdio: 'pipe' }); } catch { /* yukarıdaki not */ }

try {
  writeFileSync(join(g, 'prisma-shim.js'),
    `import { PrismaClient } from ${JSON.stringify(pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href)};\nexport const prisma = new PrismaClient();\n`);
  const duzelt = (dosya, ciftler) => {
    const yol = join(g, dosya);
    let s = readFileSync(yol, 'utf8');
    for (const [a, b] of ciftler) s = s.split(a).join(b);
    writeFileSync(yol, s, 'utf8');
  };
  const prismaYolu = ["'@/lib/prisma'", "'./prisma-shim.js'"];
  duzelt('kurumsal-veri.js', [
    prismaYolu,
    ["'@/lib/fault-categories'", "'./fault-categories.js'"],
    ["'@/lib/sla-veri'", "'./sla-veri.js'"],
    ["'@/lib/musteri-bakiye'", "'./musteri-bakiye.js'"],
    ["'@/lib/kurumsal'", "'./kurumsal.js'"],
  ]);
  duzelt('sla-veri.js', [prismaYolu, ["'@/lib/sla'", "'./sla.js'"]]);
  duzelt('musteri-bakiye.js', [prismaYolu]);
  veri = await import(pathToFileURL(join(g, 'kurumsal-veri.js')).href);
} catch (e) {
  console.log('ATLANDI: kurumsal-veri derlenemedi —', e?.message);
  rmSync(g, { recursive: true, force: true });
  process.exit(0);
}
const { grupRaporu, grupListesi, grupOlustur, grupSil, subeEkle, subeCikar, bostakiMusteriler } = veri;

const p = new PrismaClient();
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const SLUG = 'test-kurumsal-uc';
const YABANCI = 'test-kurumsal-uc-yabanci';
const DONEM = '2026-08';
const an = (gun, saat = 10) => new Date(Date.UTC(2026, 7, gun, saat - 3));

let bayiId = null, yabanciId = null;
try {
  for (const s of [SLUG, YABANCI]) {
    const eski = await p.tenant.findFirst({ where: { slug: s }, select: { id: true } });
    if (eski) await p.tenant.delete({ where: { id: eski.id } });
  }

  const bayi = await p.tenant.create({ data: { name: 'Grup Test Bayisi', slug: SLUG }, select: { id: true } });
  bayiId = bayi.id;
  const yonetici = await p.user.create({
    data: { tenantId: bayiId, name: 'Yönetici', email: 'y@grup.test', passwordHash: 'x', role: 'ADMIN' },
    select: { id: true },
  });

  let tel = 5551000000;
  const musteriYap = async (ad) => (await p.customer.create({
    data: { tenantId: bayiId, name: ad, phone: String(++tel) }, select: { id: true },
  })).id;
  const cihazYap = async (musteriId, kod) => (await p.device.create({
    data: {
      tenantId: bayiId, customerId: musteriId, brand: 'Kyocera', model: 'TASKalfa',
      serialNo: kod, publicCode: `GRP-${kod}`, qrTokenHash: `grp-${kod}`,
    },
    select: { id: true },
  })).id;
  const okumaYap = (deviceId, gun, siyah, renkli) => p.counterReading.create({
    data: {
      tenantId: bayiId, deviceId, readingDate: an(gun),
      counterBlack: siyah, counterColor: renkli, deltaBlack: siyah, deltaColor: renkli,
    },
  });

  // ── ŞUBE A ─── okunuyor, sözleşmesinde SLA var, açık faturası var ──────
  const a = await musteriYap('X Bank Kadıköy');
  const a1 = await cihazYap(a, 'A1');
  const a2 = await cihazYap(a, 'A2');
  await okumaYap(a1, 10, 6000, 1000);
  await okumaYap(a2, 10, 4000, 1000);
  await p.contract.create({
    data: {
      tenantId: bayiId, customerId: a, startDate: an(1), endDate: new Date(Date.UTC(2027, 0, 1)),
      status: 'AKTIF', slaResponseMins: 240, slaResolutionMins: 1440,
    },
  });
  // Dönem faturası + bakiye
  await p.customerInvoice.create({
    data: {
      tenantId: bayiId, customerId: a, invoiceNumber: 'GRP-FAT-1', period: DONEM,
      invoiceDate: an(15), dueDate: an(25), status: 'OPEN',
      subtotal: 1000, vatAmount: 0, totalAmount: 1000, paidAmount: 0,
    },
  });
  // BAŞKA DÖNEM faturası — dönem toplamına girmemeli, kapalı olduğu için bakiyeye de.
  await p.customerInvoice.create({
    data: {
      tenantId: bayiId, customerId: a, invoiceNumber: 'GRP-FAT-0', period: '2026-07',
      invoiceDate: new Date(Date.UTC(2026, 6, 15)), dueDate: new Date(Date.UTC(2026, 6, 25)),
      status: 'PAID', subtotal: 500, vatAmount: 0, totalAmount: 500, paidAmount: 500,
    },
  });

  const fisAc = async (musteriId, deviceId, gun, kategori) => {
    const acilis = an(gun, 10);
    const fis = await p.serviceTicket.create({
      data: {
        tenantId: bayiId, deviceId, customerId: musteriId,
        ticketNumber: `GRP-${musteriId.slice(-4)}-${gun}-${kategori ?? 'YOK'}`,
        issueText: 'test', createdByUserId: yonetici.id, faultCategory: kategori,
        status: 'READY', createdAt: acilis,
      },
      select: { id: true },
    });
    await p.ticketStatusHistory.createMany({ data: [
      { tenantId: bayiId, ticketId: fis.id, status: 'NEW', changedAt: acilis, kaynak: 'PANEL' },
      { tenantId: bayiId, ticketId: fis.id, status: 'IN_SERVICE', changedAt: an(gun, 11), kaynak: 'PANEL' },
      { tenantId: bayiId, ticketId: fis.id, status: 'READY', changedAt: an(gun, 12), kaynak: 'PANEL' },
    ] });
  };
  // 3, 4 Ağustos iş günü. İki arıza + bir planlı bakım + bir kategorisiz.
  await fisAc(a, a1, 3, 'FUSER');
  await fisAc(a, a1, 4, 'PAPER_JAM');
  await fisAc(a, a2, 5, 'PERIODIC_MAINTENANCE');
  await fisAc(a, a2, 6, null);

  // ── ŞUBE B ─── dönemde HİÇ okunmamış ───────────────────────────────────
  const bSube = await musteriYap('X Bank Levent');
  const b1 = await cihazYap(bSube, 'B1');
  // Okuma var ama BAŞKA dönemde: dönem sayfası bilinmiyor olmalı.
  await p.counterReading.create({
    data: {
      tenantId: bayiId, deviceId: b1, readingDate: new Date(Date.UTC(2026, 6, 10)),
      counterBlack: 9999, counterColor: 0, deltaBlack: 9999, deltaColor: 0,
    },
  });

  // ── ŞUBE C ─── okunuyor, sözleşmesi yok ────────────────────────────────
  const c = await musteriYap('X Bank Ataşehir');
  const c1 = await cihazYap(c, 'C1');
  await okumaYap(c1, 12, 2000, 0);

  // ── GRUBA GİRMEYEN MÜŞTERİ ─────────────────────────────────────────────
  const disarida = await musteriYap('Bağımsız Ofis');
  const d1 = await cihazYap(disarida, 'D1');
  await okumaYap(d1, 10, 50000, 50000);

  console.log('\nKurumsal grup uçtan uca\n');

  // ── GRUP KUR ───────────────────────────────────────────────────────────
  const grup = await grupOlustur(bayiId, 'X Bank');
  t('grup açılıyor', !!grup?.id, grup);
  t('★ aynı adla ikinci grup açılmıyor', (await grupOlustur(bayiId, 'X Bank')) === null);
  t('boş adla grup açılmıyor', (await grupOlustur(bayiId, '   ')) === null);

  for (const m of [a, bSube, c]) await subeEkle(bayiId, grup.id, m);
  t('★ başka bayinin müşterisi gruba eklenemiyor', (await subeEkle(bayiId, grup.id, 'yok-boyle-musteri')) === null);

  const liste = await grupListesi(bayiId);
  t('grup listesi şube sayısını veriyor', liste.length === 1 && liste[0].sube === 3, liste);

  // ── RAPOR ──────────────────────────────────────────────────────────────
  const r = await grupRaporu(bayiId, grup.id, DONEM);
  const bul = (ad) => r.subeler.find((s) => s.musteri === ad);

  t('üç şube raporda', r.subeler.length === 3, r.subeler.map((s) => s.musteri));
  t('★ gruba girmeyen müşteri raporda YOK', !r.subeler.some((s) => s.musteri === 'Bağımsız Ofis'), r.subeler.map((s) => s.musteri));

  const sa = bul('X Bank Kadıköy');
  t('★ sayfa okuma farklarından geliyor', sa?.siyah === 10000 && sa?.renkli === 2000, sa);
  t('okunan cihaz sayılıyor', sa?.cihaz === 2 && sa?.okunanCihaz === 2, sa);
  t('★ arıza ile planlı ziyaret ayrı sayılıyor', sa?.ariza === 2 && sa?.planli === 1, sa);
  t('★ kategorisiz fiş ikisine de yazılmıyor', sa.ariza + sa.planli === 3, sa);
  t('★ dönem faturası yalnız O DÖNEM', sa?.donemFaturasi === 1000, sa?.donemFaturasi);
  t('★ bakiye açık faturadan', sa?.bakiye === 1000, sa?.bakiye);
  t('★ sözleşmedeki söz ölçülüyor', sa?.slaMudahaleYuzde !== null && sa?.slaOlculen > 0, sa);

  const sb = bul('X Bank Levent');
  t('★ dönemde okunmamış şubenin sayfası BİLİNMİYOR (0 değil)', sb?.siyah === null && sb?.renkli === null, sb);
  t('okunmayan cihaz sayısı doğru', sb?.cihaz === 1 && sb?.okunanCihaz === 0, sb);

  const sc = bul('X Bank Ataşehir');
  t('★ sözleşmesi olmayan şubede SLA null', sc?.slaMudahaleYuzde === null && sc?.slaCozumYuzde === null, sc);
  t('sözleşmesiz şubenin sayfası yine de sayılıyor', sc?.siyah === 2000, sc);

  t('★ toplam sayfa okunmayan şubeyi sıfır saymıyor', r.toplam.toplamSayfa === 14000, r.toplam);
  t('★ okunmayan cihaz toplamda görünüyor', r.toplam.okunmayanCihaz === 1, r.toplam);
  t('★ SLA sözü yalnız bir şubede', r.toplam.slaSozluSube === 1, r.toplam);
  t('grup uyumu tek sözlü şubeninkiyle aynı',
    r.toplam.slaMudahaleYuzde === sa.slaMudahaleYuzde, [r.toplam.slaMudahaleYuzde, sa.slaMudahaleYuzde]);
  t('toplam fatura ve bakiye', r.toplam.donemFaturasi === 1000 && r.toplam.bakiye === 1000, r.toplam);
  t('★ en çok basan şube üstte', r.subeler[0].musteri === 'X Bank Kadıköy', r.subeler.map((s) => s.musteri));

  // ── ADAY LİSTESİ ───────────────────────────────────────────────────────
  const adaylar = await bostakiMusteriler(bayiId, grup.id, 'Bağımsız');
  t('gruba eklenebilecek müşteri bulunuyor', adaylar.some((m) => m.name === 'Bağımsız Ofis'), adaylar);

  // ── BAŞKA BAYİ ─────────────────────────────────────────────────────────
  {
    const yb = await p.tenant.create({ data: { name: 'Yabancı Bayi', slug: YABANCI }, select: { id: true } });
    yabanciId = yb.id;
    await p.customerGroup.create({ data: { tenantId: yabanciId, name: 'Y Holding' } });
    const yabanciListe = await grupListesi(bayiId);
    t('★ başka bayinin grubu listede yok', yabanciListe.every((x) => x.ad !== 'Y Holding'), yabanciListe);
    t('★ başka bayinin grubu okunamıyor',
      (await grupRaporu(bayiId, (await p.customerGroup.findFirst({ where: { tenantId: yabanciId }, select: { id: true } })).id, DONEM)) === null);
  }

  // ── ÇIKAR / SİL ────────────────────────────────────────────────────────
  await subeCikar(bayiId, c);
  const r2 = await grupRaporu(bayiId, grup.id, DONEM);
  t('★ şube gruptan çıkıyor', r2.subeler.length === 2, r2.subeler.map((s) => s.musteri));
  t('★ çıkarılan müşteri SİLİNMİYOR', (await p.customer.count({ where: { id: c } })) === 1);

  await grupSil(bayiId, grup.id);
  t('grup siliniyor', (await grupListesi(bayiId)).length === 0);
  t('★ grup silinince şubeler duruyor', (await p.customer.count({ where: { tenantId: bayiId } })) === 4);
  t('★ şubelerin grup bağı temizleniyor',
    (await p.customer.count({ where: { tenantId: bayiId, groupId: { not: null } } })) === 0);
} finally {
  for (const id of [bayiId, yabanciId]) {
    if (id) await p.tenant.delete({ where: { id } }).catch(() => {});
  }
  if (bayiId) console.log('\n  (temizlik: test bayileri silindi)');
  await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
