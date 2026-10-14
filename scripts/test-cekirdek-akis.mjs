// ÇEKİRDEK AKIŞ — bayinin ilk gün dokunduğu uçlar doğru sayı/kayıt üretiyor mu?
// Çalıştır:  node scripts/test-cekirdek-akis.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Pantum etkinliğinden önce yapılan denetimde bulunan, hepsi "sessiz" hatalar:
//   · Müşteri sayfasındaki "Cari Hesap Ekstresi" kutusu tahsilatı "Toplam Borç"
//     diye gösteriyordu (gerçek borç ₺2.230, ekranda ₺1.000 yeşil).
//   · Müşteri portalı yalnız faturaları topluyordu; carisine işlenmiş servis
//     borcu yoktu (bayi ₺2.230, müşteri ₺1.280 görüyordu).
//   · Kullanıcı e-postası yazıldığı gibi saklanıyordu; "Ali@Firma.com" ile
//     "ali@firma.com" aynı bayide iki ayrı kullanıcı olabiliyordu. Kullanıcı
//     düzenleme ucu rolü süzmüyordu (bayi yöneticisi SUPER_ADMIN atayabilirdi).
//   · Yeni müşteri formundaki e-posta kaydedilmiyordu.
//   · Barkoddan açılan fişte müşteri adresi "-" görünüyordu.
//   · Fiş düzenleme yalnız değişen alanı gönderiyor; sunucu da gönderilmeyen
//     tutara dokunmamalı (parça eklenince 950 → 1.900 olan toplam geri dönmesin).
//
// Gerçek veritabanına geçici bir bayi açıp siler; başka veriye dokunmaz.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const KOK = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';
let sunucu = true;
try { await fetch(`${KOK}/api/rozetler`); } catch { sunucu = false; }
if (!sunucu) {
  console.log(`ATLANDI: ${KOK} ayakta değil (önce npm run dev)`);
  process.exit(0);
}

const p = new PrismaClient();
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const SLUG = 'test-cekirdek-akis';
const ADMIN = 'cekirdek-admin@test.local';

async function girisYap(email, sifre) {
  const c = await fetch(`${KOK}/api/auth/csrf`);
  const cc = (c.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await c.json();
  const gy = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cc },
    body: new URLSearchParams({ email, password: sifre, csrfToken, redirect: 'false', json: 'true' }),
    redirect: 'manual',
  });
  const cs = [cc];
  for (const x of (gy.headers.getSetCookie?.() ?? [])) cs.push(x.split(';')[0]);
  return cs.join('; ');
}

