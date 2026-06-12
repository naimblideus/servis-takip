import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// GET /api/ledger — Tek-kaynak cari defter (CustomerInvoice borç + InvoicePayment alacak)
// Çıktı şekli /api/muhasebe ile uyumlu (entries, customers, summary) + vade yaşlandırma.
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const filter = searchParams.get('filter'); // paid | unpaid | all
    const tenantId = user.tenantId;
    const now = Date.now();

    const invoices = await prisma.customerInvoice.findMany({
      where: { tenantId, deletedAt: null, status: { not: 'CANCELLED' } },
      select: {
        customerId: true,
        invoiceNumber: true,
        invoiceDate: true,
        period: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
      },
      orderBy: { invoiceDate: 'desc' },
    });

    type Bal = { sales: number; payments: number; overdue: number; d0: number; d30: number; d60: number; d90: number };
    const balances = new Map<string, Bal>();
    const get = (cid: string): Bal => {
      let b = balances.get(cid);
      if (!b) {
        b = { sales: 0, payments: 0, overdue: 0, d0: 0, d30: 0, d60: 0, d90: 0 };
        balances.set(cid, b);
      }
      return b;
    };

    for (const inv of invoices) {
      const b = get(inv.customerId);
      const total = Number(inv.totalAmount);
      const paid = Number(inv.paidAmount);
      b.sales += total;
      b.payments += paid;
      const open = total - paid;
      if (open > 0.001) {
        const days = Math.floor((now - inv.dueDate.getTime()) / 86400000);
        if (days > 0) b.overdue += open;
        if (days <= 0) b.d0 += open;
        else if (days <= 30) b.d30 += open;
        else if (days <= 60) b.d60 += open;
        else b.d90 += open;
      }
    }

    const customers = await prisma.customer.findMany({
      where: { tenantId },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    });

    let customerList = customers.map((c) => {
      const b = balances.get(c.id) || { sales: 0, payments: 0, overdue: 0, d0: 0, d30: 0, d60: 0, d90: 0 };
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalSales: round2(b.sales),
        totalPayments: round2(b.payments),
        balance: round2(b.sales - b.payments),
        overdue: round2(b.overdue),
        aging: { d0: round2(b.d0), d30: round2(b.d30), d60: round2(b.d60), d90: round2(b.d90) },
      };
    });

    if (search?.trim()) {
      const q = search.toLowerCase();
      customerList = customerList.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    if (filter === 'unpaid') customerList = customerList.filter((c) => c.balance > 0.001);
    else if (filter === 'paid') customerList = customerList.filter((c) => c.balance <= 0.001);

    const vals = [...balances.values()];
    const totalSales = round2(vals.reduce((s, b) => s + b.sales, 0));
    const totalPayments = round2(vals.reduce((s, b) => s + b.payments, 0));
    const totalOverdue = round2(vals.reduce((s, b) => s + b.overdue, 0));
    const debtorCount = vals.filter((b) => b.sales - b.payments > 0.001).length;

    // Son hareketler — fatura (borç) + tahsilat (alacak) birleşik
    const custMap = new Map(customers.map((c) => [c.id, c]));
    const recentPayments = await prisma.payment.findMany({
      where: { tenantId, customerId: { not: null } },
      orderBy: { paymentDate: 'desc' },
      take: 30,
      include: { customer: { select: { id: true, name: true, phone: true } } },
    });

    const entries = [
      ...invoices.slice(0, 30).map((i) => ({
        id: 'inv-' + i.invoiceNumber,
        type: 'SALE' as const,
        product: `Fatura ${i.invoiceNumber} (${i.period})`,
        amount: Number(i.totalAmount),
        method: '',
        date: i.invoiceDate.toISOString(),
        customer: custMap.get(i.customerId) ?? null,
      })),
      ...recentPayments.map((p) => ({
        id: p.id,
        type: 'PAYMENT' as const,
        product: null,
        amount: Number(p.amount),
        method: p.method,
        date: p.paymentDate.toISOString(),
        customer: p.customer,
      })),
    ]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 50);

    return NextResponse.json({
      entries,
      customers: customerList,
      summary: {
        totalSales,
        totalPayments,
        totalDebt: round2(totalSales - totalPayments),
        totalOverdue,
        debtorCount,
        customerCount: customers.length,
      },
    });
  } catch (e: any) {
    console.error('LEDGER GET ERROR:', e?.message);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
