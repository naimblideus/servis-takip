import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';

// GET /api/accounting/debtors/payments?customerId=xxx — Müşterinin ödeme geçmişi
export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
        return NextResponse.json({ error: 'customerId zorunlu' }, { status: 400 });
    }

    // Müşterinin tüm servis fişlerini bul
    const tickets = await prisma.serviceTicket.findMany({
        where: {
            tenantId: user.tenantId,
            customerId,
        },
        select: { id: true, ticketNumber: true },
    });

    const ticketIds = tickets.map(t => t.id);
    const ticketMap = new Map(tickets.map(t => [t.id, t.ticketNumber]));

    // Bu fişlere ait tüm ödemeleri getir
    const payments = await prisma.payment.findMany({
        where: {
            tenantId: user.tenantId,
            ticketId: { in: ticketIds },
        },
        orderBy: { paymentDate: 'desc' },
    });

    return NextResponse.json({
        payments: payments.map(p => ({
            id: p.id,
            ticketId: p.ticketId,
            ticketNumber: ticketMap.get(p.ticketId) || '—',
            amount: Number(p.amount),
            method: p.method,
            paymentDate: p.paymentDate.toISOString(),
            notes: p.notes,
            createdAt: p.createdAt.toISOString(),
        })),
        total: payments.reduce((s, p) => s + Number(p.amount), 0),
        count: payments.length,
    });
}

// DELETE /api/accounting/debtors/payments — Ödeme silme/iptal
export async function DELETE(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    try {
        const { searchParams } = new URL(req.url);
        const paymentId = searchParams.get('paymentId');

        if (!paymentId) {
            return NextResponse.json({ error: 'paymentId zorunlu' }, { status: 400 });
        }

        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { ticket: { include: { payments: true } } },
        });

        if (!payment || payment.tenantId !== user.tenantId) {
            return NextResponse.json({ error: 'Ödeme bulunamadı' }, { status: 404 });
        }

        // Ödemeyi sil
        await prisma.payment.delete({ where: { id: paymentId } });

        // Fiş ödeme durumunu geri hesapla
        const remainingPayments = payment.ticket.payments.filter(p => p.id !== paymentId);
        const totalPaid = remainingPayments.reduce((s, p) => s + Number(p.amount), 0);
        const totalCost = Number(payment.ticket.totalCost);

        let newStatus = 'UNPAID';
        if (totalPaid > 0 && totalPaid < totalCost) newStatus = 'PARTIAL';
        if (totalPaid >= totalCost) newStatus = 'PAID';

        await prisma.serviceTicket.update({
            where: { id: payment.ticketId },
            data: { paymentStatus: newStatus as PaymentStatus },
        });

        // İlgili muhasebe kaydını da sil (varsa)
        await prisma.financialTransaction.deleteMany({
            where: {
                tenantId: user.tenantId,
                ticketId: payment.ticketId,
                amount: payment.amount,
                description: { contains: 'Borç ödemesi' },
            },
        });

        return NextResponse.json({
            success: true,
            newPaymentStatus: newStatus,
            totalPaid,
            remaining: Math.max(0, totalCost - totalPaid),
        });
    } catch (e: any) {
        console.error('PAYMENT DELETE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
