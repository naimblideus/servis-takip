import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { markOverdueInvoices } from '@/lib/invoicing';

export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL-CLOSED: CRON_SECRET yoksa erişimi REDDET (asla open)
  const header = req.headers.get('authorization');
  const qp = new URL(req.url).searchParams.get('secret');
  return header === `Bearer ${secret}` || qp === secret;
}

async function run() {
  // 1) Vadesi geçen OPEN/PARTIAL faturaları OVERDUE yap
  const overdueCount = await markOverdueInvoices();

  // 2) reminderEnabled tenant'larda OVERDUE faturalar için hatırlatma kuyruğa (günde 1)
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null, isActive: true, reminderEnabled: true },
    select: { id: true },
  });

  let queued = 0;
  const since = new Date(Date.now() - 20 * 3600 * 1000); // aynı gün mükerrer önle

  for (const t of tenants) {
    const invoices = await prisma.customerInvoice.findMany({
      where: { tenantId: t.id, status: 'OVERDUE', deletedAt: null },
      include: { customer: { select: { name: true, phone: true } } },
    });
    for (const inv of invoices) {
      if (!inv.customer?.phone) continue;
      const recent = await prisma.notificationLog.findFirst({
        where: {
          tenantId: t.id,
          recipient: inv.customer.phone,
          channel: 'WHATSAPP',
          createdAt: { gte: since },
          message: { contains: inv.invoiceNumber },
        },
      });
      if (recent) continue;
      const open = (Number(inv.totalAmount) - Number(inv.paidAmount)).toFixed(2);
      await prisma.notificationLog.create({
        data: {
          tenantId: t.id,
          recipient: inv.customer.phone,
          channel: 'WHATSAPP',
          status: 'PENDING',
          message: `Sayın ${inv.customer.name}, ${inv.invoiceNumber} numaralı ${open} TL tutarındaki faturanızın vadesi geçmiştir. Ödemeniz için teşekkür ederiz.`,
        },
      });
      queued++;
    }
  }

  return { overdueCount, queued };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const res = await run();
  return NextResponse.json({ ok: true, ...res });
}
