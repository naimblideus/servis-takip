import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { counterOverage } from '@/lib/invoicing';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// GET /api/revenue-risk — bu dönem KAZANILMIŞ ama HENÜZ FATURALANMAMIŞ gelir:
//  (a) okundu ama faturalanmamış sayaç (aşım tutarı)  (b) bu dönem kirası kesilmemiş kiralık cihazlar
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { pricePerBlack: true, pricePerColor: true },
  });
  if (!tenant) return NextResponse.json({ error: 'Tenant bulunamadı' }, { status: 404 });

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const devices = await prisma.device.findMany({
    where: { tenantId: user.tenantId, isRental: true },
    include: { customer: { select: { id: true, name: true, phone: true, address: true } } },
  });
  const ids = devices.map((d) => d.id);

  // Bu dönem faturalanmamış okumalar (tek sorgu, JS'te grupla)
  const readings = ids.length
    ? await prisma.counterReading.findMany({
        where: { tenantId: user.tenantId, deviceId: { in: ids }, billed: false, readingDate: { gte: start, lt: end } },
        select: { deviceId: true, deltaBlack: true, deltaColor: true },
      })
    : [];
  const sums = new Map<string, { b: number; c: number }>();
  for (const r of readings) {
    const s = sums.get(r.deviceId) || { b: 0, c: 0 };
    s.b += r.deltaBlack; s.c += r.deltaColor;
    sums.set(r.deviceId, s);
  }

  // Bu dönemde daha önce faturalanmış sayfalar — dahil paketin kümülatif (mükerrer indirimsiz) hesabı için
  const billedReadings = ids.length
    ? await prisma.counterReading.findMany({
        where: { tenantId: user.tenantId, deviceId: { in: ids }, billed: true, readingDate: { gte: start, lt: end } },
        select: { deviceId: true, deltaBlack: true, deltaColor: true },
      })
    : [];
  const prevSums = new Map<string, { b: number; c: number }>();
  for (const r of billedReadings) {
    const s = prevSums.get(r.deviceId) || { b: 0, c: 0 };
    s.b += r.deltaBlack; s.c += r.deltaColor;
    prevSums.set(r.deviceId, s);
  }

  const items: any[] = [];
  let counterTotal = 0;
  let rentTotal = 0;
  const affectedCustomers = new Set<string>();

  for (const d of devices) {
    const s = sums.get(d.id) || { b: 0, c: 0 };
    const prev = prevSums.get(d.id) || { b: 0, c: 0 };
    const ch = counterOverage(d, s.b, s.c, tenant, prev.b, prev.c);
    const counterAmount = ch.total; // aşım tutarı (dahil paket düşülmüş)
    const rentUncut = Number(d.monthlyRent) > 0 && d.lastInvoicedPeriod !== period;
    const rentAmount = rentUncut ? round2(Number(d.monthlyRent)) : 0;
    if (counterAmount <= 0 && rentAmount <= 0) continue;

    counterTotal += counterAmount;
    rentTotal += rentAmount;
    if (d.customer) affectedCustomers.add(d.customer.id);
    items.push({
      id: d.id, brand: d.brand, model: d.model, serialNo: d.serialNo, location: d.location,
      customer: d.customer,
      counterAmount: round2(counterAmount),
      billBlack: ch.billB, billColor: ch.billC,
      rentAmount,
      total: round2(counterAmount + rentAmount),
    });
  }

  items.sort((a, b) => b.total - a.total);

  return NextResponse.json({
    period,
    items,
    summary: {
      counterTotal: round2(counterTotal),
      rentTotal: round2(rentTotal),
      grandTotal: round2(counterTotal + rentTotal),
      deviceCount: items.length,
      customerCount: affectedCustomers.size,
    },
  });
}
