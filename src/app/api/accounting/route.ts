import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Gelir/Gider listeleme + istatistikler
export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // INCOME | EXPENSE | null (all)
    const category = searchParams.get('category');
    const customerId = searchParams.get('customerId');
    const month = searchParams.get('month'); // 2026-02 format
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = { tenantId: user.tenantId };
    if (type) where.type = type;
    if (category) where.category = category;
    if (customerId) where.customerId = customerId;

    if (month) {
        const [y, m] = month.split('-').map(Number);
        where.date = {
            gte: new Date(y, m - 1, 1),
            lt: new Date(y, m, 1),
        };
    }

    const [transactions, totals] = await Promise.all([
        prisma.financialTransaction.findMany({
            where,
            orderBy: { date: 'desc' },
            take: limit,
            include: {
                customer: { select: { name: true } },
                ticket: { select: { ticketNumber: true } },
            },
        }),
        // Toplam gelir/gider (seçili filtre için)
        prisma.financialTransaction.groupBy({
            by: ['type'],
            where: { tenantId: user.tenantId, ...(month ? where.date ? { date: where.date } : {} : {}) },
            _sum: { amount: true },
        }),
    ]);

    // Bu ay özeti
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [monthlyStats, categoryStats] = await Promise.all([
        prisma.financialTransaction.groupBy({
            by: ['type'],
            where: { tenantId: user.tenantId, date: { gte: monthStart, lt: monthEnd } },
            _sum: { amount: true },
        }),
        prisma.financialTransaction.groupBy({
            by: ['category'],
            where: { tenantId: user.tenantId, date: { gte: monthStart, lt: monthEnd } },
            _sum: { amount: true },
            _count: true,
        }),
    ]);

    const monthlyIncome = Number(monthlyStats.find(s => s.type === 'INCOME')?._sum.amount || 0);
    const monthlyExpense = Number(monthlyStats.find(s => s.type === 'EXPENSE')?._sum.amount || 0);

    return NextResponse.json({
        transactions,
        summary: {
            totalIncome: Number(totals.find(t => t.type === 'INCOME')?._sum.amount || 0),
            totalExpense: Number(totals.find(t => t.type === 'EXPENSE')?._sum.amount || 0),
        },
        monthly: {
            income: monthlyIncome,
            expense: monthlyExpense,
            profit: monthlyIncome - monthlyExpense,
        },
        categoryStats: categoryStats.map(c => ({
            category: c.category,
            total: Number(c._sum.amount),
            count: c._count,
        })),
    });
}

// Yeni gelir/gider ekle
export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    try {
        const body = await req.json();
        const { type, category, amount, method, description, customerId, ticketId, readingId, date } = body;

        if (!type || !category || !amount || !description) {
            return NextResponse.json({ error: 'type, category, amount, description zorunlu' }, { status: 400 });
        }

        const tx = await prisma.financialTransaction.create({
            data: {
                tenantId: user.tenantId,
                type,
                category,
                amount: parseFloat(amount),
                method: method || 'CASH',
                description,
                customerId: customerId || null,
                ticketId: ticketId || null,
                readingId: readingId || null,
                date: date ? new Date(date) : new Date(),
            },
        });

        return NextResponse.json(tx);
    } catch (e: any) {
        console.error('TRANSACTION CREATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
