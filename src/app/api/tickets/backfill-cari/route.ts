import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncTicketToCari } from '@/lib/ticket-cari';

// POST /api/tickets/backfill-cari — Açık (iptal/silinmemiş, tutarı>0, müşterili) tüm servis fişlerini
// Muhasebe/Cari'ye işle. İdempotent (syncTicketToCari uzlaştırıcı). Yalnız ADMIN.
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! }, select: { tenantId: true, role: true } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Bu işlem için yönetici yetkisi gerekir' }, { status: 403 });

  const tickets = await prisma.serviceTicket.findMany({
    where: { tenantId: user.tenantId, deletedAt: null, status: { not: 'CANCELLED' }, totalCost: { gt: 0 }, customerId: { not: null } },
    select: { id: true },
  });

  let synced = 0;
  for (const t of tickets) {
    try { const r = await syncTicketToCari(t.id, user.tenantId); if (r.synced) synced++; }
    catch (e: any) { console.error('BACKFILL CARI ERROR', t.id, e?.message); }
  }

  return NextResponse.json({ ok: true, processed: tickets.length, synced });
}
