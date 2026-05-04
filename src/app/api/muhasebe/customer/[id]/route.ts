import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/muhasebe/customer/[id] — Belirli müşterinin hesap detayları
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;

    // Müşteri bilgisi
    const customer = await prisma.customer.findFirst({
        where: { id, tenantId: user.tenantId },
        select: { id: true, name: true, phone: true, address: true, email: true },
    });

    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    // Tüm kayıtları al
    const entries = await prisma.accountEntry.findMany({
        where: { tenantId: user.tenantId, customerId: id },
        orderBy: { date: 'desc' },
    });

    // Satışlar ve ödemeler
    const sales = entries.filter(e => e.type === 'SALE');
    const payments = entries.filter(e => e.type === 'PAYMENT');

    const totalSales = sales.reduce((s, e) => s + Number(e.amount), 0);
    const totalPayments = payments.reduce((s, e) => s + Number(e.amount), 0);
    const balance = totalSales - totalPayments; // pozitif = borçlu

    return NextResponse.json({
        customer,
        entries,
        sales,
        payments,
        summary: {
            totalSales,
            totalPayments,
            balance,
            entryCount: entries.length,
        },
    });
}
