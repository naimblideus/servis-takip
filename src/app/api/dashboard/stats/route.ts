import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findFirst({
    where: { email: session.user?.email! },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const tenantId = user.tenantId;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    openTickets,
    todayTickets,
    waitingParts,
    readyForPickup,
    monthRevenue,
    recentTickets,
    lowStockRaw,
  ] = await Promise.all([
    prisma.serviceTicket.count({
      where: { tenantId, status: { in: ['NEW', 'IN_SERVICE', 'WAITING_FOR_PART'] } },
    }),
    prisma.serviceTicket.count({
      where: { tenantId, createdAt: { gte: startOfDay } },
    }),
    prisma.serviceTicket.count({
      where: { tenantId, status: 'WAITING_FOR_PART' },
    }),
    prisma.serviceTicket.count({
      where: { tenantId, status: 'READY' },
    }),
    prisma.serviceTicket.aggregate({
      where: { tenantId, paymentStatus: 'PAID', updatedAt: { gte: startOfMonth } },
      _sum: { totalCost: true },
    }),
    prisma.serviceTicket.findMany({
      where: { tenantId },
      include: { device: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    // Kritik stok: tüm parçaları çekip JS'de filtrele
    prisma.part.findMany({
      where: { tenantId },
      select: { stockQty: true, minStock: true },
    }),
  ]);

  const lowStockItems = Array.isArray(lowStockRaw)
    ? lowStockRaw.filter((p: any) => p.stockQty <= p.minStock).length
    : 0;

  return NextResponse.json({
    openTickets,
    todayTickets,
    waitingParts,
    readyForPickup,
    monthRevenue: monthRevenue._sum.totalCost || 0,
    lowStockItems,
    recentTickets,
  });
}