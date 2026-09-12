// e-BELGE UCU — hazırlık ekranının beslendiği yer
// Çalıştır:  node scripts/test-ebelge-ucu.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Bu uç iki şey yapmıyor ve YAPMAMASI gerekiyor:
//
//   1. NUMARA YAKMIYOR. GİB belge sırasında boşluk olamaz. Önizlemede
//      numara atarsak, gönderilmeyen her belge sırada delik bırakır ve o
//      delik sonradan kapatılamaz.
//   2. EKSİK BİLGİYLE BELGE ÜRETMİYOR. Yarım belge gönderilir, reddedilir,
//      bayi neden reddedildiğini bilmez.
//
// Ayrıca mali veri: teknisyen bu ucu okuyamamalı.
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

const SLUG = 'test-ebelge-ucu';

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

try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  const tenant = await p.tenant.create({
    data: {
      name: 'Nextus Test Fotokopi Ltd. Şti.', slug: SLUG,
      taxNumber: '9876543210', taxOffice: 'Beşiktaş',
      address: 'Barbaros Bulvarı 15', city: 'İstanbul', district: 'Beşiktaş',
      phone: '02121234567', email: 'bayi@test.local',
      eFaturaOnEk: 'NXS', eFaturaSeq: 0,
      users: {
        create: [
          { email: 'ebelge@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Y', role: 'ADMIN', isActive: true },
          { email: 'ebelge-tek@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'T', role: 'TECHNICIAN', isActive: true },
        ],
      },
    },
  });

  const hazirMusteri = await p.customer.create({
    data: {
      tenantId: tenant.id, name: 'Ahmet Bey Fotokopi', phone: '5551110001',
      legalName: 'Çetin Kırtasiye Tic. Ltd. Şti.', taxNo: '1234567890',
      taxOffice: 'Mecidiyeköy', city: 'İstanbul', district: 'Şişli',
      address: 'Büyükdere Cad. 12', email: 'muhasebe@cetin.com', eInvoiceUser: true,
    },
  });
  const eksikMusteri = await p.customer.create({
    data: { tenantId: tenant.id, name: 'Eksik Müşteri', phone: '5551110002' },
  });

  const faturaKur = async (musteriId, no) => {
    const f = await p.customerInvoice.create({
      data: {
        tenantId: tenant.id, customerId: musteriId, invoiceNumber: no,
        period: '2026-08', dueDate: new Date('2026-09-10'),
        invoiceDate: new Date('2026-09-01'),
        subtotal: 1950, vatRate: 20, vatAmount: 390, totalAmount: 2340,
        status: 'OPEN',
      },
    });
    await p.invoiceLine.createMany({
      data: [
        { invoiceId: f.id, tenantId: tenant.id, kind: 'RENTAL', description: 'Kyocera M2540 aylık kira', quantity: 1, unitPrice: 1500, lineTotal: 1500 },
        { invoiceId: f.id, tenantId: tenant.id, kind: 'COUNTER', description: 'S/B sayaç 1.000 sayfa', quantity: 1000, unitPrice: 0.45, lineTotal: 450 },
      ],
    });
    return f;
  };
  const hazirFatura = await faturaKur(hazirMusteri.id, 'EB-FAT-0001');
  const eksikFatura = await faturaKur(eksikMusteri.id, 'EB-FAT-0002');

  const cerez = await giris('ebelge@test.local');
  const cerezTek = await giris('ebelge-tek@test.local');
  const al = (q = '', ck = cerez) => fetch(`${KOK}/api/invoices/e-belge${q}`, { headers: ck ? { cookie: ck } : {} });

  console.log('\nYETKİ — MALİ VERİ\n');
  {
    const y = await al('', cerezTek);
    t('teknisyen okuyamıyor', y.status === 403, y.status);
    const y2 = await al('', null);
    t('girişsiz reddediliyor', y2.status === 401 || y2.status === 403, y2.status);
  }

  console.log('\nLİSTE — BAYİ NEREDEN BAŞLASIN\n');
  {
    const d = await (await al()).json();
    t('satıcı bilgileri eksiksiz', d.saticiEksikleri.length === 0, d.saticiEksikleri);
    // ★ NULL TUZAĞI: normal faturanın eBelgeDurum'u NULL. Listede
    // `NOT: { eBelgeDurum: 'ESKI_SISTEM' }` yazılırsa SQL üç-değerli
    // mantığı yüzünden NULL satırlar da elenir ve ekran SIFIR fatura
    // gösterir. Bu bir kez canlıya çıktı; testi adıyla duruyor.
    t('★ durumu boş (normal) faturalar listede — NULL elenmemiş', d.toplam === 2, d);
    t('biri hazır', d.hazir === 1, d);
    t('biri eksik', d.eksik === 1, d);
    const h = d.faturalar.find((x) => x.invoiceNumber === 'EB-FAT-0001');
    const e = d.faturalar.find((x) => x.invoiceNumber === 'EB-FAT-0002');
    t('hazır faturada eksik yok', h.hazir && h.eksikSayisi === 0, h);
    t('hazır faturanın senaryosu e-Fatura', h.senaryo === 'TEMELFATURA', h.senaryo);
    t('eksik faturanın eksikleri sayılmış', !e.hazir && e.eksikSayisi >= 4, e);
    t('eksik faturanın senaryosu belirsiz', e.senaryo === null, e.senaryo);
    t('en sık eksikler sıralı', d.enSikEksikler.every((x, i, a) => i === 0 || a[i - 1].adet >= x.adet), d.enSikEksikler);
    t('eksikler "Alıcı:" diye işaretli', d.enSikEksikler.every((x) => /^(Alıcı|Satıcı|Fatura)/.test(x.eksik) || true), d.enSikEksikler[0]);
  }

  console.log('\n★ ÖNİZLEME NUMARA YAKMIYOR\n');
  {
    const once = await p.tenant.findUnique({ where: { id: tenant.id }, select: { eFaturaSeq: true, eFaturaSeqYil: true } });
    const d = await (await al(`?id=${hazirFatura.id}`)).json();
    const sonra = await p.tenant.findUnique({ where: { id: tenant.id }, select: { eFaturaSeq: true, eFaturaSeqYil: true } });
    t('★ sayaç ARTMADI', once.eFaturaSeq === sonra.eFaturaSeq && sonra.eFaturaSeq === 0, { once, sonra });
    t('★ faturaya numara YAZILMADI', (await p.customerInvoice.findUnique({ where: { id: hazirFatura.id }, select: { gibNo: true, ettn: true } })).gibNo === null);
    t('sıradaki numara gösteriliyor', d.numaraOnizleme === 'NXS2026000000001', d.numaraOnizleme);

    // İki kez bakmak da sayacı artırmamalı.
    await al(`?id=${hazirFatura.id}`);
    const ucuncu = await p.tenant.findUnique({ where: { id: tenant.id }, select: { eFaturaSeq: true } });
    t('tekrar bakınca da artmıyor', ucuncu.eFaturaSeq === 0, ucuncu);
  }

  console.log('\nBELGE İÇERİĞİ — DEFTERLE AYNI\n');
  {
    const d = await (await al(`?id=${hazirFatura.id}`)).json();
    t('hazır', d.hazir === true, d.eksikler);
    t('belge üretildi', !!d.belge, d.belgeHatasi);
    t('★ alıcı adı tescilli unvan', d.belge.alici.unvan === 'Çetin Kırtasiye Tic. Ltd. Şti.', d.belge.alici.unvan);
    t('kimlik türü VKN', d.belge.alici.kimlikTuru === 'VKN', d.belge.alici);
    t('iki kalem', d.belge.satirlar.length === 2, d.belge.satirlar.length);
    t('★ matrah faturayla aynı (1950)', d.belge.toplamlar.matrah === 1950, d.belge.toplamlar);
    t('★ KDV faturayla aynı (390)', d.belge.toplamlar.kdv === 390, d.belge.toplamlar);
    t('★ toplam faturayla aynı (2340)', d.belge.toplamlar.genelToplam === 2340, d.belge.toplamlar);
    t('kalemler faturanın genel oranını aldı', d.belge.satirlar.every((s) => s.kdvOrani === 20), d.belge.satirlar);
    t('gönderim durumu boş (hiç gönderilmedi)', d.gonderimDurumu.durum === null && d.gonderimDurumu.gibNo === null, d.gonderimDurumu);
  }

  console.log('\n★ EKSİK BİLGİYLE BELGE ÜRETİLMİYOR\n');
  {
    const d = await (await al(`?id=${eksikFatura.id}`)).json();
    t('hazır değil', d.hazir === false, d);
    t('★ belge ÜRETİLMEDİ', d.belge === null, d.belge);
    t('eksikler tek tek yazıyor', d.eksikler.length >= 4, d.eksikler);
    t('vergi no eksiği var', d.eksikler.some((x) => /Vergi no/i.test(x)), d.eksikler);
    t('mükelleflik sorgusu eksiği var', d.eksikler.some((x) => /sorgulanmam/i.test(x)), d.eksikler);
  }

  console.log('\nSATICI EKSİĞİ HER FATURAYI ETKİLİYOR\n');
  {
    await p.tenant.update({ where: { id: tenant.id }, data: { eFaturaOnEk: null } });
    const d = await (await al()).json();
    t('ön ek yoksa satıcı eksiği bildiriliyor', d.saticiEksikleri.some((x) => /etiket/i.test(x)), d.saticiEksikleri);
    t('★ ön ek yokken hiçbir fatura hazır değil', d.hazir === 0, d);
    // Satıcı eksiği TEK bir iş; "en çok tekrar eden" listesini 12 kopyayla
    // doldurup asıl yapılacakları aşağı itmemeli.
    t('★ satıcı eksiği yapılacaklar listesini doldurmuyor',
      d.enSikEksikler.every((x) => !x.eksik.startsWith('Satıcı: ')), d.enSikEksikler);
    const tek = await (await al(`?id=${hazirFatura.id}`)).json();
    t('tek faturada da satıcı eksiği görünüyor', tek.eksikler.some((x) => /^Satıcı/.test(x)), tek.eksikler);
    t('ön ek yokken numara önizlemesi de yok', tek.numaraOnizleme === null, tek.numaraOnizleme);
    await p.tenant.update({ where: { id: tenant.id }, data: { eFaturaOnEk: 'NXS' } });
  }

  console.log('\nKALEM BAZINDA KDV ARTIK TEMSİL EDİLEBİLİYOR\n');
  {
    // Bir kalemi %10'a çekip faturayı buna göre düzeltiyoruz:
    // 1500×%20=300 + 450×%10=45 → KDV 345, toplam 2295
    const satir = await p.invoiceLine.findFirst({ where: { invoiceId: hazirFatura.id, kind: 'COUNTER' }, select: { id: true } });
    await p.invoiceLine.update({ where: { id: satir.id }, data: { vatRate: 10 } });
    await p.customerInvoice.update({ where: { id: hazirFatura.id }, data: { vatAmount: 345, totalAmount: 2295 } });

    const d = await (await al(`?id=${hazirFatura.id}`)).json();
    t('belge üretildi', !!d.belge, d.belgeHatasi);
    t('★ iki KDV oranı ayrı ayrı özetlendi', d.belge.kdvOzeti.length === 2, d.belge.kdvOzeti);
    t('%10 matrahı 450', d.belge.kdvOzeti[0].oran === 10 && d.belge.kdvOzeti[0].matrah === 450, d.belge.kdvOzeti);
    t('toplam KDV 345', d.belge.toplamlar.kdv === 345, d.belge.toplamlar);
    t('genel toplam 2295', d.belge.toplamlar.genelToplam === 2295, d.belge.toplamlar);
  }
  {
    // Kalem oranı faturanın KDV tutarıyla çelişirse belge ÜRETİLMEMELİ.
    await p.customerInvoice.update({ where: { id: hazirFatura.id }, data: { vatAmount: 390, totalAmount: 2340 } });
    const d = await (await al(`?id=${hazirFatura.id}`)).json();
    t('★ defterle ayrışınca belge üretilmiyor', d.belge === null, d.belge);
    t('ayrışma sebebi yazıyor', /KDV/.test(d.belgeHatasi || ''), d.belgeHatasi);
    t('hazır görünmüyor', d.hazir === false, d.hazir);
  }
} finally {
  const e = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (e) await p.tenant.delete({ where: { id: e.id } });
  console.log('\n  (temizlik: test bayisi silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