try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });
  const tenant = await p.tenant.create({
    data: {
      name: SLUG, slug: SLUG, pricePerBlack: 0.5, pricePerColor: 2, maxUsers: 20,
      users: { create: { email: ADMIN, passwordHash: await bcrypt.hash('test1234', 12), name: 'Yönetici', role: 'ADMIN', isActive: true } },
    },
  });
  const admin = await p.user.findFirst({ where: { tenantId: tenant.id, email: ADMIN } });
  const cerez = await girisYap(ADMIN, 'test1234');
  const istek = (yol, secenek = {}) => fetch(`${KOK}${yol}`, {
    ...secenek,
    headers: { 'Content-Type': 'application/json', cookie: cerez, ...(secenek.headers || {}) },
  });
  const json = (govde, method = 'POST') => ({ method, body: JSON.stringify(govde) });

  // ── Ortak müşteri: servis cari borcu + açık fatura + taslak ──
  const m = await p.customer.create({
    data: {
      tenantId: tenant.id, name: 'Çekirdek Kırtasiye', phone: '05001112233', address: 'Büyükdere Cad. 12 Şişli',
      portalEnabled: true, portalToken: 'c'.repeat(64),
    },
  });
  // Teslim edilip carisine işlenmiş servis: 1.000 borç, 50 tahsilat → 950 (faturaya DÖNÜŞMEDİ)
  await p.accountEntry.create({ data: { tenantId: tenant.id, customerId: m.id, type: 'SALE', amount: 1000, product: 'Servis TSK-1', date: new Date('2026-10-01') } });
  await p.accountEntry.create({ data: { tenantId: tenant.id, customerId: m.id, type: 'PAYMENT', amount: 50, date: new Date('2026-10-02') } });
  // Kira faturası: 1.280 açık
  await p.customerInvoice.create({ data: {
    tenantId: tenant.id, customerId: m.id, invoiceNumber: 'CK-001', period: '2026-09',
    dueDate: new Date('2026-10-30'), status: 'OPEN', totalAmount: 1280, paidAmount: 0, invoiceDate: new Date('2026-10-01'),
  } });
  // Taslak: henüz kesilmedi, borç DEĞİL
  await p.customerInvoice.create({ data: {
    tenantId: tenant.id, customerId: m.id, invoiceNumber: 'CK-002', period: '2026-10',
    dueDate: new Date('2026-11-30'), status: 'DRAFT', totalAmount: 5000, paidAmount: 0, invoiceDate: new Date('2026-10-10'),
  } });

  console.log('\n★ CARİ HESAP EKSTRESİ KUTUSU = BASILI EKSTRE\n');
  {
    const r = await istek(`/api/accounting/customer/${m.id}`);
    const d = await r.json();
    const mu = await (await istek(`/api/muhasebe/customer/${m.id}`)).json();
    t('uç yanıt verdi', r.ok && d.balance, d);
    t('★ toplam borç = servis 1.000 + fatura 1.280 (taslak sayılmıyor)', d.balance?.borc === 2280, d.balance);
    t('toplam tahsilat = 50', d.balance?.alacak === 50, d.balance);
    t('★ kalan = 2.230 (denetimdeki gerçek borç)', d.balance?.kalan === 2230, d.balance);
    t('★ muhasebe ekranının birleşik bakiyesiyle aynı sayı', mu.summary?.balance === d.balance?.kalan, { kutu: d.balance?.kalan, muhasebe: mu.summary?.balance });
    const ek = mu.ekstre || [];
    const borc = ek.filter((s) => s.tip === 'BORC').reduce((a, s) => a + s.tutar, 0);
    const alacak = ek.filter((s) => s.tip === 'ODEME').reduce((a, s) => a + s.tutar, 0);
    t('basılı ekstrenin satırlarıyla aynı toplamlar', borc === d.balance?.borc && alacak === d.balance?.alacak, { borc, alacak });
  }

  console.log('\n★ MÜŞTERİ PORTALI BAKİYESİ = BAYİNİN EKSTRESİ\n');
  {
    const r = await fetch(`${KOK}/m/${'c'.repeat(64)}`);
    const html = await r.text();
    const tutar = (html.match(/text-3xl font-bold tabular-nums[^"]*">([^<]+)</) || [])[1] || '';
    t('portal açıldı', r.ok, r.status);
    t('★ portal 2.230 gösteriyor (servis cari borcu dahil, taslak hariç)', /2\.230,00/.test(tutar), tutar);
    t('eski hatalı sayı (yalnız fatura: 1.280) bakiye olarak görünmüyor', !/1\.280,00/.test(tutar), tutar);
  }

  console.log('\n★ KULLANICI E-POSTASI: küçük harf + harf duyarsız tekrar kontrolü\n');
  {
    const y1 = await istek('/api/users', json({ name: 'Ali', email: '  Ali@Firma.COM ', password: 'test1234', role: 'TECHNICIAN' }));
    const d1 = await y1.json();
    t('kullanıcı eklendi', y1.ok, d1);
    const kayit = await p.user.findFirst({ where: { tenantId: tenant.id, name: 'Ali' } });
    t('★ e-posta küçük harfle ve boşluksuz saklandı', kayit?.email === 'ali@firma.com', kayit?.email);
    const y2 = await istek('/api/users', json({ name: 'Ali 2', email: 'ali@firma.com', password: 'test1234' }));
    t('aynı e-posta ikinci kez eklenemiyor', y2.status === 400, y2.status);
    const y3 = await istek('/api/users', json({ name: 'Ali 3', email: 'ALI@FIRMA.COM', password: 'test1234' }));
    t('★ büyük harfli hâli de eklenemiyor', y3.status === 400, y3.status);
    // Eski kayıt karışık harfle saklanmış olabilir
    await p.user.create({ data: { tenantId: tenant.id, email: 'Eski@Firma.com', passwordHash: 'x', name: 'Eski', role: 'TECHNICIAN', isActive: true } });
    const y4 = await istek('/api/users', json({ name: 'Eski 2', email: 'eski@firma.com', password: 'test1234' }));
    t('★ karışık harfle saklanmış ESKİ kayıtla da çakışma yakalanıyor', y4.status === 400, y4.status);
    // ILIKE tuzağı: "_" joker olsaydı a_b@ axb@'yi engellerdi
    const y5 = await istek('/api/users', json({ name: 'AltÇizgi', email: 'a_b@firma.com', password: 'test1234' }));
    const y6 = await istek('/api/users', json({ name: 'Axb', email: 'axb@firma.com', password: 'test1234' }));
    t('★ "_" joker değil: a_b@ varken axb@ eklenebiliyor', y5.ok && y6.ok, [y5.status, y6.status]);

    const axb = await p.user.findFirst({ where: { tenantId: tenant.id, email: 'axb@firma.com' } });
    const p1 = await istek(`/api/users/${axb.id}`, json({ email: 'A_B@Firma.com' }, 'PATCH'));
    t('düzenlemede başka kullanıcının e-postası (harf farkıyla) alınamıyor', p1.status === 400, p1.status);
    const p2 = await istek(`/api/users/${axb.id}`, json({ email: ' Yeni@Firma.COM' }, 'PATCH'));
    const axb2 = await p.user.findFirst({ where: { id: axb.id } });
    t('düzenlemede e-posta küçük harfle saklanıyor', p2.ok && axb2.email === 'yeni@firma.com', [p2.status, axb2.email]);
    const p3 = await istek(`/api/users/${axb.id}`, json({ email: 'yeni@firma.com', name: 'Axb Yeni' }, 'PATCH'));
    t('kendi e-postasıyla kaydetmek çakışma sayılmıyor', p3.ok, p3.status);

    console.log('\n★ ROL YÜKSELTME KAPALI\n');
    const p4 = await istek(`/api/users/${axb.id}`, json({ role: 'SUPER_ADMIN' }, 'PATCH'));
    const axb3 = await p.user.findFirst({ where: { id: axb.id } });
    t('★ bayi yöneticisi SUPER_ADMIN atayamıyor', p4.status === 403 && axb3.role === 'TECHNICIAN', [p4.status, axb3.role]);
    const p5 = await istek(`/api/users/${axb.id}`, json({ role: 'FRONT_DESK', name: 'Axb' }, 'PATCH'));
    const axb4 = await p.user.findFirst({ where: { id: axb.id } });
    t('bayi içi rol değişikliği çalışıyor', p5.ok && axb4.role === 'FRONT_DESK', [p5.status, axb4.role]);
    const p6 = await istek(`/api/users/${admin.id}`, json({ name: 'Yönetici', email: ADMIN, role: 'ADMIN' }, 'PATCH'));
    t('rol değişmeden kaydetmek (ekran hep gönderir) çalışıyor', p6.ok, p6.status);
  }

  console.log('\nYENİ MÜŞTERİ E-POSTASI KAYDEDİLİYOR\n');
  {
    const r = await istek('/api/customers', json({ name: 'E-postalı Müşteri', phone: '05009998877', email: ' Muhasebe@Ornek.COM ' }));
    const d = await r.json();
    const k = await p.customer.findFirst({ where: { id: d.id } });
    t('★ e-posta yazıldı (eskiden sessizce düşüyordu), küçük harfle', k?.email === 'muhasebe@ornek.com', k?.email);
    const r2 = await istek('/api/customers', json({ name: 'E-postasız', phone: '05009998866', email: '   ' }));
    const k2 = await p.customer.findFirst({ where: { id: (await r2.json()).id } });
    t('boş e-posta null kalıyor (boş metin değil)', k2?.email === null, k2?.email);
  }

  console.log('\nBARKODDAN AÇILAN FİŞTE MÜŞTERİ ADRESİ\n');
  {
    const cihaz = await p.device.create({ data: { tenantId: tenant.id, customerId: m.id, brand: 'Pantum', model: 'M7100DW', serialNo: 'CEKIRDEK-SN-1' } });
    const d = await (await istek('/api/devices/lookup?code=CEKIRDEK-SN-1')).json();
    t('★ arama müşteri adresini döndürüyor', d.customer?.address === 'Büyükdere Cad. 12 Şişli', d.customer);

    console.log('\nFİŞ: gönderilmeyen tutara sunucu dokunmuyor\n');
    const fis = await p.serviceTicket.create({ data: {
      tenantId: tenant.id, deviceId: cihaz.id, customerId: m.id, ticketNumber: 'CK-TSK-1',
      createdByUserId: admin.id, issueText: 'Toner bitti', totalCost: 950,
    } });
    await istek(`/api/tickets/${fis.id}`, json({ totalCost: 1900 }, 'PATCH'));   // parça paneli
    await istek(`/api/tickets/${fis.id}`, json({ actionText: 'İkinci toner takıldı' }, 'PATCH')); // düzenle → kaydet
    const son = await p.serviceTicket.findFirst({ where: { id: fis.id }, select: { totalCost: true, actionText: true } });
    t('★ yalnız "Yapılan İşlem" kaydı toplamı 1.900\'de bırakıyor', Number(son.totalCost) === 1900 && son.actionText === 'İkinci toner takıldı', son);
  }
} catch (e) {
  kaldi++;
  console.log(`  ✗ beklenmeyen hata: ${e?.stack || e}`);
} finally {
  const e = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (e) await p.tenant.delete({ where: { id: e.id } });
  console.log('\n  (temizlik: test bayisi silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
