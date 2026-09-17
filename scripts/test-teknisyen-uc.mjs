// TEKNİSYEN KARNESİ — GERÇEK VERİYLE UÇTAN UCA
// Çalıştır:  node scripts/test-teknisyen-uc.mjs
// Veri YAZAR, sonunda tamamını geri alır. Yerel olmayan veritabanında çalışmaz.
//
// NEDEN BU TEST
// Saf hesabın testi ayrı (test-teknisyen.mjs). Burada ölçülen şey o hesabın
// gerçek fişlere, gerçek aşama geçmişine ve gerçek çalışma takvimine doğru
// bağlanıp bağlanmadığı:
//
//   1. DÖNEM SONRASINDA açılan tekrar çağrısı yakalanıyor mu — yakalanmazsa
//      ayın son haftasında yapılan işler her zaman kusursuz görünür.
//   2. O geri dönüş fişi karnede SAYILMIYOR mu (yalnız delil olarak var).
//   3. Parça bekleme süresi teknisyenin süresinden düşülüyor mu — parçanın
//      depoda olmaması teknisyenin elinde değildir.
//   4. AŞAMA GEÇMİŞİ OLMAYAN eski kayıt ölçüye girebiliyor mu. Bayilerin
//      çoğunda geçmiş veri tam olarak böyledir: fiş "teslim edildi" yazar
//      ama ara aşamaları yoktur. Bu fişleri "hâlâ açık" saymak ya da ölçü
//      dışına atmak, karneyi ilk günden anlamsız yapardı.
//   5. Başka bayinin fişi karneye karışmıyor mu.
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

