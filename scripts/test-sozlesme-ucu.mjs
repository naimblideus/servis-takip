// SÖZLEŞME UCU — sözleşmede yazan ile sistemde olan, gerçek veriyle
// Çalıştır:  node scripts/test-sozlesme-ucu.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Kural kütüphanesi ayrı test ediliyor (test-sozlesme.mjs). Burada test
// edilen şey VERİ YOLU: uç, cihazın gerçek şartlarını ve gerçek sayfa
// hacmini doğru topluyor mu?
//
//   1. HACİM OKUMA GEÇMİŞİNDEN gelmeli. Uydurulursa bayiye yanlış ₺ rakamı
//      gösteririz ve o rakamla müşterisinin karşısına çıkar.
//   2. BOŞ FİYAT ALANI bayi varsayılanına düşmeli — faturalama öyle yapıyor,
//      karşılaştırma faturayla AYNI rakamı görmeli. Yoksa olmayan bir fark
//      uydururuz.
//   3. KAPSAM DIŞI CİHAZ yakalanmalı: sözleşmesi olan müşteride sözleşmeye
//      girmemiş kiralık makine ya unutulmuş ya anlaşmasız — ikisi de para.
//   4. CİHAZ EKLERKEN ŞARTLAR MEVCUT AYARDAN dolmalı; yoksa bayi yedi alanı
//      elle doldurmak zorunda kalır ve bu ekranı kullanmaz.
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

