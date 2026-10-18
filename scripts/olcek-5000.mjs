// ÖLÇEK — 5.000 makinelik bayi gerçekte ne hissediyor?
//
// Çalıştır (önce sunucu: `npm run build && npx next start -p 3002` ya da `npm run dev`):
//   node scripts/olcek-5000.mjs [cihaz=5000] [sunucu=http://localhost:3002] [--birak]
//
// NE YAPAR
//  1. Yerel veritabanına geçici bir bayi kurar: 300 müşteri, N kiralık cihaz
//     (fiyatlı, dahil sayfalı), cihaz başına 12 aylık sayaç, 2.000 servis fişi,
//     20 teknisyen, 3.000 toner değişimi, 300 sözleşme. Bu ayın sayaçları
//     faturalanmamış: fatura ön kontrolü gerçekten N cihazı tarar.
//  2. O bayinin yöneticisiyle sunucuya girer. Şifre bu çalıştırmada rastgele
//     üretilir, hiçbir yere yazılmaz, yalnız bellekte durur.
//  3. Ekranları ve veri uçlarını 1 ısınma + 3 ölçüm çağrısıyla dener; ortanca
//     süreyi, yanıt boyunu ve durum kodunu yazar.
//  4. Sonunda bayiyi siler (--birak verilirse bırakır, adı ekrana basılır).
//
// NEDEN: "5.000 makineyi destekliyoruz" cümlesi ancak ölçülmüşse söylenir.
// Yalnız YEREL veritabanında çalışır (localhost dışında durur).
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(KOK, 'package.json'));
const argv = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ADET = parseInt(argv[0] || '5000', 10);
const SUNUCU = argv[1] || 'http://localhost:3002';
const BIRAK = process.argv.includes('--birak');

const url = process.env.DATABASE_URL || (readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x)) || '').replace(/^\s*DATABASE_URL\s*=\s*/, '').replace(/^"|"$/g, '');
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error('Yalnız yerel veritabanında çalışır.'); process.exit(2); }
process.env.DATABASE_URL = url;

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

const SLUG = 'olcek-5000';
const GUN = 86_400_000;
const simdi = new Date();
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const kimlik = () => 'c' + randomBytes(11).toString('hex');
const parca = (dizi, n) => { const o = []; for (let i = 0; i < dizi.length; i += n) o.push(dizi.slice(i, i + n)); return o; };
const sure = async (ad, fn) => { const t = Date.now(); const r = await fn(); console.log(`  ${ad.padEnd(34)} ${String(Date.now() - t).padStart(6)} ms`); return r; };

async function temizle() {
  const t = await p.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } });
  if (!t) return;
  await p.serviceTicket.deleteMany({ where: { tenantId: t.id } });
  await p.tenant.delete({ where: { id: t.id } });
}