const g = mkdtempSync(join(tmpdir(), 'st-teknisyenuc-'));
let veri;
// tsc '@/...' takma yolunu çözemez ve HATA verir; JS'i yine de üretir.
// Tip denetimi ayrıca koşuyor (npx tsc --noEmit).
try { execFileSync(process.execPath, [
  join(KOK, 'node_modules/typescript/bin/tsc'),
  join(KOK, 'src/lib/teknisyen-veri.ts'), join(KOK, 'src/lib/teknisyen.ts'),
  join(KOK, 'src/lib/sla-veri.ts'), join(KOK, 'src/lib/sla.ts'),
  join(KOK, 'src/lib/fault-categories.ts'),
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
  duzelt('teknisyen-veri.js', [
    ["'@/lib/prisma'", "'./prisma-shim.js'"],
    ["'@/lib/fault-categories'", "'./fault-categories.js'"],
    ["'@/lib/sla-veri'", "'./sla-veri.js'"],
    ["'@/lib/sla'", "'./sla.js'"],
    ["'@/lib/teknisyen'", "'./teknisyen.js'"],
  ]);
  duzelt('sla-veri.js', [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@/lib/sla'", "'./sla.js'"]]);
  veri = await import(pathToFileURL(join(g, 'teknisyen-veri.js')).href);
} catch (e) {
  console.log('ATLANDI: teknisyen-veri derlenemedi —', e?.message);
  rmSync(g, { recursive: true, force: true });
  process.exit(0);
}
const { karneOlc } = veri;

const p = new PrismaClient();
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const SLUG = 'test-teknisyen-uc';
const YABANCI = 'test-teknisyen-uc-yabanci';
// Dönem: Ağustos 2026. "Bugün" 17 Eylül — 18 Ağustos'a kadar kapanan işlerin
// 30 günlük bekleme süresi dolmuş olur, sonrakiler BEKLEMEDE kalır.
const BAS = new Date(Date.UTC(2026, 7, 1, 0, 0));
const SON = new Date(Date.UTC(2026, 7, 31, 23, 59, 59));
const SIMDI = new Date(Date.UTC(2026, 8, 17, 12, 0));
/** Yerel saat 10:00 = 07:00 UTC (Europe/Istanbul, UTC+3). */
const an = (gun, saatUtc, dk = 0) => new Date(Date.UTC(2026, 7, gun, saatUtc, dk));

let bayiId = null, yabanciId = null;
try {
  for (const s of [SLUG, YABANCI]) {
    const eski = await p.tenant.findFirst({ where: { slug: s }, select: { id: true } });
    if (eski) await p.tenant.delete({ where: { id: eski.id } });
  }

  const bayi = await p.tenant.create({ data: { name: 'Karne Test Bayisi', slug: SLUG }, select: { id: true } });
  bayiId = bayi.id;
  const musteri = await p.customer.create({
    data: { tenantId: bayiId, name: 'Karne Müşterisi', phone: '5559990002' }, select: { id: true },
  });

  const kullanici = async (ad, eposta, rol = 'TECHNICIAN') => (await p.user.create({
    data: { tenantId: bayiId, name: ad, email: eposta, passwordHash: 'x', role: rol },
    select: { id: true },
  })).id;
  const ali = await kullanici('Ali Usta', 'ali@karne.test');
  const veliId = await kullanici('Veli Usta', 'veli@karne.test');
  await kullanici('Zeynep Usta', 'zeynep@karne.test'); // hiç iş almayacak
  const eskiUsta = await kullanici('Eski Usta', 'eski@karne.test');
  const yonetici = await kullanici('Yönetici', 'yonetici@karne.test', 'ADMIN');

  const cihazlar = new Map();
  const cihaz = async (kod) => {
    if (cihazlar.has(kod)) return cihazlar.get(kod);
    const id = (await p.device.create({
      data: {
        tenantId: bayiId, customerId: musteri.id, brand: 'Kyocera', model: 'TASKalfa',
        serialNo: kod, publicCode: `KRN-${kod}`, qrTokenHash: `krn-${kod}`,
      },
      select: { id: true },
    })).id;
    cihazlar.set(kod, id);
    return id;
  };

  let no = 0;
  /**
   * Fiş + aşama geçmişi.
   * Standart akış: 10:00 açılış, 11:00 müdahale, 14:00 hazır (yerel saat).
   * duraklama=true ise 12:00–13:00 arası parça beklenir.
   */
  const fisAc = async ({ cihazKodu, gun, kategori, teknisyen, duraklama = false, kapanir = true }) => {
    const deviceId = await cihaz(cihazKodu);
    const acilis = an(gun, 7);
    const fis = await p.serviceTicket.create({
      data: {
        tenantId: bayiId, deviceId, customerId: musteri.id,
        ticketNumber: `KRN-${String(++no).padStart(3, '0')}`,
        issueText: 'test', createdByUserId: yonetici,
        assignedUserId: teknisyen, faultCategory: kategori,
        status: kapanir ? 'READY' : 'IN_SERVICE',
        createdAt: acilis,
      },
      select: { id: true, ticketNumber: true },
    });
    const satir = (status, at) => ({ tenantId: bayiId, ticketId: fis.id, status, changedAt: at, kaynak: 'PANEL' });
    const satirlar = [satir('NEW', acilis), satir('IN_SERVICE', an(gun, 8))];
    if (duraklama) {
      satirlar.push(satir('WAITING_FOR_PART', an(gun, 9)));
      satirlar.push(satir('IN_SERVICE', an(gun, 10)));
    }
    if (kapanir) satirlar.push(satir('READY', an(gun, 11)));
    await p.ticketStatusHistory.createMany({ data: satirlar });
    return fis.ticketNumber;
  };

  // ── ALİ ────────────────────────────────────────────────────────────────
  // 3 Ağustos Pazartesi. Seçilen günlerin hepsi iş günü.
  const t1 = await fisAc({ cihazKodu: 'D1', gun: 3, kategori: 'FUSER', teknisyen: ali });
  const t2 = await fisAc({ cihazKodu: 'D1', gun: 10, kategori: 'FUSER', teknisyen: ali }); // T1'in tekrarı
  const t3 = await fisAc({ cihazKodu: 'D2', gun: 5, kategori: 'PAPER_JAM', teknisyen: ali });
  await fisAc({ cihazKodu: 'D3', gun: 6, kategori: 'PRINT_QUALITY', teknisyen: ali });
  await fisAc({ cihazKodu: 'D4', gun: 7, kategori: 'NETWORK', teknisyen: ali });
  await fisAc({ cihazKodu: 'D5', gun: 11, kategori: 'DRUM', teknisyen: ali });
  // 28 Ağustos: bekleme süresi 17 Eylül'de dolmamış — hüküm verilmemeli.
  await fisAc({ cihazKodu: 'D10', gun: 28, kategori: 'FUSER', teknisyen: ali });

  // DÖNEM SONRASI tekrar çağrısı: 2 Eylül'de aynı cihaz + aynı arıza.
  {
    const deviceId = await cihaz('D2');
    const acilis = new Date(Date.UTC(2026, 8, 2, 7, 0));
    const fis = await p.serviceTicket.create({
      data: {
        tenantId: bayiId, deviceId, customerId: musteri.id, ticketNumber: 'KRN-EYL',
        issueText: 'test', createdByUserId: yonetici, assignedUserId: ali,
        faultCategory: 'PAPER_JAM', status: 'READY', createdAt: acilis,
      },
      select: { id: true },
    });
    await p.ticketStatusHistory.createMany({ data: [
      { tenantId: bayiId, ticketId: fis.id, status: 'NEW', changedAt: acilis, kaynak: 'PANEL' },
      { tenantId: bayiId, ticketId: fis.id, status: 'READY', changedAt: new Date(Date.UTC(2026, 8, 2, 11, 0)), kaynak: 'PANEL' },
    ] });
  }

  // ── VELİ ─── hepsinde parça beklemesi var ──────────────────────────────
  await fisAc({ cihazKodu: 'D6', gun: 12, kategori: 'PERIODIC_MAINTENANCE', teknisyen: veliId, duraklama: true });
  await fisAc({ cihazKodu: 'D7', gun: 13, kategori: null, teknisyen: veliId, duraklama: true });
  await fisAc({ cihazKodu: 'D8', gun: 14, kategori: 'TONER', teknisyen: veliId, duraklama: true });
  await fisAc({ cihazKodu: 'D8', gun: 20, kategori: null, teknisyen: veliId, duraklama: true });

  // ── ESKİ KAYITLAR ─── aşama geçmişi yok, yalnız NEW/GECMIS satırı ──────
  const eskiFis = async ({ cihazKodu, gun, kategori, damgaGun }) => {
    const deviceId = await cihaz(cihazKodu);
    const acilis = an(gun, 7);
    const fis = await p.serviceTicket.create({
      data: {
        tenantId: bayiId, deviceId, customerId: musteri.id,
        ticketNumber: `KRN-ESK-${cihazKodu}`, issueText: 'test',
        createdByUserId: yonetici, assignedUserId: eskiUsta, faultCategory: kategori,
        status: 'DELIVERED', createdAt: acilis, statusUpdatedAt: an(damgaGun, 11),
      },
      select: { id: true },
    });
    await p.ticketStatusHistory.create({
      data: { tenantId: bayiId, ticketId: fis.id, status: 'NEW', changedAt: acilis, kaynak: 'GECMIS' },
    });
  };
  await eskiFis({ cihazKodu: 'D11', gun: 5, kategori: 'FUSER', damgaGun: 6 });
  // Durum damgası açılıştan ÖNCE: bozuk kayıt, tarih uydurulmaz.
  await eskiFis({ cihazKodu: 'D12', gun: 7, kategori: 'TONER', damgaGun: 1 });

  // ── ATANMAMIŞ ──────────────────────────────────────────────────────────
  await fisAc({ cihazKodu: 'D9', gun: 17, kategori: 'FUSER', teknisyen: null });

  // ── BAŞKA BAYİ ─────────────────────────────────────────────────────────
  {
    const yb = await p.tenant.create({ data: { name: 'Yabancı Bayi', slug: YABANCI }, select: { id: true } });
    yabanciId = yb.id;
    const ym = await p.customer.create({ data: { tenantId: yabanciId, name: 'Yabancı', phone: '5551110000' }, select: { id: true } });
    const yk = await p.user.create({ data: { tenantId: yabanciId, name: 'Yabancı Usta', email: 'y@karne.test', passwordHash: 'x', role: 'TECHNICIAN' }, select: { id: true } });
    const yc = await p.device.create({
      data: { tenantId: yabanciId, customerId: ym.id, brand: 'Canon', model: 'iR', serialNo: 'Y1', publicCode: 'KRN-Y1', qrTokenHash: 'krn-y1' },
      select: { id: true },
    });
    const yf = await p.serviceTicket.create({
      data: {
        tenantId: yabanciId, deviceId: yc.id, customerId: ym.id, ticketNumber: 'YBN-001',
        issueText: 'test', createdByUserId: yk.id, assignedUserId: yk.id,
        faultCategory: 'FUSER', status: 'READY', createdAt: an(4, 7),
      },
      select: { id: true },
    });
    await p.ticketStatusHistory.createMany({ data: [
      { tenantId: yabanciId, ticketId: yf.id, status: 'NEW', changedAt: an(4, 7), kaynak: 'PANEL' },
      { tenantId: yabanciId, ticketId: yf.id, status: 'READY', changedAt: an(4, 11), kaynak: 'PANEL' },
    ] });
  }

  console.log('\nTeknisyen karnesi uçtan uca\n');
  const r = await karneOlc(bayiId, BAS, SON, SIMDI);
  const bul = (ad) => r.karneler.find((k) => k.teknisyenAdi === ad);

  t('takvim sağlam kuruldu', r.takvimSorunlu === false && r.takvim.zamanDilimi === 'Europe/Istanbul', r.takvim);
  t('tekrar penceresi dışa veriliyor', r.tekrarGun === 30, r.tekrarGun);

  const a = bul('Ali Usta');
  t('★ dönem SONRASI açılan tekrar çağrısı yakalanıyor', a?.tekrar === 2, a);
  t('★ o geri dönüş fişi karnede SAYILMIYOR', a?.fis === 7, a?.fis);
  t('ilk seferde çözülenler sayılıyor', a?.ilkSeferde === 4, a);
  t('★ oran = 4/6, yüzde ölçeğinde', Math.abs((a?.ilkSeferdeYuzde ?? 0) - 400 / 6) < 1e-9, a?.ilkSeferdeYuzde);
  t('★ bekleme süresi dolmamış iş ayrı kutuda', a?.beklemede === 1, a);
  t('müdahale ortancası 60 dk', a?.mudahaleOrtancaDk === 60, a?.mudahaleOrtancaDk);
  t('★ duraklamasız çözüm ortancası 240 dk', a?.cozumOrtancaDk === 240, a?.cozumOrtancaDk);

  const v = bul('Veli Usta');
  t('★ parça beklemesi teknisyenin süresinden düşülüyor (240→180)', v?.cozumOrtancaDk === 180, v?.cozumOrtancaDk);
  t('★ kategorisiz fişler ayrı sayılıyor', v?.kategorisiz === 2, v);
  t('★ sonrası kategorisiz olan fiş BELİRSİZ', v?.belirsiz === 1, v);
  t('planlı ziyaret arıza sayılmıyor', v?.planli === 1 && v?.ariza === 1, v);
  t('★ Veli için oran YAYIMLANMIYOR', v?.ilkSeferdeYuzde === null && v?.oranYok === 'OLCUM_YOK', v);

  const z = bul('Zeynep Usta');
  t('★ hiç iş almamış teknisyen listede', z?.fis === 0, z);

  t('★ atanmamış fiş ayrı satırda', r.atanmamis?.fis === 1, r.atanmamis);
  t('★ atanmamış fiş puanlanmıyor', r.atanmamis?.ilkSeferdeYuzde === null, r.atanmamis);

  t('tekrar listesi iki işi de veriyor', r.tekrarlar.length === 2, r.tekrarlar.map((x) => x.fisNo));
  t('tekrar listesinde ilk fiş ve geri dönüş yan yana',
    r.tekrarlar.some((x) => x.fisNo === t1 && x.tekrarFisNo === t2), r.tekrarlar);
  t('tekrar listesinde cihaz ve müşteri var',
    r.tekrarlar.every((x) => x.cihaz.includes('Kyocera') && x.musteri === 'Karne Müşterisi'), r.tekrarlar[0]);
  t('dönem sonrası tekrarın aradaki günü doğru',
    r.tekrarlar.find((x) => x.fisNo === t3)?.gun === 28, r.tekrarlar.find((x) => x.fisNo === t3));

  const e = bul('Eski Usta');
  t('★ aşama geçmişi olmayan TESLİM EDİLMİŞ fiş "açık" sayılmıyor', e?.acik === 0, e);
  t('★ son durum damgasından hüküm veriliyor', e?.ilkSeferde === 1, e);
  t('★ yaklaşık hükmün sayısı tutuluyor', e?.yaklasik === 1 && r.ozet.yaklasik === 1, [e?.yaklasik, r.ozet.yaklasik]);
  t('★ yaklaşık kapanış SÜRE ölçüsüne girmiyor', e?.cozumOrtancaDk === null, e?.cozumOrtancaDk);
  t('★ damgası açılıştan önce olan bozuk kayıt hüküm almıyor', e?.fis === 2 && e?.ilkSeferde + e?.tekrar === 1, e);

  t('★ başka bayinin teknisyeni karnede yok', !r.karneler.some((k) => k.teknisyenAdi === 'Yabancı Usta'), r.karneler.map((k) => k.teknisyenAdi));
  t('★ başka bayinin fişi toplamda yok', r.ozet.fis === 14, r.ozet.fis);
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
