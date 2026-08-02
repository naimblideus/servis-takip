/**
 * Güvenilirlik motoru — tüm raporların ortak çekirdeği.
 *
 * İKİ MÜŞTERİYE BİRDEN hizmet eder:
 *  1) BAYİ: "hangi cihazım zarar ettiriyor, hangisi yenilenmeli"
 *  2) ÜRETİCİ (Canon / Konica Minolta / Pantum): "bizim modellerimiz sahada nasıl davranıyor"
 * İkisi de aynı hesaptan çıkar; fark yalnızca kırılım ve anonimleştirmede.
 *
 * DEĞİŞMEZ KURALLAR
 *  - Veri yetersizse SAYI ÜRETİLMEZ. Az cihazdan "arıza oranı" çıkarmak uydurmadır.
 *  - Periyodik bakım ve kurulum ARIZA DEĞİLDİR; ayrı sayılır, yoksa oran şişer.
 *  - Yaşı bilinmeyen cihaz, yaşa bağlı hesaplara GİRMEZ (varsayılan yaş atanmaz).
 *  - installedAtPrecision=YEAR ise sonuç "±1 yıl" belirsizlik taşır; raporlar bunu belirtir.
 */
import { prisma } from '@/lib/prisma';
import { FAULT_CATEGORIES } from '@/lib/fault-categories';

/** Gerçek arıza sayılan kategori kodları (bakım/kurulum hariç). */
export const FAILURE_CODES = FAULT_CATEGORIES.filter((c) => c.isFailure).map((c) => c.code);

/** Model bazlı istatistik için gereken en az cihaz sayısı. Altında yorum yapılmaz. */
export const MIN_DEVICES_FOR_MODEL = 5;
/** Üreticiye giden toplu veride bir hücreyi göstermek için gereken en az bayi sayısı. */
export const MIN_TENANTS_FOR_OEM = 3;

export interface DeviceMetric {
  id: string;
  brand: string;
  model: string;
  serialNo: string;
  customerName: string | null;
  /** Yaş ay cinsinden; bilinmiyorsa null (varsayılan ATANMAZ) */
  ageMonths: number | null;
  agePrecision: 'YEAR' | 'MONTH' | 'DAY' | null;
  /** Penceredeki gerçek arıza sayısı (bakım/kurulum hariç) */
  failures: number;
  /** Penceredeki planlı ziyaret (bakım + kurulum) */
  planned: number;
  /** Kategorisi girilmemiş fiş — kapsam göstergesi */
  uncategorized: number;
  /** Parça ALIŞ maliyeti (satış değil) */
  partsCost: number;
  /** Fatura satırlarından gelen kira/sayaç geliri */
  revenue: number;
  isRental: boolean;
  monthlyRent: number;
}

export interface WindowOpts {
  /** Kaç aylık pencere (varsayılan 12) */
  months?: number;
}

function windowStart(months: number) {
  return new Date(Date.now() - months * 30.44 * 24 * 60 * 60 * 1000);
}

