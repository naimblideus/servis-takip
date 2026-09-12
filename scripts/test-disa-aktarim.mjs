// ÇEKİRDEK LİSTELERİN DIŞA AKTARIMI — müşteri, cihaz, fiş, cari
// Çalıştır:  node scripts/test-disa-aktarim.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Dışa aktarım "dosya indi" ile bitmiyor. Bayi bu dosyayı muhasebecisine
// gönderiyor; içindeki rakam ekrandakinden farklıysa bunu ne bayi ne
// muhasebeci fark eder, ikisi de dosyaya inanır. Test ettiğim şeyler:
//
//   1. BORÇ EKRANLA AYNI OLMALI. İki ayrı defter var (servis + kira/sayaç);
//      dışa aktarım ekranla aynı kaynaktan toplamazsa iki farklı borç çıkar.
//   2. OKUNMAMIŞ SAYAÇ SIFIR YAZILMAMALI. Sıfır yazmak "cihaz hiç basmamış"
//      demek; o cihaz geri yüklenirse bir sonraki fatura sayfaları kaybeder.
//   3. BAŞKA BAYİNİN VERİSİ SIZMAMALI.
//   4. KESİLEN LİSTE TAM SANILMAMALI.
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

const SLUG = 'test-disa-aktarim';
const SLUG2 = 'test-disa-aktarim-komsu';

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

/** Ham bayt + çözülmüş metin: BOM metin okumada kırpılıyor. */
async function indir(tur, cerez) {
  const y = await fetch(`${KOK}/api/disa-aktar?tur=${tur}`, { headers: cerez ? { cookie: cerez } : {} });
  const bayt = Buffer.from(await y.arrayBuffer());
  return { y, bayt, metin: bayt.toString('utf8') };
}

