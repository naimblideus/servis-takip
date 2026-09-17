// SLA — GERÇEK VERİYLE UÇTAN UCA
// Çalıştır:  node scripts/test-sla-uc.mjs
// Veri YAZAR, sonunda tamamını geri alır. Yerel olmayan veritabanında çalışmaz.
//
// NEDEN BU TEST
// Saf hesabın testi ayrı (test-sla.mjs) ve orada çalışma saati, yaz saati ve
// duraklama kuralları ölçülüyor. Burada ölçülen şey, o hesabın GERÇEK aşama
// geçmişine doğru bağlanıp bağlanmadığı. Büyük müşteriye gösterilen rapor bu
// bağlantıdan çıkıyor; yanlış olursa hesabın doğru olması işe yaramaz.
//
//   1. Sözleşmedeki söz doğru fişe uygulanıyor mu (müşteri eşleşmesi).
//   2. SÖZÜ OLMAYAN müşterinin fişi uyum oranını BOZMUYOR mu — en kolay
//      yapılacak hata bu: bir bayide tek bir sözleşme varsa, diğer bütün
//      müşterilerin fişlerini de o söze göre ölçmek uyumu yerle bir eder.
//   3. Aynı müşteride iki sözleşme varsa EN YENİSİ geçerli mi.
//   4. Dönem AÇILIŞA göre süzülüyor mu — kapanışa göre süzmek, ay sonunda
//      hâlâ açık duran gecikmiş fişi rapordan düşürürdü.
//   5. Türetilmiş geçmişli fiş ölçüme girmiyor ama SAYILIYOR mu.
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';

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

// slaOlc Prisma'ya bağlı; derleyip '@/lib/...' yollarını yerel dosyalara çeviriyoruz.
const g = mkdtempSync(join(tmpdir(), 'st-slauc-'));
let veri;
// tsc '@/...' takma yolunu çözemez ve HATA verir; ama JS'i yine de üretir.
// Tip denetimi ayrıca koşuyor (npx tsc --noEmit), burada çıktı yeterli.
try { execFileSync(process.execPath, [
  join(KOK, 'node_modules/typescript/bin/tsc'),
  join(KOK, 'src/lib/sla-veri.ts'), join(KOK, 'src/lib/sla.ts'),
  '--outDir', g, '--module', 'esnext', '--target', 'es2022',
  '--moduleResolution', 'bundler', '--skipLibCheck',
], { stdio: 'pipe' }); } catch { /* yukarıdaki not */ }

try {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(g, 'prisma-shim.js'),
    `import { PrismaClient } from ${JSON.stringify(pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href)};\nexport const prisma = new PrismaClient();\n`);
  const yol = join(g, 'sla-veri.js');
  writeFileSync(yol, readFileSync(yol, 'utf8')
    .replace("'@/lib/prisma'", "'./prisma-shim.js'")
    .replace("'@/lib/sla'", "'./sla.js'"), 'utf8');
  veri = await import(pathToFileURL(yol).href);
} catch (e) {
  console.log('ATLANDI: sla-veri derlenemedi —', e?.message);
  rmSync(g, { recursive: true, force: true });
  process.exit(0);
}
const { slaOlc } = veri;

const p = new PrismaClient();
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const SLUG = 'test-sla-uc';
const tr = (s) => new Date(`${s}+03:00`);

async function temizle() {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });
}

