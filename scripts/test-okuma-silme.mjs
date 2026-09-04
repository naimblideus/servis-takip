// OKUMA SİLİNCE ZİNCİR ONARIMI testi.
// Çalıştır:  node scripts/test-okuma-silme.mjs
//
// Neden ayrı test: okumalar bir ZİNCİR — her okumanın farkı bir öncekine göre
// hesaplanır. Ortadaki halka silinince sonrakinin farkı ESKİ öncekine göre
// kalıyordu ve aradaki sayfalar faturadan sessizce düşüyordu.
//
// Bu test API rotasını değil, rotanın yaptığı İŞİ doğrular: silme + zincir
// onarımı + cihaz sayacının güncellenmesi. Rota mantığı birebir aynı sırayla
// burada yürütülür; sapma olursa test değil rota değişmiş demektir.
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

/** Rotadaki silme mantığının aynısı (api/devices/[id]/readings DELETE). */
async function okumaSil(tenantId, deviceId, readingId) {
  const reading = await p.counterReading.findFirst({ where: { id: readingId, tenantId, deviceId } });
  if (!reading) return { hata: 'Okuma bulunamadı' };
  if (reading.billed) return { hata: 'Bu okuma faturalandığı için silinemez' };

  const sonraki = await p.counterReading.findFirst({
    where: { tenantId, deviceId, readingDate: { gt: reading.readingDate } },
    orderBy: { readingDate: 'asc' },
  });
  if (sonraki?.billed) return { hata: 'sonrasındaki okuma faturalandı' };

  const onceki = await p.counterReading.findFirst({
    where: { tenantId, deviceId, readingDate: { lt: reading.readingDate } },
    orderBy: { readingDate: 'desc' },
  });

  await p.$transaction(async (tx) => {
    await tx.counterReading.delete({ where: { id: readingId } });
    if (sonraki) {
      await tx.counterReading.update({
        where: { id: sonraki.id },
        data: {
          deltaBlack: onceki ? Math.max(0, sonraki.counterBlack - onceki.counterBlack) : 0,
          deltaColor: onceki ? Math.max(0, sonraki.counterColor - onceki.counterColor) : 0,
        },
      });
    }
    const son = await tx.counterReading.findFirst({ where: { tenantId, deviceId }, orderBy: { readingDate: 'desc' } });
    await tx.device.update({
      where: { id: deviceId },
      data: { counterBlack: son?.counterBlack ?? null, counterColor: son?.counterColor ?? null },
    });
  });
  return { ok: true, zincirOnarildi: !!sonraki };
}

const SLUG = 'test-okuma-silme';
let tenant;
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  tenant = await p.tenant.create({ data: { name: 'Okuma Silme Testi', slug: SLUG, plan: 'professional' } });
  const m = await p.customer.create({ data: { tenantId: tenant.id, name: 'Test', phone: '05000000022' } });

  const kur = async (seri) => {
    const c = await p.device.create({
      data: {
        tenantId: tenant.id, customerId: m.id, brand: 'Test', model: 'X', serialNo: seri,
        isRental: true, monthlyRent: 100, counterBlack: 0, counterColor: 0,
        publicCode: seri, qrTokenHash: 'x',
      },
    });
    const yaz = (deger, delta, gun, billed = false) => p.counterReading.create({
      data: {
        tenantId: tenant.id, deviceId: c.id, counterBlack: deger, counterColor: 0,
        deltaBlack: delta, deltaColor: 0, readingDate: new Date(`2026-0${gun}-15T10:00:00`), billed,
      },
    });
    return { c, yaz };
  };

  console.log('\nZİNCİR ONARIMI\n');
  {
    const { c, yaz } = await kur('SIL-1');
    const r1 = await yaz(140000, 0, 1);
    const r2 = await yaz(150000, 10000, 2);
    const r3 = await yaz(160000, 10000, 3);

    const s = await okumaSil(tenant.id, c.id, r2.id);
    t('ortadaki okuma silinebiliyor', s.ok === true, s);

    const sonra = await p.counterReading.findUnique({ where: { id: r3.id } });
    t('SONRAKİ okumanın farkı düzeltildi (10.000 → 20.000)', sonra.deltaBlack === 20000, { fark: sonra.deltaBlack });

    const toplam = (await p.counterReading.findMany({ where: { deviceId: c.id } }))
      .reduce((a, x) => a + x.deltaBlack, 0);
    t('toplam sayfa korundu: 160.000 − 140.000 = 20.000', toplam === 20000, { toplam });

    const cihaz = await p.device.findUnique({ where: { id: c.id } });
    t('cihaz sayacı son okumaya eşit (160.000)', cihaz.counterBlack === 160000, { sayac: cihaz.counterBlack });
    // r1 hâlâ duruyor mu
    const kalan = await p.counterReading.count({ where: { deviceId: c.id } });
    t('yalnız silinen gitti (2 okuma kaldı)', kalan === 2, { kalan });
  }

  console.log('\nİLK OKUMA SİLİNİRSE\n');
  {
    const { c, yaz } = await kur('SIL-2');
    const r1 = await yaz(140000, 0, 1);
    const r2 = await yaz(150000, 10000, 2);

    await okumaSil(tenant.id, c.id, r1.id);
    const sonra = await p.counterReading.findUnique({ where: { id: r2.id } });
    t('zincirin başı olan okumanın farkı 0 olur (uydurma sayfa yazılmaz)', sonra.deltaBlack === 0, { fark: sonra.deltaBlack });
  }

  console.log('\nFATURALANMIŞ OKUMA KORUNUYOR\n');
  {
    const { c, yaz } = await kur('SIL-3');
    const r1 = await yaz(140000, 0, 1);
    const r2 = await yaz(150000, 10000, 2);
    await yaz(160000, 10000, 3, true); // sonraki FATURALANMIŞ

    const s = await okumaSil(tenant.id, c.id, r2.id);
    t('sonrası faturalanmışsa silme REDDEDİLİR', !!s.hata, s);

    const duruyor = await p.counterReading.findUnique({ where: { id: r2.id } });
    t('reddedilince okuma silinmedi', !!duruyor, { silindiMi: !duruyor });

    // Faturalanmış okumanın kendisi de silinemez
    const faturali = await p.counterReading.findFirst({ where: { deviceId: c.id, billed: true } });
    const s2 = await okumaSil(tenant.id, c.id, faturali.id);
    t('faturalanmış okumanın KENDİSİ de silinemez', !!s2.hata, s2);
    void r1;
  }

} finally {
  if (tenant) await p.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
