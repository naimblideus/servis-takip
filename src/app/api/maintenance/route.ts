import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/maintenance — kiralık cihazların son sayaç okuma durumu (geç okunanlar = kaçan faturalama).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const devices = await prisma.device.findMany({
    where: { tenantId: user.tenantId, isRental: true },
    include: {
      customer: { select: { id: true, name: true, phone: true, address: true } },
      counterReadings: { orderBy: { readingDate: 'desc' }, take: 1, select: { readingDate: true } },
    },
  });

  const now = Date.now();
  const items = devices.map((d) => {
    const last = d.counterReadings[0]?.readingDate ?? null;
    const daysSince = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null;
    return {
      id: d.id, brand: d.brand, model: d.model, serialNo: d.serialNo, location: d.location,
      customer: d.customer,
      lastReadingAt: last, daysSince,
    };
  });

  // Hiç okunmamış önce, sonra en geç okunan üstte
  items.sort((a, b) => {
    if (a.daysSince === null && b.daysSince === null) return 0;
    if (a.daysSince === null) return -1;
    if (b.daysSince === null) return 1;
    return b.daysSince - a.daysSince;
  });

  return NextResponse.json({ items, rentalCount: devices.length });
}
