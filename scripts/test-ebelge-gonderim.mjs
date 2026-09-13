// e-BELGE GÖNDERİMİ — geri alınamaz işin testi
// Çalıştır:  node scripts/test-ebelge-gonderim.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Gönderim geri alınamaz. İki hatanın bedeli en ağır:
//
//   1. NUMARA YAKMAK. GİB belge sırasında BOŞLUK OLAMAZ. Gönderim
//      başarısız olduğunda numara O FATURAYA AİT kalmalı; tekrar denemede
//      AYNI numara kullanılmalı. Her denemede yeni numara almak sırada
//      delik açar ve delik sonradan KAPATILAMAZ.
//   2. ÇİFT FATURA. Aynı fatura iki kez gönderilirse müşteriye iki kez
//      fatura gider. Eş zamanlı iki istek ikisini birden geçememeli.
//
// Ayrıca: parola ŞİFRELİ saklanmalı ve anahtar yoksa HİÇ kaydedilmemeli.
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

const SLUG = 'test-ebelge-gonderim';

try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  // Parola test entegratörü için önemli değil ama sirla() ile yazılmalı;
  // uçtan uca yolu doğrulamak için ayarlar ucundan gireceğiz.
  const tenant = await p.tenant.create({
    data: {
      name: 'Gönderim Test Ltd. Şti.', slug: SLUG,
      taxNumber: '9876543210', taxOffice: 'Beşiktaş',
      address: 'Barbaros Bulvarı 15', city: 'İstanbul', district: 'Beşiktaş',
      phone: '02121234567', email: 'bayi@test.local',
      eFaturaOnEk: 'GND', eFaturaSeq: 0,
      eFaturaSaglayici: 'TEST', eFaturaTestModu: true,
      users: {
        create: [
          { email: 'gnd@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Y', role: 'ADMIN', isActive: true },
          { email: 'gnd-tek@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'T', role: 'TECHNICIAN', isActive: true },
        ],
      },
    },
  });

  // VKN son hanesi test entegratörünün davranışını belirliyor:
  //   ...1 → gönderilir · ...0 → kalıcı red · ...9 → geçici hata
  const musteriKur = (ad, vkn, tel) => p.customer.create({
    data: {
      tenantId: tenant.id, name: ad, phone: tel,
      legalName: `${ad} Tic. Ltd. Şti.`, taxNo: vkn,
      taxOffice: 'Mecidiyeköy', city: 'İstanbul', district: 'Şişli',
      address: 'Büyükdere Cad. 12', email: 'a@b.com', eInvoiceUser: true,
    },
  });
  const iyi = await musteriKur('İyi Müşteri', '1234567891', '5551110001');
  const redli = await musteriKur('Red Müşteri', '1234567890', '5551110002');
  const gecici = await musteriKur('Geçici Hata', '1234567899', '5551110003');
  const eksikMusteri = await p.customer.create({
    data: { tenantId: tenant.id, name: 'Eksik', phone: '5551110004' },
  });

  let fn = 0;
  const faturaKur = async (customerId) => {
    const f = await p.customerInvoice.create({
      data: {
        tenantId: tenant.id, customerId, invoiceNumber: `GND-${++fn}`,
        period: '2026-09', dueDate: new Date(2026, 8, 30), invoiceDate: new Date(2026, 8, 10),
        subtotal: 1000, vatRate: 20, vatAmount: 200, totalAmount: 1200, status: 'OPEN',
      },
    });
    await p.invoiceLine.create({
      data: { invoiceId: f.id, tenantId: tenant.id, kind: 'RENTAL', description: 'Kira', quantity: 1, unitPrice: 1000, lineTotal: 1000 },
    });
    return f;
  };

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
  const cerez = await giris('gnd@test.local');
  const cerezTek = await giris('gnd-tek@test.local');
  const gonder = (id, islem, ck = cerez) => fetch(`${KOK}/api/invoices/e-belge/gonder`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ck },
    body: JSON.stringify({ id, islem }),
  });

  // Kimlik bilgisi: şifreli yazılıyor mu diye ayarlar ucundan giriyoruz.
  const ayar = (govde) => fetch(`${KOK}/api/settings/e-fatura`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
    body: JSON.stringify(govde),
  });

  console.log('\nYETKİ\n');
  {
    const f = await faturaKur(iyi.id);
    t('teknisyen gönderemiyor', (await gonder(f.id, 'gonder', cerezTek)).status === 403);
    const y = await fetch(`${KOK}/api/invoices/e-belge/gonder`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id }),
    });
    t('girişsiz reddediliyor', [401, 403].includes(y.status), y.status);
  }

  console.log('\n★ PAROLA ŞİFRELİ SAKLANIYOR\n');
  {
    const y = await ayar({ saglayici: 'TEST', kullanici: 'bayi123', parola: 'gizli-parola', testModu: true });
    const d = await y.json();
    t('ayar kabul edildi', y.ok, d);
    const k = await p.tenant.findUnique({ where: { id: tenant.id }, select: { eFaturaParola: true, eFaturaKullanici: true } });
    t('★ parola düz metin DEĞİL', k.eFaturaParola !== 'gizli-parola', k.eFaturaParola?.slice(0, 12));
    t('★ şifreli biçimde (v1. öneki)', (k.eFaturaParola || '').startsWith('v1.'), k.eFaturaParola?.slice(0, 8));
    t('kullanıcı adı düz saklanıyor (sır değil)', k.eFaturaKullanici === 'bayi123', k);
    const oku = await (await fetch(`${KOK}/api/settings/e-fatura`, { headers: { cookie: cerez } })).json();
    t('★ okuma ucu parolayı DÖNDÜRMÜYOR', !JSON.stringify(oku).includes('gizli-parola'), oku);
    t('maskeli gösteriliyor', /•/.test(oku.parolaMaske || ''), oku.parolaMaske);
  }

  console.log('\n★ BAŞARILI GÖNDERİM\n');
  let ilkFatura;
  {
    ilkFatura = await faturaKur(iyi.id);
    const d = await (await gonder(ilkFatura.id)).json();
    t('gönderildi', d.ok === true && d.durum === 'GONDERILDI', d);
    t('★ GİB numarası atandı (GND2026000000001)', d.gibNo === 'GND2026000000001', d.gibNo);
    t('ETTN atandı', /^[0-9a-f-]{36}$/.test(d.ettn || ''), d.ettn);
    t('test modu olduğu söyleniyor', d.testModu === true, d);

    const k = await p.tenant.findUnique({ where: { id: tenant.id }, select: { eFaturaSeq: true, eFaturaSeqYil: true } });
    t('sayaç 1 oldu', k.eFaturaSeq === 1 && k.eFaturaSeqYil === 2026, k);
  }

  console.log('\n★ ÇİFT GÖNDERİM ENGELLİ\n');
  {
    const d = await (await gonder(ilkFatura.id)).json();
    t('★ gönderilmiş belge tekrar gönderilmiyor', d.ok === false, d);
    t('sebebi açık', /zaten gönderildi/i.test(d.hata || ''), d.hata);
    const k = await p.tenant.findUnique({ where: { id: tenant.id }, select: { eFaturaSeq: true } });
    t('★ sayaç ARTMADI (numara yakılmadı)', k.eFaturaSeq === 1, k);
  }

  console.log('\n★ HATA DURUMUNDA NUMARA KORUNUYOR\n');
  {
    // Geçici hata veren müşteri: gönderim düşer ama numara atanmış olur.
    const f = await faturaKur(gecici.id);
    const d1 = await (await gonder(f.id)).json();
    t('gönderim başarısız', d1.ok === false && d1.durum === 'HATA', d1);
    t('tekrar denenebilir olduğu söyleniyor', d1.tekrarDenenebilir === true, d1);
    t('numara yine de atandı', d1.gibNo === 'GND2026000000002', d1.gibNo);

    const k1 = await p.tenant.findUnique({ where: { id: tenant.id }, select: { eFaturaSeq: true } });
    t('sayaç 2 oldu', k1.eFaturaSeq === 2, k1);

    // ★ TEKRAR DENE: aynı numara kullanılmalı, sayaç ARTMAMALI.
    const d2 = await (await gonder(f.id)).json();
    t('★ tekrar denemede AYNI numara', d2.gibNo === 'GND2026000000002', { ilk: d1.gibNo, ikinci: d2.gibNo });
    t('★ ETTN de aynı', d2.ettn === d1.ettn, { ilk: d1.ettn, ikinci: d2.ettn });
    const k2 = await p.tenant.findUnique({ where: { id: tenant.id }, select: { eFaturaSeq: true } });
    t('★ sayaç ARTMADI — sırada delik açılmadı', k2.eFaturaSeq === 2, k2);
  }

  console.log('\n★ SIRADA DELİK YOK\n');
  {
    // Araya kalıcı red giriyor; sıra yine de kesintisiz ilerlemeli.
    const red = await faturaKur(redli.id);
    const dRed = await (await gonder(red.id)).json();
    t('kalıcı red HATA yazıyor', dRed.ok === false && dRed.durum === 'HATA', dRed);
    t('tekrar denenemez olduğu söyleniyor', dRed.tekrarDenenebilir === false, dRed);
    t('3. numarayı aldı', dRed.gibNo === 'GND2026000000003', dRed.gibNo);

    const sonraki = await faturaKur(iyi.id);
    const d = await (await gonder(sonraki.id)).json();
    t('★ sonraki fatura 4. numarayı aldı (atlama yok)', d.gibNo === 'GND2026000000004', d.gibNo);

    const hepsi = await p.customerInvoice.findMany({
      where: { tenantId: tenant.id, gibNo: { not: null } },
      select: { gibNo: true }, orderBy: { gibNo: 'asc' },
    });
    const siralar = hepsi.map((x) => Number(x.gibNo.slice(-9)));
    t('★ numaralar kesintisiz: 1,2,3,4', siralar.join(',') === '1,2,3,4', siralar);
    t('numaralar benzersiz', new Set(siralar).size === siralar.length, siralar);
  }

  console.log('\n★ EKSİK BİLGİ GÖNDERİLMİYOR VE NUMARA YAKMIYOR\n');
  {
    const oncekiSeq = (await p.tenant.findUnique({ where: { id: tenant.id }, select: { eFaturaSeq: true } })).eFaturaSeq;
    const f = await faturaKur(eksikMusteri.id);
    const d = await (await gonder(f.id)).json();
    t('eksik bilgiyle gönderilmiyor', d.ok === false, d);
    t('eksikler tek tek yazıyor', (d.eksikler || []).length >= 3, d.eksikler);
    t('★ numara ATANMADI', d.gibNo === null, d.gibNo);
    const sonra = (await p.tenant.findUnique({ where: { id: tenant.id }, select: { eFaturaSeq: true } })).eFaturaSeq;
    t('★ sayaç artmadı', sonra === oncekiSeq, { oncekiSeq, sonra });
  }
  {
    const f = await faturaKur(iyi.id);
    await p.customerInvoice.update({ where: { id: f.id }, data: { status: 'CANCELLED' } });
    const d = await (await gonder(f.id)).json();
    t('iptal fatura gönderilmiyor', d.ok === false && /İptal/.test(d.hata || ''), d);
  }

  console.log('\n★ DURUM SORGUSU\n');
  {
    const d = await (await gonder(ilkFatura.id, 'durum')).json();
    t('durum sorgusu çalışıyor', d.ok === true, d);
    t('durum güncellendi', ['KABUL', 'GONDERILDI'].includes(d.durum), d);
    const k = await p.customerInvoice.findUnique({ where: { id: ilkFatura.id }, select: { eBelgeDurum: true, eBelgeNot: true } });
    t('veritabanına yazıldı', k.eBelgeDurum === d.durum, k);
    t('entegratör notu saklandı', !!k.eBelgeNot, k);
  }
  {
    const f = await faturaKur(iyi.id);
    const d = await (await gonder(f.id, 'durum')).json();
    t('★ gönderilmemiş belgenin durumu sorulamıyor', d.ok === false, d);
  }

  console.log('\n★ SAĞLAYICI YOKSA SESSİZCE TESTE DÜŞMÜYOR\n');
  {
    await p.tenant.update({ where: { id: tenant.id }, data: { eFaturaSaglayici: 'OLMAYAN' } });
    const f = await faturaKur(iyi.id);
    const d = await (await gonder(f.id)).json();
    t('★ bilinmeyen sağlayıcı reddediliyor', d.ok === false && /Tanımlı olmayan/.test(d.hata || ''), d);
    t('numara yakılmadı', d.gibNo === null, d.gibNo);

    await p.tenant.update({ where: { id: tenant.id }, data: { eFaturaSaglayici: null } });
    const d2 = await (await gonder(f.id)).json();
    t('sağlayıcı seçilmemişse söyleniyor', /seçilmemiş/.test(d2.hata || ''), d2.hata);
    await p.tenant.update({ where: { id: tenant.id }, data: { eFaturaSaglayici: 'TEST' } });
  }

  console.log('\nKOMŞU BAYİ SIZMIYOR\n');
  {
    const komsu = await p.tenant.create({
      data: {
        name: `${SLUG}-k`, slug: `${SLUG}-k`,
        users: { create: { email: 'gnd-k@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'K', role: 'ADMIN', isActive: true } },
      },
    });
    const km = await p.customer.create({ data: { tenantId: komsu.id, name: 'Komsu', phone: '5559990000' } });
    const kf = await p.customerInvoice.create({
      data: {
        tenantId: komsu.id, customerId: km.id, invoiceNumber: 'KOMSU-1',
        period: '2026-09', dueDate: new Date(2026, 8, 30), invoiceDate: new Date(2026, 8, 10),
        subtotal: 100, vatRate: 20, vatAmount: 20, totalAmount: 120, status: 'OPEN',
      },
    });
    const d = await (await gonder(kf.id)).json();
    t('başka bayinin faturası gönderilemiyor', d.ok === false && /bulunamadı/i.test(d.hata || ''), d);
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
