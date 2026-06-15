import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/onboarding/status — ilk-giris durumu + veri-bazli baslangic rehberi adimlari
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findFirst({
    where: { email: session.user?.email! },
    select: { id: true, tenantId: true, onboardedAt: true, name: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Tenant'i olmayan kullanici (edge-case) -> onboarding'i atla (500 yerine)
  if (!user.tenantId) {
    return NextResponse.json({
      onboarded: true, userName: user.name,
      steps: { hasCustomers: false, hasDevices: false, hasTickets: false, hasInventory: false, hasInvoices: false, hasCollections: false },
    });
  }

  const t = user.tenantId;
  const [customers, devices, tickets, parts, invoices, payments] = await Promise.all([
    prisma.customer.count({ where: { tenantId: t } }),
    prisma.device.count({ where: { tenantId: t } }),
    prisma.serviceTicket.count({ where: { tenantId: t } }),
    prisma.part.count({ where: { tenantId: t } }),
    prisma.customerInvoice.count({ where: { tenantId: t, deletedAt: null } }),
    prisma.payment.count({ where: { tenantId: t } }),
  ]);

  return NextResponse.json({
    onboarded: user.onboardedAt !== null,
    userName: user.name,
    steps: {
      hasCustomers: customers > 0,
      hasDevices: devices > 0,
      hasTickets: tickets > 0,
      hasInventory: parts > 0,
      hasInvoices: invoices > 0,
      hasCollections: payments > 0,
    },
  });
}
