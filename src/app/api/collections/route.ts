import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { allocatePayment } from '@/lib/invoicing';
import { docToken } from '@/lib/doc-token';

// POST — cari-bazlı tahsilat (IBAN/havale/nakit) → FIFO otomatik mahsup, onaysız
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  try {
    const body = await req.json();
    const { customerId, amount, method, referenceNo, date } = body;
    if (!customerId || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'customerId ve amount (>0) zorunlu' }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!customer) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });

    const result = await allocatePayment({
      tenantId: user.tenantId,
      customerId,
      amount: Number(amount),
      method: method || 'TRANSFER',
      referenceNo: referenceNo || null,
      date: date ? new Date(date) : undefined,
    });

    return NextResponse.json({ success: true, ...result, receiptToken: docToken('makbuz', result.paymentId) });
  } catch (e: any) {
    console.error('COLLECTION ERROR:', e?.message);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// GET ?customerId= — açık faturalar (tahsilat öncesi FIFO mahsup önizlemesi)
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');
  if (!customerId) return NextResponse.json({ error: 'customerId zorunlu' }, { status: 400 });

  const invoices = await prisma.customerInvoice.findMany({
    where: {
      tenantId: user.tenantId,
      customerId,
      status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] },
      deletedAt: null,
    },
    orderBy: [{ dueDate: 'asc' }, { invoiceDate: 'asc' }],
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
    },
  });

  const openTotal = invoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0);

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      invoiceDate: i.invoiceDate.toISOString(),
      dueDate: i.dueDate.toISOString(),
      status: i.status,
      totalAmount: Number(i.totalAmount),
      paidAmount: Number(i.paidAmount),
      openAmount: Math.round((Number(i.totalAmount) - Number(i.paidAmount)) * 100) / 100,
    })),
    openTotal: Math.round(openTotal * 100) / 100,
  });
}
