import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';
import { syncTicketToCari } from '@/lib/ticket-cari';

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
            ticketNumber: p.ticketId ? (ticketMap.get(p.ticketId) || '—') : '—',
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

        // Sil + fiş durumu + gelir kaydı temizliği TEK $transaction'da (kısmi yazma olmaz).
        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findFirst({
                where: { id: paymentId, tenantId: user.tenantId },   // tenant guard
                include: { ticket: { include: { payments: true } } },
            });
            if (!payment) return { notFound: true as const };

            await tx.payment.delete({ where: { id: paymentId } });

            let status: PaymentStatus | null = null, totalPaid = 0, remaining = 0;
            if (payment.ticketId && payment.ticket) {
                const remainingPayments = payment.ticket.payments.filter(p => p.id !== paymentId);
                totalPaid = remainingPayments.reduce((s, p) => s + Number(p.amount), 0);
                const totalCost = Number(payment.ticket.totalCost);
                status = (totalPaid >= totalCost ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID') as PaymentStatus;
                remaining = Math.max(0, totalCost - totalPaid);
                await tx.serviceTicket.update({ where: { id: payment.ticketId }, data: { paymentStatus: status } });

                // Bu ödemeye ait gelir kaydından EN FAZLA BİRİNİ sil (eşit tutarlı iki tahsilatta ikisini birden silmesin).
                const ft = await tx.financialTransaction.findFirst({
                    where: { tenantId: user.tenantId, ticketId: payment.ticketId, amount: payment.amount, description: { contains: 'Borç ödemesi' } },
                    select: { id: true },
                });
                if (ft) await tx.financialTransaction.delete({ where: { id: ft.id } });
            }
            return { notFound: false as const, ticketId: payment.ticketId, status, totalPaid, remaining };
        });

        if (result.notFound) return NextResponse.json({ error: 'Ödeme bulunamadı' }, { status: 404 });

        // P0 FIX: Cari (AccountEntry) defterini gerçek duruma göre yeniden uzlaştır — silinen tahsilat cariden düşer.
        if (result.ticketId) {
            try { await syncTicketToCari(result.ticketId, user.tenantId); }
            catch (e: any) { console.error('PAYMENT DELETE CARI SYNC ERROR:', e?.message); }
        }

        return NextResponse.json({ success: true, newPaymentStatus: result.status, totalPaid: result.totalPaid, remaining: result.remaining });
    } catch (e: any) {
        console.error('PAYMENT DELETE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
