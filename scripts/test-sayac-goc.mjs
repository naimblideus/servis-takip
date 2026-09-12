// SAYAÇ GEÇMİŞİ GÖÇÜ — başka programdan gelen bayi
// Çalıştır:  node scripts/test-sayac-goc.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Göç aracının yapabileceği İKİ pahalı hata var ve ikisi de sessiz:
//
//   1. PARA UYDURMAK. Aktarılan geçmiş okumalar "faturalanmamış" yazılırsa,
//      bayi göçten sonra ilk kez "Bu Dönemi Faturala" dediğinde geçmişin
//      TAMAMI yeni bir faturaya dönüşür ve müşteriye ikinci kez fatura gider.
//      O sayfalar eski sistemde zaten faturalandı.
//
//   2. AY KAYBETTİRMEK. Geçmiş hiç aktarılmazsa ilk gerçek okuma zincirin
//      başı sayılır, farkı sıfır çıkar ve göç ettiği ayın bütün sayfaları
//      kaybolur. Aracın var olma sebebi bu.
//
// Sunucu kapalıysa ATLAR, hata vermez.
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

const SLUG = 'test-sayac-goc';
const gunOnce = (n) => new Date(Date.now() - n * 86400000);
const gg = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

async function giris(eposta, sifre) {
  const c = await fetch(`${KOK}/api/auth/csrf`);
  const cc = (c.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await c.json();
  const y = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cc },
    body: new URLSearchParams({ email: eposta, password: sifre, csrfToken, redirect: 'false', json: 'true' }),
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
      name: SLUG, slug: SLUG, pricePerBlack: 0.5, pricePerColor: 2,
      users: {
        create: [
          { email: 'goc@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Yönetici', role: 'ADMIN', isActive: true },
          { email: 'teknisyen@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'Teknisyen', role: 'TECHNICIAN', isActive: true },
        ],
      },
    },
  });
  const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'Göç Müşteri', phone: '5550000000' } });

  const cihazKur = async (seri, ekstra = {}) => p.device.create({
    data: {
      tenantId: tenant.id, customerId: musteri.id, brand: 'Kyocera', model: 'M2540',
      serialNo: seri, isRental: true, monthlyRent: 0, includedBlack: 0, includedColor: 0,
      publicCode: `GOC-${seri}`, qrTokenHash: 'x', ...ekstra,
    },
  });

  const cihaz = await cihazKur('GOC-1');
  const etiketsiz = await cihazKur('GOC-2', { reportedSerial: 'CIHAZIN-KENDI-SERISI' });
  const barkodlu = await cihazKur('GOC-3', { barcode: 'BRK-9988' });

  const cerez = await giris('goc@test.local', 'test1234');
  const cerezTek = await giris('teknisyen@test.local', 'test1234');

  const gonder = (csv, dryRun, ck = cerez) => fetch(`${KOK}/api/import/sayac`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ck },
    body: JSON.stringify({ csv, dryRun }),
  });

  console.log('\nYETKİ\n');
  {
    const y = await gonder('Seri No;Tarih;Siyah\nGOC-1;01.01.2026;100', true, cerezTek);
    t('teknisyen sayaç geçmişi aktaramıyor', y.status === 403, y.status);
    const y2 = await fetch(`${KOK}/api/import/sayac`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: 'x', dryRun: true }),
    });
    t('girişsiz reddediliyor', y2.status === 401 || y2.status === 403, y2.status);
  }

  console.log('\nÖNİZLEME HİÇBİR ŞEY YAZMIYOR\n');
  {
    const csv = `Seri No;Tarih;Siyah;Renkli\nGOC-1;${gg(gunOnce(90))};10000;0`;
    const y = await gonder(csv, true);
    const d = await y.json();
    const adet = await p.counterReading.count({ where: { deviceId: cihaz.id } });
    t('önizleme 200 dönüyor', y.ok, d);
    t('önizleme yazılacak satırı sayıyor', d.yazilacak === 1, d);
    t('veritabanına HİÇBİR ŞEY yazılmadı', adet === 0, adet);
    t('paranın uydurulmayacağı önizlemede yazıyor', /zaten faturaland/.test(d.not || ''), d.not);
  }

  console.log('\nCİHAZ ÜÇ YOLDAN DA EŞLEŞİYOR\n');
  {
    const csv = [
      'Seri No;Tarih;Siyah;Renkli',
      `GOC-1;${gg(gunOnce(90))};10000;0`,
      `CIHAZIN-KENDI-SERISI;${gg(gunOnce(90))};5000;0`,
      `BRK-9988;${gg(gunOnce(90))};7000;0`,
      `YOK-BOYLE-SERI;${gg(gunOnce(90))};1;0`,
    ].join('\n');
    const d = await (await gonder(csv, true)).json();
    t('etiket serisi, cihazın bildirdiği seri ve barkod — üçü de eşleşiyor', d.yazilacak === 3, d);
    t('bilinmeyen seri diğerlerini DURDURMUYOR', d.hatali === 1, d);
    t('eşleşmeyen seri bayiye söyleniyor', (d.eslesmeyenSeri || []).includes('YOK-BOYLE-SERI'), d.eslesmeyenSeri);
  }

  console.log('\nFARK ZİNCİRİ — DOSYA KARIŞIK SIRADA OLSA BİLE\n');
  {
    // Bilerek ters sırada: 60 → 90 → 30. Doğru zincir tarihe göre kurulmalı.
    const csv = [
      'Seri No;Tarih;Siyah;Renkli',
      `GOC-1;${gg(gunOnce(60))};13000;0`,
      `GOC-1;${gg(gunOnce(90))};10000;0`,
      `GOC-1;${gg(gunOnce(30))};16000;0`,
    ].join('\n');
    const y = await gonder(csv, false);
    const d = await y.json();
    t('aktarım tamamlandı', y.ok && d.yazilan === 3, d);

    const okumalar = await p.counterReading.findMany({
      where: { deviceId: cihaz.id }, orderBy: { readingDate: 'asc' },
      select: { counterBlack: true, deltaBlack: true, billed: true, calculatedCost: true, source: true },
    });
    t('okumalar tarih sırasına dizildi', okumalar.map((o) => o.counterBlack).join(',') === '10000,13000,16000', okumalar.map((o) => o.counterBlack));
    t('zincirin başı fark üretmiyor', okumalar[0].deltaBlack === 0, okumalar[0]);
    t('sonraki farklar doğru (3.000 ve 3.000)', okumalar[1].deltaBlack === 3000 && okumalar[2].deltaBlack === 3000, okumalar.map((o) => o.deltaBlack));
    t('★ hepsi FATURALANMIŞ yazıldı (ikinci kez fatura gitmesin)', okumalar.every((o) => o.billed === true), okumalar.map((o) => o.billed));
    t('★ hiçbiri tutar üretmedi', okumalar.every((o) => Number(o.calculatedCost) === 0), okumalar.map((o) => o.calculatedCost));
    t('kaynak TOPLU olarak işaretlendi', okumalar.every((o) => o.source === 'TOPLU'), okumalar[0].source);
  }

  console.log('\nARACIN VAR OLMA SEBEBİ: GÖÇTEN SONRAKİ İLK OKUMA\n');
  {
    // Geçmiş aktarıldı; şimdi normal yoldan okuma gir. Fark, aktarılan son
    // okumaya göre hesaplanmalı — geçmiş olmasaydı sıfır çıkardı.
    const y = await fetch(`${KOK}/api/devices/${cihaz.id}/readings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ counterBlack: 19500, counterColor: 0, includeMonthlyRent: false }),
    });
    const d = await y.json();
    t('göçten sonraki ilk okuma 3.500 sayfayı yakalıyor (geçmiş olmasa 0 olurdu)',
      d.deltaBlack === 3500, { delta: d.deltaBlack });
    t('o sayfalar paraya dönüyor', Number(d.calculatedCost) === 1750, d.calculatedCost);
  }

  console.log('\nZİNCİRE ARAYA GİRME ENGELLİ\n');
  {
    // Cihazda artık 30 gün öncesine kadar okuma var. Daha YENİ bir geçmiş
    // satırı, yazılmış okumaların farkını geçmişe dönük bozardı.
    const csv = `Seri No;Tarih;Siyah;Renkli\nGOC-1;${gg(gunOnce(10))};18000;0`;
    const d = await (await gonder(csv, true)).json();
    t('mevcut okumadan SONRAKİ tarih reddediliyor', d.yazilacak === 0 && d.hatali === 1, d);
    t('sebebi açıkça yazıyor', /zaten var/.test((d.hatalar || [])[0]?.hata || ''), (d.hatalar || [])[0]);
  }

  console.log('\nBOZUK SATIRLAR\n');
  {
    const csv = [
      'Seri No;Tarih;Siyah;Renkli',
      `GOC-3;;7000;0`,
      `GOC-3;${gg(gunOnce(80))};abc;0`,
      `;${gg(gunOnce(80))};100;0`,
      `GOC-3;${gg(gunOnce(80))};-5;0`,
      `GOC-3;01.01.2099;100;0`,
    ].join('\n');
    const d = await (await gonder(csv, true)).json();
    t('tarih/sayaç/seri hatalı satırlar ayıklanıyor', d.yazilacak === 0 && d.hatali === 5, d);
  }
  {
    const y = await gonder('Musteri;Telefon\nA;5551112233', true);
    const d = await y.json();
    t('yanlış dosya yüklenirse ne gerektiği söyleniyor', y.status === 400 && /Seri No/.test(d.error || ''), d);
  }
  {
    const csv = [
      'Seri No;Tarih;Siyah;Renkli',
      `GOC-3;${gg(gunOnce(80))};7000;0`,
      `GOC-3;${gg(gunOnce(80))};7100;0`,
    ].join('\n');
    const d = await (await gonder(csv, true)).json();
    t('aynı cihazda aynı tarih iki kez — ikincisi eleniyor', d.yazilacak === 1 && d.hatali === 1, d);
  }
} finally {
  const e = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (e) await p.tenant.delete({ where: { id: e.id } });
  console.log('\n  (temizlik: test bayisi silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
