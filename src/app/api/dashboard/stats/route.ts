import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Duran iş eşiği: durumu bu kadar gündür değişmemiş açık fişler "duruyor" sayılır.
const STUCK_DAYS = 3;

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
  const stuckBefore = new Date(now.getTime() - STUCK_DAYS * 24 * 3600 * 1000);

  // NOT: Tüm fiş sorgularında deletedAt:null ŞART — çöp kutusundaki fişler sayılara girmemeli
  // (liste sayfası zaten deletedAt:null filtreliyordu; kartlar şişik gösteriyordu).
  const OPEN_STATUSES = ['NEW', 'IN_SERVICE', 'WAITING_FOR_PART'] as const;

  const [
    openTickets,
    todayTickets,
    waitingParts,
    readyForPickup,
    monthRevenue,
    recentTickets,
    lowStockRaw,
    rentalDevices,
    stuckRaw,
  ] = await Promise.all([
    prisma.serviceTicket.count({
      where: { tenantId, deletedAt: null, status: { in: [...OPEN_STATUSES] } },
    }),
    prisma.serviceTicket.count({
      where: { tenantId, deletedAt: null, createdAt: { gte: startOfDay } },
    }),
    prisma.serviceTicket.count({
      where: { tenantId, deletedAt: null, status: 'WAITING_FOR_PART' },
    }),
    prisma.serviceTicket.count({
      where: { tenantId, deletedAt: null, status: 'READY' },
    }),
    prisma.serviceTicket.aggregate({
      where: { tenantId, deletedAt: null, paymentStatus: 'PAID', updatedAt: { gte: startOfMonth } },
      _sum: { totalCost: true },
    }),
    prisma.serviceTicket.findMany({
      where: { tenantId, deletedAt: null },
      include: { device: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.part.findMany({
      where: { tenantId },
      select: { stockQty: true, minStock: true },
    }),
    prisma.device.count({
      where: { tenantId, isRental: true },
    }),
    // DURAN İŞLER: açık ama STUCK_DAYS gündür durumu değişmemiş fişler (en uzun duran önce)
    prisma.serviceTicket.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: [...OPEN_STATUSES] },
        statusUpdatedAt: { lt: stuckBefore },
      },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        statusUpdatedAt: true,
        device: { select: { brand: true, model: true, customer: { select: { name: true, phone: true } } } },
        assignedUser: { select: { name: true } },
      },
      orderBy: { statusUpdatedAt: 'asc' },
      take: 50,
    }),
  ]);

  const lowStockItems = Array.isArray(lowStockRaw)
    ? lowStockRaw.filter((p: any) => p.stockQty <= p.minStock).length
    : 0;

  const stuckTickets = stuckRaw.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    status: t.status,
    days: Math.floor((now.getTime() - new Date(t.statusUpdatedAt).getTime()) / (24 * 3600 * 1000)),
    customerName: t.device?.customer?.name || '—',
    customerPhone: t.device?.customer?.phone || '',
    device: [t.device?.brand, t.device?.model].filter(Boolean).join(' '),
    technician: t.assignedUser?.name || null,
  }));

  return NextResponse.json({
    openTickets,
    todayTickets,
    waitingParts,
    readyForPickup,
    monthRevenue: monthRevenue._sum.totalCost || 0,
    lowStockItems,
    rentalDevices,
    recentTickets,
    stuckTickets,
    stuckDays: STUCK_DAYS,
  });
}
