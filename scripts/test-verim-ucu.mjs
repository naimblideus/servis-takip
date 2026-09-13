// ÖĞRENEN TONER VERİMİ — uçtan uca
// Çalıştır:  node scripts/test-verim-ucu.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Saf mantık ayrı test ediliyor (test-verim-ogrenme.mjs). Burada test
// edilen şey, ölçümün GERÇEKTEN KENDİLİĞİNDEN olup olmadığı: teknisyen
// fişe toner eklerken hiçbir ek iş yapmadan verim öğrenilmeli. Olmazsa
// özellik yine 853 boş alanın arkasında kalır.
//
//   1. Fişe toner eklemek = toner değişti. Ayrıca işaretlemek GEREKMEMELİ.
//   2. İkinci değişimde verim ÖLÇÜLMELİ ve tahmin motoru onu kullanmalı.
//   3. Renk belirsizse TAHMİN EDİLMEMELİ — soru dönmeli.
//   4. Drum/fırın gibi toner OLMAYAN parça toner değişimi saymamalı.
//   5. Komşu bayinin cihazına yazılamamalı.
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

const SLUG = 'test-verim-ucu';

const giris = async (eposta) => {
  const csrfR = await fetch(`${KOK}/api/auth/csrf`);
  const { csrfToken } = await csrfR.json();
  const cerez0 = (csrfR.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  const r = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cerez0 },
    body: new URLSearchParams({ csrfToken, email: eposta, password: 'test1234' }),
  });
  const yeni = (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]);
  return [...cerez0.split('; ').filter(Boolean), ...yeni].join('; ');
};

