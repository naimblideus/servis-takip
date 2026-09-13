// KDV ÖZETİ UCU — gerçek veriyle
// Çalıştır:  node scripts/test-kdv-ucu.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Bu rakam muhasebeciye gidiyor. Test ettiğim şey VERİ YOLU — hangi kayıt
// özete giriyor, hangisi girmiyor:
//
//   1. TAHAKKUK: satış tarafı FATURA TARİHİNE göre süzülmeli, tahsilata
//      göre değil. Tahsil edilmemiş faturanın KDV'si de beyan edilir.
//   2. GÖÇ FATURALARI GİRMEMELİ: eski sistemde kesildiler ve orada beyan
//      edildiler. Katmak aynı KDV'yi iki kez beyan etmek olur.
//   3. İPTAL FATURA GİRMEMELİ.
//   4. KDV'Sİ GİRİLMEMİŞ GİDER sessizce atlanmamalı — sayısı söylenmeli.
//   5. GİDER KAYDEDİLİRKEN oran verilirse KDV dahil tutardan AYRILMALI.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const p = new PrismaClient();
const KOK = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

try { await fetch(`${KOK}/api/rozetler`); } catch {
  console.log(`ATLANDI: ${KOK} ayakta değil (önce npm run dev).`);
  await p.$disconnect(); process.exit(0);
}

const SLUG = 'test-kdv-ucu';
const DONEM = '2026-08';
const gun = (d) => new Date(2026, 7, d);

