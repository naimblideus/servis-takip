import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Müşteri cari hesap detayı
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: customerId } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, name: true, phone: true },
    });

    if (!customer) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });

    // Tüm işlemler
    const transactions = await prisma.financialTransaction.findMany({
        where: { tenantId: user.tenantId, customerId },
        orderBy: { date: 'desc' },
        include: { ticket: { select: { ticketNumber: true } } },
    });

    // Toplam gelir/gider
    const totals = await prisma.financialTransaction.groupBy({
        by: ['type'],
        where: { tenantId: user.tenantId, customerId },
        _sum: { amount: true },
    });

    const totalIncome = Number(totals.find(t => t.type === 'INCOME')?._sum.amount || 0);
    const totalExpense = Number(totals.find(t => t.type === 'EXPENSE')?._sum.amount || 0);

    // Ödenmemiş fişler
    const unpaidTickets = await prisma.serviceTicket.findMany({
        where: { tenantId: user.tenantId, customerId, paymentStatus: { in: ['UNPAID', 'PARTIAL'] } },
        select: { id: true, ticketNumber: true, totalCost: true, paymentStatus: true, createdAt: true },
    });

    const unpaidTotal = unpaidTickets.reduce((s, t) => s + Number(t.totalCost), 0);

    return NextResponse.json({
        customer,
        transactions,
        balance: {
            totalIncome,
            totalExpense,
            unpaidTotal,
            net: totalIncome - totalExpense,
        },
        unpaidTickets,
    });
}