async function kur(sifre) {
  await temizle();
  console.log(`\nKurulum — ${ADET} cihaz\n`);
  const tenant = await sure('bayi + yönetici', () => p.tenant.create({
    data: {
      name: 'Ölçek 5000 (geçici)', slug: SLUG, plan: 'enterprise', pricePerBlack: 0.30, pricePerColor: 1.20,
      maxUsers: 50,
      users: { create: { email: 'olcek@test.local', passwordHash: bcrypt.hashSync(sifre, 10), name: 'Ölçek Yönetici', role: 'ADMIN', isActive: true, onboardedAt: simdi } },
    },
    select: { id: true, users: { select: { id: true } } },
  }));
  const tid = tenant.id, yoneticiId = tenant.users[0].id;

  const teknisyenler = Array.from({ length: 20 }, (_, i) => ({ id: kimlik(), tenantId: tid, email: `tek${i}@test.local`, passwordHash: 'x', name: `Teknisyen ${i + 1}`, role: 'TECHNICIAN', isActive: true, onboardedAt: simdi }));
  await sure('20 teknisyen', () => p.user.createMany({ data: teknisyenler }));

  const musteriler = Array.from({ length: 300 }, (_, i) => ({ id: kimlik(), tenantId: tid, name: `Müşteri ${String(i + 1).padStart(3, '0')} A.Ş.`, phone: `5${String(300000000 + i).padStart(9, '0')}`, city: 'İstanbul' }));
  await sure('300 müşteri', () => p.customer.createMany({ data: musteriler }));

  const markalar = [['Kyocera', 'M2540dn', false], ['Kyocera', 'TASKalfa 2554ci', true], ['Canon', 'iR-ADV C3530', true], ['Ricoh', 'MP 2555', false], ['Pantum', 'M7300FDW', false], ['HP', 'LaserJet M430', false]];
  const cihazlar = Array.from({ length: ADET }, (_, i) => {
    const [brand, model, renkli] = markalar[i % markalar.length];
    return {
      id: kimlik(), tenantId: tid, customerId: musteriler[i % musteriler.length].id, brand, model,
      serialNo: `OLC${String(i).padStart(6, '0')}`, publicCode: `OLC-${randomBytes(5).toString('hex')}`, qrTokenHash: randomBytes(16).toString('hex'),
      isRental: true, monthlyRent: renkli ? 1800 : 900, includedBlack: renkli ? 2000 : 1000, includedColor: renkli ? 500 : 0,
      pricePerBlack: 0.30, pricePerColor: renkli ? 1.20 : null, overagePriceBlack: 0.35, overagePriceColor: renkli ? 1.40 : null,
      installedAt: new Date(simdi.getTime() - rnd(200, 2000) * GUN), installedAtPrecision: 'DAY',
      tonerYieldBlack: 7200, counterBlack: 0, counterColor: 0,
      olcumAt: i % 3 === 0 ? new Date(simdi.getTime() - rnd(0, 3) * GUN) : null,
      olcumSiyah: i % 3 === 0 ? rnd(2, 95) : null,
      cihazUyarilari: i % 97 === 0 ? ['SIKISMA'] : [],
    };
  });
  await sure(`${ADET} cihaz`, async () => { for (const c of parca(cihazlar, 1000)) await p.device.createMany({ data: c }); });

  // 12 aylık sayaç: her ay bir okuma, son okuma bu ay (faturalanmamış).
  const okumalar = [];
  const sonSayac = new Map();
  for (const c of cihazlar) {
    const renkli = c.includedColor > 0;
    let s = rnd(20_000, 400_000), r = renkli ? rnd(5_000, 120_000) : 0;
    for (let ay = 11; ay >= 0; ay--) {
      const db = rnd(400, 7000), dr = renkli ? rnd(50, 2500) : 0;
      s += db; r += dr;
      okumalar.push({ id: kimlik(), tenantId: tid, deviceId: c.id, readingDate: new Date(simdi.getTime() - (ay * 30 + rnd(0, 3)) * GUN), counterBlack: s, counterColor: r, deltaBlack: db, deltaColor: dr, billed: ay > 0, source: ay % 2 ? 'CIHAZ_EPOSTA' : 'ELLE' });
    }
    sonSayac.set(c.id, [s, r]);
  }
  await sure(`${okumalar.length} sayaç okuması`, async () => { for (const c of parca(okumalar, 5000)) await p.counterReading.createMany({ data: c }); });
  await sure('cihaz son sayaçları', () => p.$executeRaw`
    UPDATE "Device" d SET "counterBlack" = x.s, "counterColor" = x.r
    FROM (SELECT DISTINCT ON ("deviceId") "deviceId", "counterBlack" AS s, "counterColor" AS r
          FROM "CounterReading" WHERE "tenantId" = ${tid} ORDER BY "deviceId", "readingDate" DESC) x
    WHERE d.id = x."deviceId"`);

  const durumlar = ['DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'NEW', 'IN_SERVICE', 'WAITING_FOR_PART', 'READY'];
  const kategoriler = ['PAPER_JAM', 'PRINT_QUALITY', 'TONER', 'OTHER'];
  const fisler = Array.from({ length: 2000 }, (_, i) => {
    const c = cihazlar[rnd(0, cihazlar.length - 1)];
    const t = new Date(simdi.getTime() - rnd(0, 360) * GUN);
    return { id: kimlik(), tenantId: tid, deviceId: c.id, customerId: c.customerId, ticketNumber: `TSK-OLC-${String(i + 1).padStart(5, '0')}`, status: durumlar[i % durumlar.length], priority: 'NORMAL', assignedUserId: teknisyenler[i % 20].id, createdByUserId: yoneticiId, issueText: 'Ölçek testi arıza kaydı', faultCategory: kategoriler[i % kategoriler.length], createdAt: t, statusUpdatedAt: t };
  });
  await sure('2.000 servis fişi', () => p.serviceTicket.createMany({ data: fisler }));

  const degisimler = [];
  for (const c of cihazlar.slice(0, 1500)) {
    const [s] = sonSayac.get(c.id);
    degisimler.push({ id: kimlik(), tenantId: tid, deviceId: c.id, channel: 'BLACK', counterValue: s - 14000, changedAt: new Date(simdi.getTime() - 120 * GUN), source: 'TARAYICI' });
    degisimler.push({ id: kimlik(), tenantId: tid, deviceId: c.id, channel: 'BLACK', counterValue: s - 6500, changedAt: new Date(simdi.getTime() - 40 * GUN), observedYield: 7500, source: 'TARAYICI' });
  }
  await sure('3.000 toner değişimi', () => p.tonerChange.createMany({ data: degisimler }));

  const sozlesmeler = musteriler.map((m, i) => ({ id: kimlik(), tenantId: tid, customerId: m.id, contractNo: `SZ-${i + 1}`, startDate: new Date(simdi.getTime() - 300 * GUN), endDate: new Date(simdi.getTime() + rnd(10, 700) * GUN), noticeDays: 30, autoRenew: i % 2 === 0, escalationMonths: 12, escalationRate: 25, slaResponseMins: 240, slaResolutionMins: 1440 }));
  await sure('300 sözleşme', () => p.contract.createMany({ data: sozlesmeler }));
  const sozMusteri = new Map(sozlesmeler.map((s) => [s.customerId, s.id]));
  const sc = cihazlar.map((c) => ({ id: kimlik(), tenantId: tid, contractId: sozMusteri.get(c.customerId), deviceId: c.id, monthlyRent: c.monthlyRent }));
  await sure(`${sc.length} sözleşme cihazı`, async () => { for (const c of parca(sc, 2000)) await p.contractDevice.createMany({ data: c }); });
  return tid;
}

async function gir(sifre) {
  const c = await fetch(`${SUNUCU}/api/auth/csrf`);
  const cc = (c.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await c.json();
  const g = await fetch(`${SUNUCU}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cc },
    body: new URLSearchParams({ email: 'olcek@test.local', password: sifre, csrfToken, redirect: 'false', json: 'true' }),
    redirect: 'manual',
  });
  const cs = [cc];
  for (const x of (g.headers.getSetCookie?.() ?? [])) cs.push(x.split(';')[0]);
  const cerez = cs.join('; ');
  if (!/session-token/.test(cerez)) throw new Error('giriş olmadı');
  return cerez;
}

const SAYFALAR = ['/dashboard', '/devices', '/tickets', '/customers', '/filo', '/kacan-gelir', '/sarf', '/takip', '/invoices', '/reports', '/cihaz-karlilik', '/toner-verimi', '/bakim', '/sla', '/teknisyen', '/sayac-turu', '/emanet', '/parca-omru', '/pano', '/gelecek-gelir', '/memnuniyet'];
// Yalnız GET uçları (toner-sevk ve memnuniyet/[id] yazma uçları; listede yok).
const UCLAR = ['/api/dashboard/stats', '/api/customers', '/api/filo', '/api/revenue-risk', '/api/sayac/supheli', '/api/toner', '/api/maintenance', '/api/invoices', '/api/invoices/preflight', '/api/reports', '/api/reports/device-profit', '/api/devices/toner-verimi', '/api/bakim', '/api/sla', '/api/teknisyen', '/api/sayac/eksik', '/api/sayac/durgun', '/api/inventory', '/api/kacan-toner', '/api/emanet', '/api/parca-omru', '/api/pano', '/api/gelecek-gelir'];

async function olc(cerez) {
  console.log(`\nÖlçüm — ${SUNUCU} (1 ısınma + 3 çağrı, ortanca)\n`);
  const sonuc = [];
  for (const yol of [...SAYFALAR, ...UCLAR]) {
    const sureler = []; let durum = 0, boy = 0;
    for (let i = 0; i < 4; i++) {
      const t = performance.now();
      const r = await fetch(SUNUCU + yol, { headers: { cookie: cerez }, redirect: 'manual' });
      const govde = await r.arrayBuffer();
      if (i > 0) sureler.push(performance.now() - t);
      durum = r.status; boy = govde.byteLength;
    }
    sureler.sort((a, b) => a - b);
    const ort = Math.round(sureler[1]);
    sonuc.push({ yol, ort, durum, boy });
    const isaret = durum === 404 ? '—' : durum >= 400 ? '✗' : ort > 3000 ? '⚠' : '✓';
    console.log(`  ${isaret} ${yol.padEnd(30)} ${String(ort).padStart(6)} ms  ${String(durum).padStart(3)}  ${(boy / 1024).toFixed(0).padStart(6)} KB`);
  }
  const yavas = sonuc.filter((s) => s.durum < 400 && s.ort > 3000);
  const hata = sonuc.filter((s) => s.durum >= 400 && s.durum !== 404);
  console.log(`\n${sonuc.length - yavas.length - hata.length} hızlı, ${yavas.length} yavaş (>3 sn), ${hata.length} hata`);
  return { yavas, hata };
}

try {
  const sifre = randomBytes(12).toString('base64url');
  await kur(sifre);
  const cerez = await gir(sifre);
  await olc(cerez);
} finally {
  if (BIRAK) console.log(`\nBayi bırakıldı: ${SLUG}`);
  else { await temizle(); console.log('\nGeçici bayi silindi.'); }
  await p.$disconnect();
}