try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  const tenant = await p.tenant.create({
    data: {
      name: SLUG, slug: SLUG,
      users: {
        create: [
          { email: 'kdv@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Y', role: 'ADMIN', isActive: true },
          { email: 'kdv-tek@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'T', role: 'TECHNICIAN', isActive: true },
        ],
      },
    },
  });
  const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'KDV Ofis', phone: '5551110001' } });

  const faturaKur = (no, ek = {}) => p.customerInvoice.create({
    data: {
      tenantId: tenant.id, customerId: musteri.id, invoiceNumber: no,
      period: DONEM, dueDate: gun(30), invoiceDate: gun(15),
      subtotal: 1000, vatRate: 20, vatAmount: 200, totalAmount: 1200,
      status: 'OPEN', ...ek,
    },
  });

  await faturaKur('KDV-1');
  // Tahsil edilmemiş: KDV yine beyan edilir.
  await faturaKur('KDV-2', { status: 'OPEN', paidAmount: 0 });
  // İptal: girmemeli.
  await faturaKur('KDV-IPTAL', { status: 'CANCELLED' });
  // Göçte aktarılan: girmemeli.
  await faturaKur('KDV-DEVIR', { eBelgeDurum: 'ESKI_SISTEM' });
  // Başka dönem: girmemeli.
  await faturaKur('KDV-ESKI', { invoiceDate: new Date(2026, 6, 15), period: '2026-07' });

  async function giris(eposta) {
    const c = await fetch(`${KOK}/api/auth/csrf`);
    const cc = (c.headers.get('set-cookie') || '').split(';')[0];
    const { csrfToken } = await c.json();
    const y = await fetch(`${KOK}/api/auth/callback/credentials`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cc },
      body: new URLSearchParams({ email: eposta, password: 'test1234', csrfToken, redirect: 'false', json: 'true' }),
      redirect: 'manual',
    });
    const cs = [cc];
    for (const x of (y.headers.getSetCookie?.() ?? [])) cs.push(x.split(';')[0]);
    return cs.join('; ');
  }
  const cerez = await giris('kdv@test.local');
  const cerezTek = await giris('kdv-tek@test.local');
  const al = (d = DONEM, ck = cerez) => fetch(`${KOK}/api/kdv?donem=${d}`, { headers: ck ? { cookie: ck } : {} });

  console.log('\nYETKİ\n');
  {
    t('teknisyen okuyamıyor', (await al(DONEM, cerezTek)).status === 403);
    t('girişsiz reddediliyor', [401, 403].includes((await al(DONEM, null)).status));
    t('bozuk dönem reddediliyor', (await al('abc')).status === 400);
  }

  console.log('\n★ HANGİ FATURA ÖZETE GİRİYOR\n');
  {
    const d = await (await al()).json();
    t('iki fatura sayıldı (iptal/devir/eski hariç)', d.satis.adet === 2, d.satis);
    t('★ tahsil edilmemiş faturanın KDVsi de beyan ediliyor', d.satis.kdv === 400, d.satis);
    const nolar = d.faturalar.map((f) => f.no);
    t('iptal fatura yok', !nolar.includes('KDV-IPTAL'), nolar);
    t('★ göçte aktarılan fatura YOK (çift beyan olmasın)', !nolar.includes('KDV-DEVIR'), nolar);
    t('başka dönemin faturası yok', !nolar.includes('KDV-ESKI'), nolar);
  }

  console.log('\n★ GİDER KAYDEDERKEN KDV AYRILIYOR\n');
  {
    // Bayi fişteki TOPLAM rakamı yazıyor; oranı verince KDV ayrılmalı.
    const y = await fetch(`${KOK}/api/expenses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({
        category: 'MALZEME', description: 'Toner alımı', amount: 1180,
        vatRate: 18, date: '2026-08-10', payee: 'Toner A.Ş.', invoiceNo: 'A-555',
      }),
    });
    t('gider kaydedildi', y.ok, await y.text());
    const g = await p.expense.findFirst({ where: { tenantId: tenant.id }, select: { amount: true, vatAmount: true, invoiceNo: true } });
    t('★ 1.180 ₺ · %18 → KDV 180 ₺ ayrıldı', Number(g.vatAmount) === 180, g);
    t('toplam tutar KDV DAHİL kaldı', Number(g.amount) === 1180, g);
    t('fatura no kaydedildi', g.invoiceNo === 'A-555', g);
  }
  {
    // Oran verilmezse KDV UYDURULMAMALI.
    await fetch(`${KOK}/api/expenses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ category: 'KIRA', description: 'Ofis kirası', amount: 5000, date: '2026-08-05' }),
    });
    const g = await p.expense.findFirst({ where: { tenantId: tenant.id, description: 'Ofis kirası' }, select: { vatAmount: true, vatRate: true } });
    t('★ oran yoksa KDV uydurulmuyor', g.vatAmount === null && g.vatRate === null, g);
  }

  console.log('\n★ ÖZET DOĞRU VE EKSİKLERİ SÖYLÜYOR\n');
  {
    const d = await (await al()).json();
    t('alış KDV 180', d.alis.kdv === 180, d.alis);
    t('★ ödenecek 220 (400 − 180)', d.odenecek === 220, d);
    t('devreden 0', d.devreden === 0, d);
    t('★ KDVsi girilmemiş gider sayılıyor (1)', d.kdvsizGider.adet === 1, d.kdvsizGider);
    t('★ tutarı da söyleniyor (5.000)', d.kdvsizGider.tutar === 5000, d.kdvsizGider);
    t('beyanname olmadığı yazıyor', /beyanname değildir/.test(d.kapsamDisi.aciklama), d.kapsamDisi);
  }
  {
    // Alış satıştan büyükse DEVREDEN çıkmalı.
    await fetch(`${KOK}/api/expenses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ category: 'MALZEME', description: 'Büyük alım', amount: 12000, vatRate: 20, date: '2026-08-20' }),
    });
    const d = await (await al()).json();
    t('★ alış fazlaysa ödenecek 0', d.odenecek === 0, d);
    t('★ devreden KDV çıkıyor', d.devreden === 1780, d);
  }

  console.log('\nFATURASIZ FİŞ KAPSAM DIŞI OLDUĞU SÖYLENİYOR\n');
  {
    const kullanici = await p.user.findFirst({ where: { tenantId: tenant.id, role: 'ADMIN' }, select: { id: true } });
    const cihaz = await p.device.create({
      data: {
        tenantId: tenant.id, customerId: musteri.id, brand: 'K', model: 'M',
        serialNo: 'KDV-1', publicCode: 'KDV-1', qrTokenHash: 'x',
      },
    });
    await p.serviceTicket.create({
      data: {
        tenantId: tenant.id, customerId: musteri.id, deviceId: cihaz.id,
        createdByUserId: kullanici.id, ticketNumber: 'KDV-FIS-1',
        issueText: 'Nakit iş', status: 'DELIVERED', totalCost: 500,
        createdAt: gun(12),
      },
    });
    const d = await (await al()).json();
    t('★ faturalanmamış ücretli fiş sayılıyor', d.kapsamDisi.faturasizFis === 1, d.kapsamDisi);
  }

  console.log('\nKOMŞU BAYİ SIZMIYOR\n');
  {
    const komsu = await p.tenant.create({
      data: {
        name: `${SLUG}-k`, slug: `${SLUG}-k`,
        users: { create: { email: 'kdv-k@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'K', role: 'ADMIN', isActive: true } },
      },
    });
    const km = await p.customer.create({ data: { tenantId: komsu.id, name: 'Komsu', phone: '5559990000' } });
    await p.customerInvoice.create({
      data: {
        tenantId: komsu.id, customerId: km.id, invoiceNumber: 'KOMSU-1',
        period: DONEM, dueDate: gun(30), invoiceDate: gun(15),
        subtotal: 99999, vatRate: 20, vatAmount: 19999, totalAmount: 119998, status: 'OPEN',
      },
    });
    const d = await (await al()).json();
    t('komşu bayinin faturası özete girmiyor', d.satis.adet === 2, d.satis);
    await p.tenant.delete({ where: { id: komsu.id } });
  }
} finally {
  for (const sl of [SLUG, `${SLUG}-k`]) {
    const e = await p.tenant.findFirst({ where: { slug: sl } });
    if (e) await p.tenant.delete({ where: { id: e.id } });
  }
  console.log('\n  (temizlik: test bayisi silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