/** Cihaz bazlı ham metrikler. Bayi raporlarının temeli. */
export async function deviceMetrics(tenantId: string, opts: WindowOpts = {}): Promise<{ months: number; devices: DeviceMetric[] }> {
  const months = Math.min(36, Math.max(1, opts.months ?? 12));
  const since = windowStart(months);

  const devices = await prisma.device.findMany({
    where: { tenantId },
    select: {
      id: true, brand: true, model: true, serialNo: true,
      installedAt: true, installedAtPrecision: true,
      isRental: true, monthlyRent: true,
      customer: { select: { name: true } },
    },
  });
  if (!devices.length) return { months, devices: [] };

  const ids = devices.map((d) => d.id);

  // Fişleri tek sorguda çek, bellekte ayır (N+1 yok)
  const tickets = await prisma.serviceTicket.findMany({
    where: { tenantId, deviceId: { in: ids }, deletedAt: null, createdAt: { gte: since } },
    select: { deviceId: true, faultCategory: true },
  });

  const fail = new Map<string, number>();
  const plan = new Map<string, number>();
  const unc = new Map<string, number>();
  for (const t of tickets) {
    const m = !t.faultCategory ? unc : (FAILURE_CODES as string[]).includes(t.faultCategory) ? fail : plan;
    m.set(t.deviceId, (m.get(t.deviceId) || 0) + 1);
  }

  // Parça maliyeti — ALIŞ fiyatı
  const parts = await prisma.ticketPart.findMany({
    where: { tenantId, ticket: { deviceId: { in: ids }, deletedAt: null, createdAt: { gte: since } } },
    select: { quantity: true, ticket: { select: { deviceId: true } }, part: { select: { buyPrice: true } } },
  });
  const cost = new Map<string, number>();
  for (const p of parts) {
    const did = p.ticket?.deviceId;
    if (!did) continue;
    cost.set(did, (cost.get(did) || 0) + Number(p.part?.buyPrice || 0) * p.quantity);
  }

  // Gelir — fatura satırları
  const rev = new Map<string, number>();
  const revRows = await prisma.invoiceLine.groupBy({
    by: ['deviceId'],
    where: {
      tenantId, deviceId: { in: ids }, kind: { in: ['RENTAL', 'COUNTER'] },
      invoice: { deletedAt: null, invoiceDate: { gte: since } },
    },
    _sum: { lineTotal: true },
  });
  revRows.forEach((r) => { if (r.deviceId) rev.set(r.deviceId, Number(r._sum.lineTotal || 0)); });

  const now = Date.now();
  return {
    months,
    devices: devices.map((d) => ({
      id: d.id,
      brand: d.brand,
      model: d.model,
      serialNo: d.serialNo,
      customerName: d.customer?.name ?? null,
      ageMonths: d.installedAt ? Math.floor((now - d.installedAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44)) : null,
      agePrecision: (d.installedAtPrecision as DeviceMetric['agePrecision']) ?? null,
      failures: fail.get(d.id) || 0,
      planned: plan.get(d.id) || 0,
      uncategorized: unc.get(d.id) || 0,
      partsCost: cost.get(d.id) || 0,
      revenue: rev.get(d.id) || 0,
      isRental: d.isRental,
      monthlyRent: Number(d.monthlyRent || 0),
    })),
  };
}

export interface ModelStat {
  brand: string;
  model: string;
  deviceCount: number;
  /** Yaşı bilinen cihaz sayısı — kapsam göstergesi */
  withAge: number;
  avgAgeMonths: number | null;
  /** Cihaz başına yıllık gerçek arıza */
  failuresPerDeviceYear: number | null;
  totalFailures: number;
  totalPlanned: number;
  uncategorizedRatio: number;
  topFaults: { code: string; count: number }[];
  avgPartsCost: number | null;
  /** İstatistik güvenilir mi (yeterli cihaz + yeterli kategori kapsamı) */
  reliable: boolean;
  note: string | null;
}

/**
 * Marka/model bazlı güvenilirlik. Üreticiye satılacak ürünün ta kendisi —
 * tek bayide çalışırsa çok bayide de çalışır.
 */
