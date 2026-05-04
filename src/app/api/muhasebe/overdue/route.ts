import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/muhasebe/overdue — Geciken borçlu müşteriler (dashboard + ana ekran için)
export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Tüm hesap kayıtları
    const entries = await prisma.accountEntry.findMany({
        where: { tenantId: user.tenantId },
        select: { customerId: true, type: true, amount: true, date: true },
        orderBy: { date: 'asc' },
    });

    // Müşteri bazlı borç hesapla
    const customerBalances = new Map<string, { sales: number; payments: number; lastSaleDate: Date | null }>();
    for (const e of entries) {
        if (!customerBalances.has(e.customerId)) {
            customerBalances.set(e.customerId, { sales: 0, payments: 0, lastSaleDate: null });
        }
        const bal = customerBalances.get(e.customerId)!;
        if (e.type === 'SALE') {
            bal.sales += Number(e.amount);
            if (!bal.lastSaleDate || e.date > bal.lastSaleDate) bal.lastSaleDate = e.date;
        } else {
            bal.payments += Number(e.amount);
        }
    }

    // Borçlu müşteri id'leri
    const debtorIds = Array.from(customerBalances.entries())
        .filter(([, bal]) => bal.sales - bal.payments > 0)
        .map(([id]) => id);

    if (debtorIds.length === 0) {
        return NextResponse.json({ debtors: [], summary: { totalDebtors: 0, totalDebt: 0 } });
    }

    // Müşteri bilgileri
    const customers = await prisma.customer.findMany({
        where: { id: { in: debtorIds }, tenantId: user.tenantId },
        select: { id: true, name: true, phone: true },
    });

    const debtors = customers.map(c => {
        const bal = customerBalances.get(c.id)!;
        const debt = bal.sales - bal.payments;
        const daysSinceLastSale = bal.lastSaleDate
            ? Math.floor((Date.now() - bal.lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
            : 0;
        return {
            customer: c,
            totalSales: bal.sales,
            totalPayments: bal.payments,
            debt,
            daysSinceLastSale,
        };
    }).sort((a, b) => b.debt - a.debt);

    const totalDebt = debtors.reduce((s, d) => s + d.debt, 0);

    return NextResponse.json({
        debtors,
        summary: {
            totalDebtors: debtors.length,
            totalDebt,
        },
    });
}
