import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dailyRate, forecastChannel, soonestDaysLeft, type TonerReadingPoint } from '@/lib/toner';

// GET /api/toner — toner takibi açık cihazların tükenme tahmini (proaktif sevkiyat listesi).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Toner takibi tanımlı cihazlar (S/B veya renkli verim girilmiş)
  const devices = await prisma.device.findMany({
    where: {
      tenantId: user.tenantId,
      OR: [{ tonerYieldBlack: { not: null } }, { tonerYieldColor: { not: null } }],
    },
    include: { customer: { select: { id: true, name: true, phone: true, address: true } } },
  });

  const ids = devices.map((d) => d.id);
  // Son 120 günün okumaları — hız hesabı için (tek sorgu, JS'te grupla)
  const since = new Date(Date.now() - 120 * 86400000);
  const readings = ids.length
    ? await prisma.counterReading.findMany({
        where: { tenantId: user.tenantId, deviceId: { in: ids }, readingDate: { gte: since } },
        select: { deviceId: true, counterBlack: true, counterColor: true, readingDate: true },
        orderBy: { readingDate: 'asc' },
      })
    : [];
  const byDevice = new Map<string, TonerReadingPoint[]>();
  for (const r of readings) {
    const arr = byDevice.get(r.deviceId) || [];
    arr.push({ readingDate: r.readingDate, counterBlack: r.counterBlack, counterColor: r.counterColor });
    byDevice.set(r.deviceId, arr);
  }

  const items = devices.map((d) => {
    const pts = byDevice.get(d.id) || [];
    const black = forecastChannel({
      yieldPages: d.tonerYieldBlack ?? null,
      reset: d.tonerResetBlack ?? null,
      current: d.counterBlack ?? null,
      rate: dailyRate(pts, 'black'),
      channel: 'black',
    });
    const color = forecastChannel({
      yieldPages: d.tonerYieldColor ?? null,
      reset: d.tonerResetColor ?? null,
      current: d.counterColor ?? null,
      rate: dailyRate(pts, 'color'),
      channel: 'color',
    });
    const soonest = soonestDaysLeft([black, color]);
    const needsSetup = (black?.needsSetup || color?.needsSetup) ?? false;
    return {
      id: d.id, brand: d.brand, model: d.model, serialNo: d.serialNo, location: d.location,
      customer: d.customer,
      tonerChangedAt: d.tonerChangedAt ? d.tonerChangedAt.toISOString() : null,
      black, color, soonestDaysLeft: soonest, needsSetup,
    };
  });

  // Sıralama: gün sayısı olanlar (en acil önce) → veri bekleyenler → kurulum bekleyenler
  items.sort((a, b) => {
    const ax = a.soonestDaysLeft, bx = b.soonestDaysLeft;
    if (ax == null && bx == null) return 0;
    if (ax == null) return 1;
    if (bx == null) return -1;
    return ax - bx;
  });

  const urgent = items.filter((i) => i.soonestDaysLeft != null && (i.soonestDaysLeft as number) <= 14).length;
  return NextResponse.json({ items, trackedCount: devices.length, urgent });
}