export async function modelStats(
  tenantIds: string[] | null,
  opts: WindowOpts = {},
): Promise<{ months: number; models: ModelStat[] }> {
  const months = Math.min(36, Math.max(1, opts.months ?? 12));
  const since = windowStart(months);
  const scope = tenantIds ? { tenantId: { in: tenantIds } } : {};

  const devices = await prisma.device.findMany({
    where: scope,
    select: { id: true, brand: true, model: true, installedAt: true },
  });
  if (!devices.length) return { months, models: [] };

  const ids = devices.map((d) => d.id);
  const tickets = await prisma.serviceTicket.findMany({
    where: { ...scope, deviceId: { in: ids }, deletedAt: null, createdAt: { gte: since } },
    select: { deviceId: true, faultCategory: true },
  });
  const parts = await prisma.ticketPart.findMany({
    where: { ...scope, ticket: { deviceId: { in: ids }, deletedAt: null, createdAt: { gte: since } } },
    select: { quantity: true, ticket: { select: { deviceId: true } }, part: { select: { buyPrice: true } } },
  });

  const byDevice = new Map<string, { fail: number; plan: number; unc: number; cost: number; cats: Map<string, number> }>();
  const ensure = (id: string) => {
    let v = byDevice.get(id);
    if (!v) { v = { fail: 0, plan: 0, unc: 0, cost: 0, cats: new Map() }; byDevice.set(id, v); }
    return v;
  };
  for (const t of tickets) {
    const v = ensure(t.deviceId);
    if (!t.faultCategory) v.unc++;
    else if ((FAILURE_CODES as string[]).includes(t.faultCategory)) {
      v.fail++; v.cats.set(t.faultCategory, (v.cats.get(t.faultCategory) || 0) + 1);
    } else v.plan++;
  }
  for (const p of parts) {
    const did = p.ticket?.deviceId;
    if (!did) continue;
    ensure(did).cost += Number(p.part?.buyPrice || 0) * p.quantity;
  }

  // marka+model grupla
  const groups = new Map<string, { brand: string; model: string; devs: typeof devices }>();
  for (const d of devices) {
    const key = `${d.brand}|||${d.model}`;
    if (!groups.has(key)) groups.set(key, { brand: d.brand, model: d.model, devs: [] });
    groups.get(key)!.devs.push(d);
  }

  const now = Date.now();
  const models: ModelStat[] = [];
  for (const g of groups.values()) {
    const n = g.devs.length;
    const ages = g.devs
      .filter((d) => d.installedAt)
      .map((d) => (now - d.installedAt!.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    let fail = 0, plan = 0, unc = 0, cost = 0;
    const cats = new Map<string, number>();
    for (const d of g.devs) {
      const v = byDevice.get(d.id);
      if (!v) continue;
      fail += v.fail; plan += v.plan; unc += v.unc; cost += v.cost;
      v.cats.forEach((c, k) => cats.set(k, (cats.get(k) || 0) + c));
    }
    const toplamFis = fail + plan + unc;
    const uncRatio = toplamFis ? unc / toplamFis : 0;

    // Yeterli cihaz var mı + kategori kapsamı yeterli mi
    const yeterliCihaz = n >= MIN_DEVICES_FOR_MODEL;
    const yeterliKapsam = toplamFis === 0 ? true : uncRatio <= 0.5;
    const reliable = yeterliCihaz && yeterliKapsam;

    let note: string | null = null;
    if (!yeterliCihaz) note = `Sadece ${n} cihaz — istatistik için en az ${MIN_DEVICES_FOR_MODEL} gerekir`;
    else if (!yeterliKapsam) note = `Fişlerin %${Math.round(uncRatio * 100)}'inde arıza kategorisi yok`;

    models.push({
      brand: g.brand,
      model: g.model,
      deviceCount: n,
      withAge: ages.length,
      avgAgeMonths: ages.length ? Math.round(ages.reduce((s, x) => s + x, 0) / ages.length) : null,
      // cihaz-yıl başına arıza: pencere uzunluğunu hesaba katar
      failuresPerDeviceYear: reliable ? +(fail / n / (months / 12)).toFixed(2) : null,
      totalFailures: fail,
      totalPlanned: plan,
      uncategorizedRatio: +uncRatio.toFixed(2),
      topFaults: [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([code, count]) => ({ code, count })),
      avgPartsCost: reliable ? Math.round(cost / n) : null,
      reliable,
      note,
    });
  }

  models.sort((a, b) => (b.failuresPerDeviceYear ?? -1) - (a.failuresPerDeviceYear ?? -1) || b.deviceCount - a.deviceCount);
  return { months, models };
}
