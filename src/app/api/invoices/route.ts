import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildInvoiceForCustomerPeriod, periodOf } from '@/lib/invoicing';
import { docToken } from '@/lib/doc-token';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// GET /api/invoices — Müşteri faturaları listesi + özet
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const period = searchParams.get('period');

  const where: any = { tenantId: user.tenantId, deletedAt: null };
  if (status && status !== 'all') where.status = status;
  if (period) where.period = period;
  if (search?.trim()) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const invoices = await prisma.customerInvoice.findMany({
    where,
    orderBy: { invoiceDate: 'desc' },
    take: 200,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      lines: true,
    },
  });

  const all = await prisma.customerInvoice.findMany({
    where: { tenantId: user.tenantId, deletedAt: null, status: { not: 'CANCELLED' } },
    select: { totalAmount: true, paidAmount: true, status: true },
  });
  const summary = {
    count: all.length,
    total: round2(all.reduce((s, i) => s + Number(i.totalAmount), 0)),
    open: round2(all.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0)),
    overdue: round2(
      all.filter((i) => i.status === 'OVERDUE').reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0)
    ),
    paidCount: all.filter((i) => i.status === 'PAID').length,
  };

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      id: i.id,
      docToken: docToken('fatura', i.id),
      invoiceNumber: i.invoiceNumber,
      period: i.period,
      invoiceDate: i.invoiceDate.toISOString(),
      dueDate: i.dueDate.toISOString(),
      status: i.status,
      source: i.source,
      customer: i.customer,
      subtotal: Number(i.subtotal),
      vatAmount: Number(i.vatAmount),
      totalAmount: Number(i.totalAmount),
      paidAmount: Number(i.paidAmount),
      openAmount: round2(Number(i.totalAmount) - Number(i.paidAmount)),
      lines: i.lines.map((l) => ({
        kind: l.kind,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        lineTotal: Number(l.lineTotal),
      })),
    })),
    summary,
  });
}

// POST /api/invoices — Bu tenant için dönem faturalarını manuel üret (idempotent)
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* boş */
  }
  const period = body.period || periodOf();

  const customers = await prisma.customer.findMany({
    where: { tenantId: user.tenantId },
    select: { id: true },
  });

  let created = 0;
  let total = 0;
  let errors = 0;
  for (const c of customers) {
    try {
      const inv = await buildInvoiceForCustomerPeriod(user.tenantId, c.id, period, 'AUTO_MONTHLY');
      if (inv) {
        created++;
        total += Number(inv.totalAmount);
      }
    } catch (e: any) {
      errors++;
      console.error('INVOICE MANUAL ERROR:', e?.message);
    }
  }

  return NextResponse.json({ ok: true, period, created, total: round2(total), errors });
}