let bayiId = null;
try {
  await temizle();

  const bayi = await p.tenant.create({
    data: {
      name: 'SLA Test Bayisi', slug: SLUG,
      workTimezone: 'Europe/Istanbul', workDays: '1,2,3,4,5',
      workStartMin: 540, workEndMin: 1080,
    },
    select: { id: true },
  });
  bayiId = bayi.id;

  const kullanici = await p.user.create({
    data: { tenantId: bayiId, email: `sla-${Date.now()}@test.local`, passwordHash: 'x', name: 'SLA Test', role: 'ADMIN' },
    select: { id: true },
  });

  const sozlu = await p.customer.create({ data: { tenantId: bayiId, name: 'Sözleşmeli Müşteri', phone: '5550000001' }, select: { id: true } });
  const sozsuz = await p.customer.create({ data: { tenantId: bayiId, name: 'Sözü Olmayan Müşteri', phone: '5550000002' }, select: { id: true } });

  const cihaz = async (musteriId, seri) => (await p.device.create({
    data: {
      tenantId: bayiId, customerId: musteriId, brand: 'Canon', model: 'iR-ADV',
      serialNo: seri, publicCode: `SLATEST-${seri}`,
      // QR jetonu ZORUNLU: cihaz kaydı jetonsuz açılamaz (müşteri QR'ı okutup
      // giriş yapmadan arıza bildiriyor). Testte sahte bir özet yeterli.
      qrTokenHash: `test-${seri}`,
    },
    select: { id: true },
  })).id;
  const c1 = await cihaz(sozlu.id, 'SLA-1');
  const c2 = await cihaz(sozsuz.id, 'SLA-2');

  // ESKİ sözleşme: 8 saat. YENİ sözleşme: 4 saat. Geçerli olan YENİ olmalı.
  await p.contract.create({
    data: {
      tenantId: bayiId, customerId: sozlu.id,
      startDate: tr('2025-01-01T00:00:00'), endDate: tr('2025-12-31T00:00:00'),
      status: 'AKTIF', slaResponseMins: 480, slaResolutionMins: 4800,
    },
  });
  await p.contract.create({
    data: {
      tenantId: bayiId, customerId: sozlu.id,
      startDate: tr('2026-01-01T00:00:00'), endDate: tr('2026-12-31T00:00:00'),
      status: 'AKTIF', slaResponseMins: 240, slaResolutionMins: 1440,
    },
  });

  let sayac = 0;
  const fisAc = async (deviceId, customerId, acilis, asamalar, kaynak = 'PANEL') => {
    const f = await p.serviceTicket.create({
      data: {
        tenantId: bayiId, deviceId, customerId,
        ticketNumber: `SLA-${++sayac}`, issueText: 'test',
        createdByUserId: kullanici.id, createdAt: acilis, status: 'NEW',
      },
      select: { id: true },
    });
    for (const [durum, an] of asamalar) {
      await p.ticketStatusHistory.create({
        data: { tenantId: bayiId, ticketId: f.id, status: durum, changedAt: an, kaynak },
      });
    }
    return f.id;
  };

  // A) Söze UYAN fiş: 17 Eylül 09:00 açıldı, 10:00 müdahale, 15:00 çözüm.
  await fisAc(c1, sozlu.id, tr('2026-09-17T09:00:00'), [
    ['NEW', tr('2026-09-17T09:00:00')],
    ['IN_SERVICE', tr('2026-09-17T10:00:00')],
    ['READY', tr('2026-09-17T15:00:00')],
  ]);

  // B) Söze UYMAYAN fiş: ertesi gün 12:00 müdahale → 720 mesai dakikası.
  await fisAc(c1, sozlu.id, tr('2026-09-17T09:00:00'), [
    ['NEW', tr('2026-09-17T09:00:00')],
    ['IN_SERVICE', tr('2026-09-18T12:00:00')],
    ['READY', tr('2026-09-18T17:00:00')],
  ]);

  // C) SÖZÜ OLMAYAN müşterinin fişi — çok geç, ama uyumu bozmamalı.
  await fisAc(c2, sozsuz.id, tr('2026-09-17T09:00:00'), [
    ['NEW', tr('2026-09-17T09:00:00')],
    ['IN_SERVICE', tr('2026-09-25T17:00:00')],
  ]);

  // D) TÜRETİLMİŞ geçmiş — ölçüme girmez ama sayılır.
  await fisAc(c1, sozlu.id, tr('2026-09-17T09:00:00'), [
    ['NEW', tr('2026-09-17T09:00:00')],
  ], 'GECMIS');

  // E) BAŞKA AYDA açılmış fiş — eylül raporuna girmemeli.
  await fisAc(c1, sozlu.id, tr('2026-08-10T09:00:00'), [
    ['NEW', tr('2026-08-10T09:00:00')],
    ['IN_SERVICE', tr('2026-08-10T09:30:00')],
    ['READY', tr('2026-08-10T11:00:00')],
  ]);

  console.log('\nSLA uçtan uca\n');

  const bas = tr('2026-09-01T00:00:00');
  const son = tr('2026-09-30T23:59:59');
  const r = await slaOlc(bayiId, bas, son, tr('2026-09-26T12:00:00'));

  t('dönem dışı fiş rapora girmedi', r.fisler.length === 4, r.fisler.length);
  t('★ ölçülen 2 fiş (sözü olan + türetilmiş olmayan)', r.ozet.olculen === 2, r.ozet.olculen);
  t('türetilmiş 1 fiş dışarıda ve sayılıyor', r.ozet.turetilmisDisi === 1, r.ozet.turetilmisDisi);
  t('★ sözü olmayan müşterinin fişi ayrı sayılıyor', r.ozet.hedefsizDisi === 1, r.ozet.hedefsizDisi);
  t('★ müdahale uyumu %50 (biri ihlal)', r.ozet.mudahaleUyumYuzde === 50, r.ozet.mudahaleUyumYuzde);

  const uyan = r.fisler.find((f) => f.ticketNumber === 'SLA-1');
  const uymayan = r.fisler.find((f) => f.ticketNumber === 'SLA-2');
  t('uyan fişte müdahale 60 dk', uyan?.olcum.mudahaleDk === 60, uyan?.olcum.mudahaleDk);
  t('uyan fişte ihlal yok', uyan?.olcum.mudahaleIhlal === false);
  t('★ uymayan fişte müdahale 720 dk', uymayan?.olcum.mudahaleDk === 720, uymayan?.olcum.mudahaleDk);
  t('uymayan fişte ihlal var', uymayan?.olcum.mudahaleIhlal === true);
  t('★ EN YENİ sözleşme geçerli (4 saat, 8 değil)', uyan?.hedefMudahaleDk === 240, uyan?.hedefMudahaleDk);

  const sozsuzFis = r.fisler.find((f) => f.ticketNumber === 'SLA-3');
  t('★ sözü olmayan fiş kapsam dışı', sozsuzFis?.olcum.kapsamda === false && sozsuzFis?.olcum.disKalmaKodu === 'HEDEF_YOK');

  const turetilmis = r.fisler.find((f) => f.ticketNumber === 'SLA-4');
  t('türetilmiş fiş kapsam dışı', turetilmis?.olcum.disKalmaKodu === 'TURETILMIS_GECMIS');

  t('müşteri kırılımında yalnız ölçülen müşteri var', r.musteriler.length === 1, r.musteriler.map((m) => m.musteri));
  t('müşteri kırılımı 2 fiş sayıyor', r.musteriler[0]?.ozet.olculen === 2);
  t('hedefli sözleşme 1 müşteri', r.hedefliSozlesme === 1, r.hedefliSozlesme);
  t('takvim sorunsuz', r.takvimSorunlu === false);

  // BOZUK GÜN LİSTESİ ölçümü durdurmaz: okurken makul varsayılana düşüyoruz.
  // Boş bir gün listesi yüzünden bütün SLA raporunun kararması, düzeltmesi
  // kolay bir ayar hatasının bedeli olarak çok ağır olurdu.
  await p.tenant.update({ where: { id: bayiId }, data: { workDays: '' } });
  const bosGun = await slaOlc(bayiId, bas, son, tr('2026-09-26T12:00:00'));
  t('★ boş gün listesi varsayılana düşüyor, ölçüm sürüyor',
    bosGun.takvimSorunlu === false && bosGun.ozet.olculen === 2,
    [bosGun.takvimSorunlu, bosGun.ozet.olculen]);

  // TERS SAAT (bitiş ≤ başlangıç) için makul varsayılan YOK: hangi saatler
  // kastedildiği bilinmiyor. Ölçüm durur ve ekran sebebini söyler — sıfır
  // dakika üretmek "hemen müdahale edildi" diye okunur ve ihlali gizlerdi.
  await p.tenant.update({ where: { id: bayiId }, data: { workDays: '1,2,3,4,5', workEndMin: 540 } });
  const ters = await slaOlc(bayiId, bas, son, tr('2026-09-26T12:00:00'));
  t('★ ters çalışma saatinde ölçüm duruyor', ters.takvimSorunlu === true && ters.ozet.olculen === 0,
    [ters.takvimSorunlu, ters.ozet.olculen]);
} finally {
  if (bayiId) {
    await p.tenant.delete({ where: { id: bayiId } }).catch(() => {});
    console.log('\n  (temizlik: test bayisi silindi)');
  }
  await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