/** Noktalı virgüle böl, ama tırnak içindekini bölme. */
function alanlar(satir) {
  const out = []; let cur = ''; let tirnakta = false;
  for (let i = 0; i < satir.length; i++) {
    const ch = satir[i];
    if (ch === '"') {
      if (tirnakta && satir[i + 1] === '"') { cur += '"'; i++; }
      else tirnakta = !tirnakta;
    } else if (ch === ';' && !tirnakta) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

try {
  for (const s of [SLUG, SLUG2]) {
    const e = await p.tenant.findFirst({ where: { slug: s } });
    if (e) await p.tenant.delete({ where: { id: e.id } });
  }

  const tenant = await p.tenant.create({
    data: {
      name: 'Dışa; Aktarım A.Ş.', slug: SLUG, pricePerBlack: 0.5, pricePerColor: 2,
      users: { create: { email: 'disa@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'T', role: 'ADMIN', isActive: true } },
    },
  });
  const kullanici = await p.user.findFirst({ where: { tenantId: tenant.id }, select: { id: true } });

  // Adında noktalı virgül olan müşteri — sütun kaymasını burası yakalar.
  const musteri = await p.customer.create({
    data: {
      tenantId: tenant.id, name: 'ABC Ltd; Şti', phone: '5551110001',
      legalName: 'ABC Kırtasiye Tic. Ltd. Şti.', taxNo: '1234567890',
      taxOffice: 'Mecidiyeköy', city: 'İstanbul', district: 'Şişli',
      address: 'Büyükdere Cad. 12', eInvoiceUser: true, email: 'a@abc.com',
    },
  });
  const eksikMusteri = await p.customer.create({
    data: { tenantId: tenant.id, name: 'Eksik Müşteri', phone: '5551110002' },
  });

  const cihaz = await p.device.create({
    data: {
      tenantId: tenant.id, customerId: musteri.id, brand: 'Kyocera', model: 'M2540',
      serialNo: 'DSA-0001', isRental: true, monthlyRent: 1500, includedBlack: 1000,
      pricePerBlack: 0.45, counterBlack: 12000, publicCode: 'DSA-1', qrTokenHash: 'x',
    },
  });
  // Hiç okunmamış cihaz: sayacı BOŞ kalmalı, sıfır yazılmamalı.
  await p.device.create({
    data: {
      tenantId: tenant.id, customerId: eksikMusteri.id, brand: 'Canon', model: 'iR1643',
      serialNo: 'DSA-0002', isRental: false, publicCode: 'DSA-2', qrTokenHash: 'x',
    },
  });
  await p.counterReading.create({
    data: {
      tenantId: tenant.id, deviceId: cihaz.id, counterBlack: 12000, counterColor: 0,
      deltaBlack: 500, deltaColor: 0, calculatedCost: 225, billed: false,
      source: 'ELLE', readingDate: new Date('2026-09-01'),
    },
  });
  await p.serviceTicket.create({
    data: {
      tenantId: tenant.id, customerId: musteri.id, deviceId: cihaz.id,
      createdByUserId: kullanici.id, assignedUserId: kullanici.id,
      ticketNumber: 'DSA-0001', issueText: 'Kağıt sıkışması', actionText: 'Temizlendi',
      status: 'DELIVERED', priority: 'HIGH', paymentStatus: 'REFUNDED',
      laborCost: 250, totalCost: 750,
    },
  });
  // İki defter: servis (AccountEntry) + kira/sayaç (CustomerInvoice).
  await p.accountEntry.create({
    data: { tenantId: tenant.id, customerId: musteri.id, type: 'SALE', product: 'Toner', amount: 1000, method: 'CASH' },
  });
  await p.accountEntry.create({
    data: { tenantId: tenant.id, customerId: musteri.id, type: 'PAYMENT', amount: 400, method: 'CASH' },
  });
  await p.customerInvoice.create({
    data: {
      tenantId: tenant.id, customerId: musteri.id, invoiceNumber: 'DSA-FAT-0001',
      period: '2026-08',
      dueDate: new Date('2026-09-10'),
      subtotal: 1500, vatRate: 20, vatAmount: 300, totalAmount: 1800,
      paidAmount: 300, status: 'PARTIAL',
    },
  });

  // Komşu bayi — sızıntı testi
  const komsu = await p.tenant.create({
    data: {
      name: SLUG2, slug: SLUG2,
      users: { create: { email: 'komsu@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'K', role: 'ADMIN', isActive: true } },
    },
  });
  await p.customer.create({ data: { tenantId: komsu.id, name: 'KOMSU GIZLI MUSTERI', phone: '5559990000' } });

  const cerez = await giris('disa@test.local');

  console.log('\nGİRİŞSİZ İNDİRİLEMİYOR\n');
  for (const tur of ['musteri', 'cihaz', 'fis', 'cari']) {
    const { y } = await indir(tur, null);
    t(`${tur}: girişsiz reddediliyor`, y.status === 401 || y.status === 403, y.status);
  }

  console.log('\nDÖRT LİSTE DE TÜRKÇE EXCEL BİÇİMİNDE\n');
  for (const tur of ['musteri', 'cihaz', 'fis', 'cari']) {
    const { y, bayt, metin } = await indir(tur, cerez);
    t(`${tur}: 200 dönüyor`, y.ok, y.status);
    t(`${tur}: BOM ile başlıyor`, bayt[0] === 0xEF && bayt[1] === 0xBB && bayt[2] === 0xBF, [...bayt.slice(0, 3)]);
    t(`${tur}: indirme başlığı var`, (y.headers.get('content-disposition') || '').includes('attachment'), y.headers.get('content-disposition'));
    t(`${tur}: noktalı virgülle ayrılmış`, metin.includes(';'), metin.slice(0, 50));
    t(`${tur}: satır sonu CRLF`, metin.includes('\r\n'), true);
  }
  {
    const { y } = await indir('boyle-bir-liste-yok', cerez);
    t('bilinmeyen liste reddediliyor', y.status === 400, y.status);
  }

  console.log('\n★ ALAN KAÇIRMA — NOKTALI VİRGÜLLÜ MÜŞTERİ ADI SÜTUN KAYDIRMIYOR\n');
  {
    const { metin } = await indir('musteri', cerez);
    const satir = metin.split('\r\n').find((x) => x.includes('ABC'));
    const a = alanlar(satir);
    t('müşteri adı tek hücrede', a[0] === 'ABC Ltd; Şti', a.slice(0, 3));
    t('sonraki sütun kaymadı (unvan yerinde)', a[1] === 'ABC Kırtasiye Tic. Ltd. Şti.', a.slice(0, 3));
    t('telefon yerinde', a[2] === '5551110001', a.slice(0, 4));
  }

  console.log('\n★ BORÇ EKRANLA AYNI KAYNAKTAN\n');
  {
    // Servis: 1000 satış - 400 ödeme = 600
    // Fatura: 1800 toplam - 300 ödenen = 1500 (PARTIAL = hâlâ açık)
    // Toplam: 2100
    const { metin } = await indir('cari', cerez);
    const satir = metin.split('\r\n').find((x) => x.includes('ABC'));
    const a = alanlar(satir);
    t('servis borcu 600,00', a[4] === '600,00', a);
    t('kira/sayaç borcu 1500,00', a[5] === '1500,00', a);
    t('★ toplam 2100,00 (iki defter toplanmış)', a[6] === '2100,00', a);
    t('faturadaki ad tescilli unvan', a[1] === 'ABC Kırtasiye Tic. Ltd. Şti.', a);

    // Aynı rakam müşteri listesinde de çıkmalı.
    const { metin: m2 } = await indir('musteri', cerez);
    const a2 = alanlar(m2.split('\r\n').find((x) => x.includes('ABC')));
    t('★ müşteri listesindeki borç cari ile aynı', a2[11] === '2100,00', a2[11]);
    // Borcu olmayan müşteri 0 görünmeli, boş değil.
    const a3 = alanlar(m2.split('\r\n').find((x) => x.includes('Eksik Müşteri')));
    t('borçsuz müşteri 0,00 yazıyor', a3[11] === '0,00', a3[11]);
  }

  console.log('\nFATURA HAZIRLIĞI DA DOSYADA\n');
  {
    const { metin } = await indir('musteri', cerez);
    const a = alanlar(metin.split('\r\n').find((x) => x.includes('ABC')));
    const b = alanlar(metin.split('\r\n').find((x) => x.includes('Eksik Müşteri')));
    t('hazır müşteride yol e-Fatura', a[12] === 'e-Fatura', a[12]);
    t('hazır müşteride eksik yok', a[13] === '', a[13]);
    t('eksik müşteride yol bilinmiyor', b[12] === 'bilinmiyor', b[12]);
    t('eksik müşteride eksikler sayılmış', /Vergi no/.test(b[13]) && /İl yok/.test(b[13]), b[13]);
  }

  console.log('\n★ OKUNMAMIŞ SAYAÇ SIFIR YAZILMIYOR\n');
  {
    const { metin } = await indir('cihaz', cerez);
    const okunan = alanlar(metin.split('\r\n').find((x) => x.includes('DSA-0001')));
    const okunmayan = alanlar(metin.split('\r\n').find((x) => x.includes('DSA-0002')));
    t('okunan cihazın sayacı yazıyor', okunan[12] === '12000', okunan);
    t('★ hiç okunmamış cihazın sayacı BOŞ (0 değil)', okunmayan[12] === '', okunmayan);
    t('son okuma tarihi yazıyor', okunan[14] === '01.09.2026', okunan[14]);
    t('okunmamış cihazda tarih de boş', okunmayan[14] === '', okunmayan[14]);
    t('kiralık/değil doğru', okunan[6] === 'Evet' && okunmayan[6] === 'Hayır', [okunan[6], okunmayan[6]]);
    t('birim fiyat 4 basamak, ondalık virgül', okunan[10] === '0,4500', okunan[10]);
    t('cihaz fiyatı boşsa boş kalıyor (bayi varsayılanı)', okunmayan[10] === '', okunmayan[10]);
  }

  console.log('\nFİŞ LİSTESİ OKUNABİLİR\n');
  {
    const { metin } = await indir('fis', cerez);
    const a = alanlar(metin.split('\r\n').find((x) => x.includes('DSA-0001')));
    t('müşteri adı cihaz üzerinden geliyor', a[2] === 'ABC Ltd; Şti', a);
    t('cihaz marka+model', a[3] === 'Kyocera M2540', a[3]);
    t('durum Türkçe', a[6] === 'Teslim', a[6]);
    t('öncelik Türkçe', a[7] === 'Yüksek', a[7]);
    t('★ REFUNDED ham İngilizce değil', a[8] === 'İade', a[8]);
    t('işçilik ve tutar ayrı', a[11] === '250,00' && a[12] === '750,00', [a[11], a[12]]);
  }

  console.log('\n★ KOMŞU BAYİNİN VERİSİ SIZMIYOR\n');
  for (const tur of ['musteri', 'cihaz', 'fis', 'cari']) {
    const { metin } = await indir(tur, cerez);
    t(`${tur}: komşu bayi görünmüyor`, !metin.includes('KOMSU GIZLI MUSTERI'), tur);
  }
} finally {
  for (const s of [SLUG, SLUG2]) {
    const e = await p.tenant.findFirst({ where: { slug: s } });
    if (e) await p.tenant.delete({ where: { id: e.id } });
  }
  console.log('\n  (temizlik: test bayileri silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