const SLUG = 'test-sozlesme-ucu';
const GUN = 86400000;
const gunOnce = (n) => new Date(Date.now() - n * GUN);
const gunSonra = (n) => new Date(Date.now() + n * GUN);
const iso = (d) => d.toISOString().slice(0, 10);

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
      name: SLUG, slug: SLUG, pricePerBlack: 0.30, pricePerColor: 1.00,
      users: {
        create: [
          { email: 'soz@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Y', role: 'ADMIN', isActive: true },
          { email: 'soz-tek@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'T', role: 'TECHNICIAN', isActive: true },
        ],
      },
    },
  });
  const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'Sözleşmeli Ofis', phone: '5551110001' } });

  let n = 0;
  const cihazKur = (ek) => p.device.create({
    data: {
      tenantId: tenant.id, customerId: musteri.id, brand: 'Kyocera', model: 'M2540',
      serialNo: `SZ-${++n}`, isRental: true, publicCode: `SZ-${n}`, qrTokenHash: 'x', ...ek,
    },
  });
  // Ayda ~1.400 S/B basan cihaz: 30 günde bir 1.400 artan 5 okuma.
  const okumaSeti = async (deviceId, aylikSB) => {
    for (let i = 4; i >= 0; i--) {
      await p.counterReading.create({
        data: {
          tenantId: tenant.id, deviceId,
          counterBlack: 10000 + (4 - i) * aylikSB, counterColor: 0,
          deltaBlack: i === 4 ? 0 : aylikSB, deltaColor: 0,
          calculatedCost: 0, billed: true, source: 'TOPLU',
          readingDate: gunOnce(i * 30),
        },
      });
    }
  };

  const cihaz = await cihazKur({ monthlyRent: 1200, includedBlack: 500, pricePerBlack: 0.42 });
  await okumaSeti(cihaz.id, 1400);
  const kapsamDisiCihaz = await cihazKur({ monthlyRent: 800 });

  const cerez = await giris('soz@test.local');
  const cerezTek = await giris('soz-tek@test.local');
  const al = (q = '', ck = cerez) => fetch(`${KOK}/api/sozlesmeler${q}`, { headers: ck ? { cookie: ck } : {} });

  console.log('\nYETKİ — FİYAT = MALİ VERİ\n');
  {
    t('teknisyen okuyamıyor', (await al('', cerezTek)).status === 403);
    t('girişsiz reddediliyor', [401, 403].includes((await al('', null)).status));
    const y = await fetch(`${KOK}/api/sozlesmeler`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerezTek },
      body: JSON.stringify({ customerId: musteri.id, startDate: iso(gunOnce(30)), endDate: iso(gunSonra(300)) }),
    });
    t('teknisyen sözleşme açamıyor', y.status === 403, y.status);
  }

  console.log('\nSÖZLEŞME AÇMA\n');
  let sozlesmeId;
  {
    const y = await fetch(`${KOK}/api/sozlesmeler`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({
        customerId: musteri.id, contractNo: 'SZL-2026-001',
        startDate: iso(gunOnce(400)), endDate: iso(gunSonra(20)),
        noticeDays: 30, autoRenew: true,
        escalationMonths: 12, escalationRate: 20,
        deviceIds: [cihaz.id],
      }),
    });
    const d = await y.json();
    t('sözleşme açıldı', y.ok && !!d.id, d);
    sozlesmeId = d.id;

    const cd = await p.contractDevice.findFirst({ where: { contractId: sozlesmeId }, select: { monthlyRent: true, includedBlack: true, pricePerBlack: true } });
    t('★ şartlar cihazın MEVCUT ayarından dolduruldu',
      Number(cd.monthlyRent) === 1200 && cd.includedBlack === 500 && Number(cd.pricePerBlack) === 0.42, cd);
  }
  {
    const y = await fetch(`${KOK}/api/sozlesmeler`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ customerId: musteri.id, startDate: iso(gunSonra(10)), endDate: iso(gunOnce(10)) }),
    });
    t('bitiş başlangıçtan önceyse reddediliyor', y.status === 400, y.status);
    const y2 = await fetch(`${KOK}/api/sozlesmeler`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ customerId: musteri.id, startDate: iso(gunOnce(10)), endDate: iso(gunSonra(10)), noticeDays: 400 }),
    });
    t('★ sözleşmeden uzun ihbar süresi reddediliyor', y2.status === 400, y2.status);
  }

  console.log('\n★ HACİM OKUMA GEÇMİŞİNDEN GELİYOR\n');
  {
    const d = await (await al()).json();
    const k = d.sozlesmeler.find((x) => x.id === sozlesmeId);
    const c = k.cihazlar[0];
    // 30 günde 1.400 → günlük ortanca 46,67 → aylık ~1.400
    t('★ aylık S/B hacmi okumalardan çıktı (~1.400)', Math.abs(c.aylikSayfaSB - 1400) <= 2, c.aylikSayfaSB);
    t('renkli okuma yoksa hacim null', c.aylikSayfaRenkli === null, c.aylikSayfaRenkli);
  }

  console.log('\n★ BOŞ FİYAT ALANI BAYİ VARSAYILANINA DÜŞÜYOR\n');
  {
    const d = await (await al()).json();
    const c = d.sozlesmeler.find((x) => x.id === sozlesmeId).cihazlar[0];
    // Cihazın renkli fiyatı boş; bayi varsayılanı ₺1,00 olmalı.
    t('sistemde renkli fiyat bayi varsayılanı (₺1,00)', c.sistemde.pricePerColor === 1, c.sistemde);
    // Aşım fiyatı boş → sayfa fiyatına düşmeli (faturalama da öyle yapıyor).
    t('★ aşım boşsa sayfa fiyatına düşüyor (₺0,42)', c.sistemde.overagePriceBlack === 0.42, c.sistemde);
    t('★ sözleşme birebir aynıyken fark YOK', c.farklar.length === 0, c.farklar);
  }

  console.log('\n★ SÖZLEŞME İLE SİSTEM AYRILINCA PARA GÖRÜNÜYOR\n');
  {
    // Sözleşmeyi kâğıda göre düzelt: ayda ₺1.500 + 1.000 sayfa dahil.
    const cd = await p.contractDevice.findFirst({ where: { contractId: sozlesmeId }, select: { id: true } });
    const y = await fetch(`${KOK}/api/sozlesmeler/${sozlesmeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ cihazSartlari: { id: cd.id, monthlyRent: 1500, includedBlack: 1000, pricePerBlack: 0.42 } }),
    });
    t('şartlar güncellendi', y.ok, await y.text());

    const d = await (await al()).json();
    const k = d.sozlesmeler.find((x) => x.id === sozlesmeId);
    const c = k.cihazlar[0];
    const kira = c.farklar.find((f) => f.alan === 'monthlyRent');
    const dahil = c.farklar.find((f) => f.alan === 'includedBlack');

    t('kira farkı ₺300 eksik', kira?.aylikEtki === 300 && kira.yon === 'EKSIK_FATURALAMA', kira);
    // Sözleşmede 1.000 dahil, sistemde 500. Hacim 1.400 → sözleşmeye göre
    // 400 aşım, sisteme göre 900. 500 sayfa FAZLA faturalanıyor: 500 × 0,42
    t('★ dahil paket farkı FAZLA faturalama (₺210)',
      dahil?.aylikEtki === 210 && dahil.yon === 'FAZLA_FATURALAMA', dahil);
    t('sözleşme net etkisi ₺90', k.etki.net === 90, k.etki);
    t('özet eksik toplamı ₺300', d.ozet.aylikEksik === 300, d.ozet);
    t('özet fazla toplamı ₺210', d.ozet.aylikFazla === 210, d.ozet);
    t('farklı sözleşme sayılıyor', d.ozet.farkliSozlesme === 1, d.ozet);
  }

  console.log('\n★ SİSTEMİ SÖZLEŞMEYE UYDURMA\n');
  {
    const cd = await p.contractDevice.findFirst({ where: { contractId: sozlesmeId, deviceId: cihaz.id }, select: { id: true } });
    // Sözleşmede konuşulmamış (null) kalem cihazın ayarını SİLMEMELİ.
    await p.contractDevice.update({ where: { id: cd.id }, data: { pricePerColor: null, overagePriceColor: null } });
    await p.device.update({ where: { id: cihaz.id }, data: { pricePerColor: 1.75 } });

    const y = await fetch(`${KOK}/api/sozlesmeler/${sozlesmeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ sistemeUygula: cd.id }),
    });
    const r = await y.json();
    t('uygulandı', y.ok, r);

    const d = await p.device.findUnique({
      where: { id: cihaz.id },
      select: { monthlyRent: true, includedBlack: true, pricePerBlack: true, pricePerColor: true },
    });
    t('★ kira sözleşmedeki hâline geldi (₺1.500)', Number(d.monthlyRent) === 1500, d);
    t('★ dahil paket sözleşmedeki hâline geldi (1.000)', d.includedBlack === 1000, d);
    t('★ sözleşmede BOŞ olan kalem cihazda SİLİNMEDİ (₺1,75 duruyor)', Number(d.pricePerColor) === 1.75, d);

    const g = await (await al()).json();
    const k = g.sozlesmeler.find((x) => x.id === sozlesmeId);
    const c = k.cihazlar.find((x) => x.deviceId === cihaz.id);
    t('★ uyguladıktan sonra fark kalmadı', c.farklar.length === 0, c.farklar);
    t('özet farkı sıfırladı', g.ozet.aylikEksik === 0 && g.ozet.aylikFazla === 0, g.ozet);
  }
  {
    const y = await fetch(`${KOK}/api/sozlesmeler/${sozlesmeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ sistemeUygula: 'olmayan-id' }),
    });
    t('olmayan sözleşme cihazı 404', y.status === 404, y.status);
  }

  console.log('\n★ İHBAR PENCERESİ VE ZAM\n');
  {
    const d = await (await al()).json();
    const k = d.sozlesmeler.find((x) => x.id === sozlesmeId);
    // Bitişe 20 gün, ihbar 30 gün → pencere 10 gün önce kapandı.
    t('★ ihbar penceresi kaçtı olarak işaretli', k.takvim.ihbarKacti === true, k.takvim);
    t('özet ihbar kaçanı sayıyor', d.ozet.ihbarKacan === 1, d.ozet);
    t('bitiyor sayılıyor', d.ozet.bitiyor === 1, d.ozet);
    // Başlangıç 400 gün önce, 12 ayda bir zam → zamanı geçmiş.
    t('★ zam zamanı geldi', k.zam.zamani === true && k.zam.maddeVar === true, k.zam);
    // Sözleşme kirası ₺1.500 × %20 = ₺300
    t('zam kaybı ₺300', k.zam.aylikKayip === 300, k.zam);
    t('özet zam kaybını topluyor', d.ozet.zamKaybi === 300, d.ozet);
  }
  {
    // Zam yapıldı işaretlenince uyarı susmalı.
    await fetch(`${KOK}/api/sozlesmeler/${sozlesmeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ lastEscalationAt: iso(new Date()) }),
    });
    const d = await (await al()).json();
    const k = d.sozlesmeler.find((x) => x.id === sozlesmeId);
    t('★ zam yapıldı işaretlenince uyarı susuyor', k.zam.zamani === false, k.zam);
    t('özet zam kaybı sıfırlandı', d.ozet.zamKaybi === 0, d.ozet);
  }

  console.log('\n★ KAPSAM DIŞI CİHAZ\n');
  {
    const d = await (await al()).json();
    t('★ sözleşmeye girmemiş kiralık cihaz yakalandı', d.kapsamDisi.length === 1, d.kapsamDisi);
    t('doğru cihaz', d.kapsamDisi[0].serialNo === kapsamDisiCihaz.serialNo, d.kapsamDisi[0]);
    t('özet sayıyor', d.ozet.kapsamDisi === 1, d.ozet);
  }
  {
    // Sözleşmeye eklenince kapsam dışı listesinden çıkmalı.
    const y = await fetch(`${KOK}/api/sozlesmeler/${sozlesmeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ cihazEkle: kapsamDisiCihaz.id }),
    });
    t('cihaz sözleşmeye eklendi', y.ok, await y.text());
    const d = await (await al()).json();
    t('★ kapsam dışı listesinden çıktı', d.kapsamDisi.length === 0, d.kapsamDisi);
    const k = d.sozlesmeler.find((x) => x.id === sozlesmeId);
    t('sözleşmede iki cihaz var', k.cihazSayisi === 2, k.cihazSayisi);
    const yeni = k.cihazlar.find((c) => c.serialNo === kapsamDisiCihaz.serialNo);
    t('★ eklenen cihazın şartları mevcut ayardan doldu (fark yok)', yeni.farklar.length === 0, yeni.farklar);
  }
  {
    // Başka müşterinin cihazı bu sözleşmeye giremez.
    const baskaMusteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'Başka', phone: '5551119999' } });
    const yabanci = await p.device.create({
      data: {
        tenantId: tenant.id, customerId: baskaMusteri.id, brand: 'Canon', model: 'iR',
        serialNo: 'SZ-YABANCI', isRental: true, publicCode: 'SZ-YABANCI', qrTokenHash: 'x',
      },
    });
    const y = await fetch(`${KOK}/api/sozlesmeler/${sozlesmeId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ cihazEkle: yabanci.id }),
    });
    t('★ başka müşterinin cihazı eklenemiyor', y.status === 404, y.status);
  }

  console.log('\n★ PANO İLE SÖZLEŞME EKRANI AYNI TARİHİ SÖYLÜYOR\n');
  {
    // Müşteri kartındaki basit "sözleşme bitiş tarihi" ile sözleşme
    // kaydı FARKLI tarih söylerse bayi hangisine inanacağını bilemez.
    // Kayıt varsa o kazanmalı.
    await p.customer.update({ where: { id: musteri.id }, data: { contractEndDate: gunSonra(5) } });
    const y = await fetch(`${KOK}/api/dashboard/stats`, { headers: { cookie: cerez } });
    const d = await y.json();
    const uyari = (d.contractAlerts || []).find((a) => a.id === musteri.id);
    t('sözleşmesi biten müşteri panoda görünüyor', !!uyari, d.contractAlerts);
    // Sözleşme kaydının bitişi 20 gün sonra; müşteri kartındaki 5 gün.
    t('★ pano SÖZLEŞME KAYDININ tarihini kullanıyor (5 değil 20 gün)',
      uyari && uyari.days === 20, uyari);
    t('kaynağın sözleşme kaydı olduğu işaretli', uyari?.sozlesmeKaydi === true, uyari);
  }

  console.log('\nKOMŞU BAYİ SIZMIYOR\n');
  {
    const komsu = await p.tenant.create({
      data: {
        name: `${SLUG}-komsu`, slug: `${SLUG}-komsu`,
        users: { create: { email: 'soz-komsu@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'K', role: 'ADMIN', isActive: true } },
      },
    });
    const km = await p.customer.create({ data: { tenantId: komsu.id, name: 'KOMSU GIZLI', phone: '5559990000' } });
    await p.contract.create({
      data: { tenantId: komsu.id, customerId: km.id, contractNo: 'KOMSU-1', startDate: gunOnce(10), endDate: gunSonra(300) },
    });
    const d = await (await al()).json();
    t('komşu bayinin sözleşmesi görünmüyor',
      !d.sozlesmeler.some((k) => k.contractNo === 'KOMSU-1'), d.sozlesmeler.map((k) => k.contractNo));
    await p.tenant.delete({ where: { id: komsu.id } });
  }

  console.log('\nSİLME\n');
  {
    const y = await fetch(`${KOK}/api/sozlesmeler/${sozlesmeId}`, { method: 'DELETE', headers: { cookie: cerez } });
    t('sözleşme silindi', y.ok, y.status);
    t('cihaz bağları da silindi', (await p.contractDevice.count({ where: { contractId: sozlesmeId } })) === 0);
    // Sözleşme silinince CİHAZ silinmemeli.
    t('★ cihazın kendisi duruyor', (await p.device.count({ where: { id: cihaz.id } })) === 1);
    const y2 = await fetch(`${KOK}/api/sozlesmeler/${sozlesmeId}`, { method: 'DELETE', headers: { cookie: cerez } });
    t('olmayan sözleşme 404', y2.status === 404, y2.status);
  }
} finally {
  for (const sl of [SLUG, `${SLUG}-komsu`]) {
    const e = await p.tenant.findFirst({ where: { slug: sl } });
    if (e) await p.tenant.delete({ where: { id: e.id } });
  }
  console.log('\n  (temizlik: test bayisi silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