try {
  for (const sl of [SLUG, `${SLUG}-k`]) {
    const e = await p.tenant.findFirst({ where: { slug: sl } });
    if (e) await p.tenant.delete({ where: { id: e.id } });
  }

  const tenant = await p.tenant.create({
    data: {
      name: 'Verim Test Ltd.', slug: SLUG,
      users: { create: [{ email: 'vrm@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Y', role: 'ADMIN', isActive: true }] },
    },
  });
  const cerez = await giris('vrm@test.local');

  const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'Test Müşteri', phone: '5551110000' } });

  let dn = 0;
  const cihazKur = async (ek = {}) => {
    dn++;
    return p.device.create({
      data: {
        tenantId: tenant.id, customerId: musteri.id,
        brand: 'Kyocera', model: 'M2540', serialNo: `VRM-${dn}`,
        publicCode: `VRM-${Date.now()}-${dn}`, qrTokenHash: 'x',
        counterBlack: 0, ...ek,
      },
    });
  };
  const yonetici = await p.user.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const fisAc = (deviceId) => p.serviceTicket.create({
    data: {
      tenantId: tenant.id, deviceId, customerId: musteri.id,
      ticketNumber: `VRM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdByUserId: yonetici.id, issueText: 'toner bitti', status: 'NEW',
    },
  });
  const parcaKur = (ad, group, stok = 99) => p.part.create({
    data: { tenantId: tenant.id, sku: `${ad}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name: ad, group, stockQty: stok, sellPrice: 100, buyPrice: 60 },
  });
  const parcaEkle = async (ticketId, partId, c = cerez) => {
    const r = await fetch(`${KOK}/api/tickets/${ticketId}/parts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: c },
      body: JSON.stringify({ partId, quantity: 1 }),
    });
    return { status: r.status, govde: await r.json().catch(() => ({})) };
  };
  const sayacYaz = (deviceId, black, color) =>
    p.device.update({ where: { id: deviceId }, data: { counterBlack: black, ...(color !== undefined ? { counterColor: color } : {}) } });

  const tonerSb = await parcaKur('Kyocera TK-1170 Siyah Toner', 'Toner');
  const tonerBelirsiz = await parcaKur('TK-1170 Toner', 'Toner');
  const drum = await parcaKur('Kyocera DK-1150 Drum Ünitesi', 'Drum');

  console.log('\n★ FİŞE TONER EKLEMEK = TONER DEĞİŞTİ\n');
  let cihaz;
  {
    cihaz = await cihazKur();
    await sayacYaz(cihaz.id, 10000);
    const { status, govde } = await parcaEkle((await fisAc(cihaz.id)).id, tonerSb.id);
    t('parça eklendi', status === 200, govde);
    t('★ toner değişimi KENDİLİĞİNDEN kaydedildi', !!govde.tonerKaydi, govde);
    t('kanal S/B çıkarıldı (parça adı siyah diyor)', govde.tonerKaydi?.kanal === 'BLACK', govde.tonerKaydi);
    t('★ ilk değişimde verim ölçülemiyor (referans yok)', govde.tonerKaydi?.olculenVerim === null, govde.tonerKaydi);

    const d = await p.device.findUnique({ where: { id: cihaz.id }, select: { tonerResetBlack: true, tonerChangedAt: true } });
    t('cihazın referans sayacı güncellendi', d.tonerResetBlack === 10000, d);
    t('değişim tarihi yazıldı', !!d.tonerChangedAt);
  }

  console.log('\n★ İKİNCİ DEĞİŞİMDE VERİM ÖLÇÜLÜYOR\n');
  {
    await sayacYaz(cihaz.id, 17200);
    const { govde } = await parcaEkle((await fisAc(cihaz.id)).id, tonerSb.id);
    t('★ 7.200 sayfa ÖLÇÜLDÜ', govde.tonerKaydi?.olculenVerim === 7200, govde.tonerKaydi);

    const kayitlar = await p.tonerChange.findMany({ where: { deviceId: cihaz.id }, orderBy: { changedAt: 'asc' } });
    t('iki değişim kaydı var', kayitlar.length === 2, kayitlar.length);
    t('kaynak FİŞ olarak yazıldı', kayitlar.every((k) => k.source === 'FIS'), kayitlar.map((k) => k.source));
    t('hangi parçanın takıldığı kayıtlı', kayitlar[1].partId === tonerSb.id);

    // ── TAHMİN MOTORU ÖLÇÜLEN VERİMİ KULLANIYOR MU ──
    await sayacYaz(cihaz.id, 18000);
    const liste = await (await fetch(`${KOK}/api/toner`, { headers: { cookie: cerez } })).json();
    const satir = (liste.items || []).find((x) => x.id === cihaz.id);
    t('★ verimi ELLE GİRİLMEMİŞ cihaz listede', !!satir, (liste.items || []).length);
    t('★ kullanılan verim ölçülen değer', satir?.verimSb?.deger === 7200, satir?.verimSb);
    t('★ kaynağı gizlenmiyor', satir?.verimSb?.kaynak === 'CIHAZ', satir?.verimSb);
    t('kaç tonerden ölçüldüğü yazıyor', /1 toner/.test(satir?.verimSb?.aciklama || ''), satir?.verimSb?.aciklama);
    // 18.000 − 17.200 = 800 sayfa basılmış, 7.200'lük tonerden 6.400 kalmış.
    t('★ kalan sayfa doğru hesaplanıyor', satir?.black?.remaining === 6400, satir?.black);
    t('ölçülen cihaz sayısı bildiriliyor', liste.olculen >= 1, liste.olculen);
  }

  console.log('\n★ ELLE GİRİLEN ÖLÇÜMÜ EZİYOR\n');
  {
    await p.device.update({ where: { id: cihaz.id }, data: { tonerYieldBlack: 6000 } });
    const liste = await (await fetch(`${KOK}/api/toner`, { headers: { cookie: cerez } })).json();
    const satir = (liste.items || []).find((x) => x.id === cihaz.id);
    t('★ bayinin girdiği değer kazanıyor', satir?.verimSb?.deger === 6000 && satir?.verimSb?.kaynak === 'ELLE', satir?.verimSb);
    await p.device.update({ where: { id: cihaz.id }, data: { tonerYieldBlack: null } });
  }

  console.log('\n★ AYNI MODELİN DİĞER CİHAZLARI DA AÇILIYOR\n');
  {
    // Aynı modelde ikinci bir cihaz: kendi geçmişi yok ama modelin verimi
    // biliniyor. Model özeti için EN AZ İKİ gözlem gerekiyor, o yüzden
    // önce ikinci bir ölçüm üretiyoruz.
    const b = await cihazKur({ serialNo: 'VRM-B' });
    await sayacYaz(b.id, 5000);
    await parcaEkle((await fisAc(b.id)).id, tonerSb.id);
    await sayacYaz(b.id, 11800);
    await parcaEkle((await fisAc(b.id)).id, tonerSb.id); // 6.800 ölçüldü

    const c = await cihazKur({ serialNo: 'VRM-C' });
    await sayacYaz(c.id, 3000);
    const liste = await (await fetch(`${KOK}/api/toner`, { headers: { cookie: cerez } })).json();
    const satir = (liste.items || []).find((x) => x.id === c.id);
    t('★ hiç toneri değişmemiş cihaz modelden verim alıyor', !!satir, (liste.items || []).map((x) => x.serialNo));
    t('★ ortanca iki gözlemin ortası (7.000)', satir?.verimSb?.deger === 7000, satir?.verimSb);
    t('kaynağı MODEL', satir?.verimSb?.kaynak === 'MODEL', satir?.verimSb);
    t('iki gözlemden geldiği yazıyor', /2 toner/.test(satir?.verimSb?.aciklama || ''), satir?.verimSb?.aciklama);
  }

  console.log('\n★ RENK BELİRSİZSE TAHMİN EDİLMİYOR — SORULUYOR\n');
  {
    // Renkli basabilen cihaz + adı renk söylemeyen toner.
    const r = await cihazKur({ serialNo: 'VRM-R', counterColor: 4000 });
    const fis = await fisAc(r.id);
    const { govde } = await parcaEkle(fis.id, tonerBelirsiz.id);
    t('★ değişim SESSİZCE yazılmadı', !govde.tonerKaydi, govde.tonerKaydi);
    t('★ soru dönüyor', !!govde.tonerSorusu, govde);
    t('soruda parça adı var', govde.tonerSorusu?.partAdi === tonerBelirsiz.name, govde.tonerSorusu);
    t('henüz hiçbir kayıt yok', (await p.tonerChange.count({ where: { deviceId: r.id } })) === 0);

    const cevap = await fetch(`${KOK}/api/tickets/${fis.id}/parts`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ ticketPartId: govde.tonerSorusu.ticketPartId, kanal: 'COLOR' }),
    });
    const cd = await cevap.json();
    t('cevap kabul edildi', cevap.status === 200 && cd.ok, cd);
    const k = await p.tonerChange.findFirst({ where: { deviceId: r.id } });
    t('★ teknisyenin dediği kanala yazıldı', k?.channel === 'COLOR', k);
    t('renkli sayaç referans alındı', k?.counterValue === 4000, k);

    const kotu = await fetch(`${KOK}/api/tickets/${fis.id}/parts`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ ticketPartId: govde.tonerSorusu.ticketPartId, kanal: 'MOR' }),
    });
    t('geçersiz kanal reddediliyor', kotu.status === 400, kotu.status);
  }

  console.log('\n★ MONO CİHAZDA SORU YOK — tek olasılık var\n');
  {
    const m = await cihazKur({ serialNo: 'VRM-M' });
    await sayacYaz(m.id, 2000);
    const { govde } = await parcaEkle((await fisAc(m.id)).id, tonerBelirsiz.id);
    t('★ renkli basmayan cihazda S/B çıkarımı yapılıyor', govde.tonerKaydi?.kanal === 'BLACK', govde);
    t('soru sorulmuyor', !govde.tonerSorusu, govde);
  }

  console.log('\n★ TONER OLMAYAN PARÇA DEĞİŞİM SAYILMIYOR\n');
  {
    const d = await cihazKur({ serialNo: 'VRM-D' });
    await sayacYaz(d.id, 9000);
    const { govde } = await parcaEkle((await fisAc(d.id)).id, drum.id);
    t('★ drum toner değişimi saymıyor', !govde.tonerKaydi && !govde.tonerSorusu, govde);
    t('hiç kayıt açılmadı', (await p.tonerChange.count({ where: { deviceId: d.id } })) === 0);
    t('stok yine de düştü (parça işi bozulmadı)',
      (await p.part.findUnique({ where: { id: drum.id }, select: { stockQty: true } })).stockQty === 98);
  }

  console.log('\n★ ÖLÇÜM HATASI VERİMİ BOZMUYOR\n');
  {
    // Sıkışma yüzünden 40 sayfada değişen toner: gözlem sayılmamalı.
    const e = await cihazKur({ serialNo: 'VRM-E' });
    await sayacYaz(e.id, 1000);
    await parcaEkle((await fisAc(e.id)).id, tonerSb.id);
    await sayacYaz(e.id, 1040);
    const { govde } = await parcaEkle((await fisAc(e.id)).id, tonerSb.id);
    t('★ 40 sayfalık "verim" ölçüm sayılmıyor', govde.tonerKaydi?.olculenVerim === null, govde.tonerKaydi);
    const k = await p.tonerChange.findMany({ where: { deviceId: e.id }, orderBy: { changedAt: 'asc' } });
    t('kayıt yine de tutuluyor (değişim gerçekten oldu)', k.length === 2, k.length);
    t('ölçüm alanı boş bırakıldı', k[1].observedYield === null, k[1]);
  }

  console.log('\nKOMŞU BAYİ SIZMIYOR\n');
  {
    const komsu = await p.tenant.create({
      data: {
        name: `${SLUG}-k`, slug: `${SLUG}-k`,
        users: { create: { email: 'vrm-k@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'K', role: 'ADMIN', isActive: true } },
      },
    });
    const km = await p.customer.create({ data: { tenantId: komsu.id, name: 'Komsu', phone: '5559990000' } });
    const kd = await p.device.create({
      data: {
        tenantId: komsu.id, customerId: km.id, brand: 'Kyocera', model: 'M2540',
        serialNo: 'KOMSU-1', publicCode: `KOMSU-${Date.now()}`, qrTokenHash: 'x', counterBlack: 500,
      },
    });
    const kf = await p.serviceTicket.create({
      data: {
        tenantId: komsu.id, deviceId: kd.id, customerId: km.id,
        ticketNumber: `KOMSU-${Date.now()}`, createdByUserId: (await p.user.findFirstOrThrow({ where: { tenantId: komsu.id } })).id,
        issueText: 'x', status: 'NEW',
      },
    });
    const { status } = await parcaEkle(kf.id, tonerSb.id);
    t('başka bayinin fişine parça eklenemiyor', status === 404, status);
    t('komşunun cihazına değişim yazılmadı', (await p.tonerChange.count({ where: { deviceId: kd.id } })) === 0);
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
