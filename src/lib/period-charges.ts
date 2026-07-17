// Manuel-tetikli kira + sayaç → CARİ (AccountEntry).
// Kullanıcı butona basınca hesaplanır ve cariye eklenir; OTOMATİK eklenmez (karışıklık önlenir).
// Mükerrer engeli faturalama ile AYNI bayraklar: CounterReading.billed + Device.lastInvoicedPeriod.
// Böylece bu yol ile "Bu Dönemi Faturala" yolu birbirini çift saymaz.
import { prisma } from '@/lib/prisma';
import { counterOverage, periodOf } from '@/lib/invoicing';
import type { Prisma } from '@prisma/client';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
function periodRange(period: string) {
  const [y, m] = period.split('-').map(Number);
  return { start: new Date(y, m - 1, 1, 0, 0, 0, 0), end: new Date(y, m, 1, 0, 0, 0, 0) };
}

export interface PeriodCharges {
  period: string;
  rent: number;
  counter: number;
  rentDetail: { device: string; amount: number }[];
  counterDetail: { device: string; amount: number }[];
  readingIds: string[];
  rentDeviceIds: string[];
}

// Cari'ye YAZMADAN, müşterinin bu dönem kira + sayaç bedelini hesapla (faturalama ile aynı mantık).
async function compute(tx: Prisma.TransactionClient | typeof prisma, tenantId: string, customerId: string): Promise<PeriodCharges> {
  const period = periodOf();
  const { start, end } = periodRange(period);
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { pricePerBlack: true, pricePerColor: true } });
  const devices = await tx.device.findMany({ where: { tenantId, customerId } });

  let rent = 0, counter = 0;
  const rentDetail: { device: string; amount: number }[] = [];
  const counterDetail: { device: string; amount: number }[] = [];
  const readingIds: string[] = [];
  const rentDeviceIds: string[] = [];

  for (const d of devices) {
    if (!d.isRental) continue;
    const label = `${d.brand} ${d.model}`;

    // Sayaç: bu dönem faturalanmamış okumalar
    const readings = await tx.counterReading.findMany({ where: { tenantId, deviceId: d.id, billed: false, readingDate: { gte: start, lt: end } } });
    let sb = 0, sc = 0;
    for (const r of readings) { sb += r.deltaBlack; sc += r.deltaColor; readingIds.push(r.id); }
    if (sb > 0 || sc > 0) {
      const prevAgg = await tx.counterReading.aggregate({ where: { tenantId, deviceId: d.id, billed: true, readingDate: { gte: start, lt: end } }, _sum: { deltaBlack: true, deltaColor: true } });
      const ch = counterOverage(d as any, sb, sc, tenant as any, prevAgg._sum.deltaBlack ?? 0, prevAgg._sum.deltaColor ?? 0);
      if (ch.total > 0) { counter += ch.total; counterDetail.push({ device: label, amount: ch.total }); }
    }

    // Kira: dönem başına 1 kez (lastInvoicedPeriod ile mükerrer engeli)
    if (Number(d.monthlyRent) > 0 && d.lastInvoicedPeriod !== period) {
      rent += Number(d.monthlyRent);
      rentDetail.push({ device: label, amount: Number(d.monthlyRent) });
      rentDeviceIds.push(d.id);
    }
  }

  return { period, rent: round2(rent), counter: round2(counter), rentDetail, counterDetail, readingIds, rentDeviceIds };
}

/** Önizleme — cari'ye yazmadan hesapla (kullanıcı onayından önce gösterilir). */
export function previewPeriodCharges(tenantId: string, customerId: string) {
  return compute(prisma, tenantId, customerId);
}

/** Onaydan sonra: kira + sayaç bedelini CARİ'ye SALE olarak ekle + mükerrer bayraklarını işaretle. */
export async function commitPeriodCharges(tenantId: string, customerId: string) {
  return prisma.$transaction(async (tx) => {
    const c = await compute(tx, tenantId, customerId);
    let added = 0;

    // ÖNCE CLAIM (atomik mükerrer engeli): işaretlemeyi CREATE'ten ÖNCE yap. updateMany row-lock +
    // koşullu where → eşzamanlı çift çağrıda ikinci count=0 alır, çift SALE (çift fatura) yazmaz.
    const readClaim = c.readingIds.length
      ? await tx.counterReading.updateMany({ where: { tenantId, id: { in: c.readingIds }, billed: false }, data: { billed: true } })
      : { count: 0 };
    const rentClaim = c.rentDeviceIds.length
      ? await tx.device.updateMany({ where: { tenantId, id: { in: c.rentDeviceIds }, lastInvoicedPeriod: { not: c.period } }, data: { lastInvoicedPeriod: c.period } })
      : { count: 0 };

    // SALE yalnız GERÇEKTEN bu çağrının claim ettiği kalemler için yazılır.
    if (c.rent > 0 && rentClaim.count > 0) {
      await tx.accountEntry.create({
        data: { tenantId, customerId, type: 'SALE', product: `Aylık Kira — ${c.period}`, amount: c.rent, method: 'OPEN_ACCOUNT', notes: 'Kira (elle eklendi)', date: new Date() },
      });
      added++;
    }
    if (c.counter > 0 && readClaim.count > 0) {
      await tx.accountEntry.create({
        data: { tenantId, customerId, type: 'SALE', product: `Sayaç — ${c.period}`, amount: c.counter, method: 'OPEN_ACCOUNT', notes: 'Sayaç (elle eklendi)', date: new Date() },
      });
      added++;
    }

    return { period: c.period, rent: c.rent, counter: c.counter, added };
  });
}
