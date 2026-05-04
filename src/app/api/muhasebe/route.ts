import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AccountEntryType, PaymentMethod } from '@prisma/client';

// GET /api/muhasebe — Tüm hesap kayıtlarını listele (filtrelerle)
export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const type = searchParams.get('type'); // SALE | PAYMENT
    const filter = searchParams.get('filter'); // paid | unpaid | all
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = { tenantId: user.tenantId };
    if (customerId) where.customerId = customerId;
    if (type) where.type = type;

    const entries = await prisma.accountEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
        include: {
            customer: { select: { id: true, name: true, phone: true } },
        },
    });

    // Müşteri bazlı borç hesaplama
    const allEntries = await prisma.accountEntry.findMany({
        where: { tenantId: user.tenantId },
        select: { customerId: true, type: true, amount: true },
    });

    const customerBalances = new Map<string, { sales: number; payments: number }>();
    for (const e of allEntries) {
        if (!customerBalances.has(e.customerId)) {
            customerBalances.set(e.customerId, { sales: 0, payments: 0 });
        }
        const bal = customerBalances.get(e.customerId)!;
        if (e.type === 'SALE') bal.sales += Number(e.amount);
        else bal.payments += Number(e.amount);
    }

    // Müşterileri al
    const customers = await prisma.customer.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true, name: true, phone: true },
        orderBy: { name: 'asc' },
    });

    // Filtreli müşteri listesi
    let customerList = customers.map(c => {
        const bal = customerBalances.get(c.id) || { sales: 0, payments: 0 };
        return {
            ...c,
            totalSales: bal.sales,
            totalPayments: bal.payments,
            balance: bal.sales - bal.payments, // pozitif = borçlu
        };
    });

    // Arama filtresi
    if (search?.trim()) {
        const q = search.toLowerCase();
        customerList = customerList.filter(c =>
            c.name.toLowerCase().includes(q) || c.phone.includes(q)
        );
    }

    // Ödeyen/ödemeyen filtresi
    if (filter === 'unpaid') {
        customerList = customerList.filter(c => c.balance > 0);
    } else if (filter === 'paid') {
        customerList = customerList.filter(c => c.balance <= 0);
    }

    // Toplam istatistikler
    const totalSales = Array.from(customerBalances.values()).reduce((s, b) => s + b.sales, 0);
    const totalPayments = Array.from(customerBalances.values()).reduce((s, b) => s + b.payments, 0);
    const totalDebt = totalSales - totalPayments;
    const debtorCount = Array.from(customerBalances.values()).filter(b => b.sales - b.payments > 0).length;

    return NextResponse.json({
        entries,
        customers: customerList,
        summary: {
            totalSales,
            totalPayments,
            totalDebt,
            debtorCount,
            customerCount: customers.length,
        },
    });
}

// POST /api/muhasebe — Yeni satış veya ödeme ekle
export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    try {
        const body = await req.json();
        const { customerId, type, product, amount, method, notes, date } = body;

        if (!customerId || !type || !amount) {
            return NextResponse.json({ error: 'customerId, type, amount zorunlu' }, { status: 400 });
        }

        if (type === 'SALE' && !product) {
            return NextResponse.json({ error: 'Satış kaydı için ürün/hizmet adı zorunlu' }, { status: 400 });
        }

        const entry = await prisma.accountEntry.create({
            data: {
                tenantId: user.tenantId,
                customerId,
                type: type as AccountEntryType,
                product: product || null,
                amount: parseFloat(amount),
                method: (method || 'CASH') as PaymentMethod,
                notes: notes || null,
                date: date ? new Date(date) : new Date(),
            },
            include: {
                customer: { select: { id: true, name: true, phone: true } },
            },
        });

        return NextResponse.json(entry);
    } catch (e: any) {
        console.error('ACCOUNT ENTRY CREATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE /api/muhasebe — Kayıt sil
export async function DELETE(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 });

    await prisma.accountEntry.deleteMany({
        where: { id, tenantId: user.tenantId },
    });

    return NextResponse.json({ success: true });
}
