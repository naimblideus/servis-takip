import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/accounting/debtors/pay — Borçluya ödeme al (tekli veya çoklu fiş)
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    try {
        const body = await req.json();
        const { ticketId, amount, method, notes } = body;

        if (!ticketId || !amount || amount <= 0) {
            return NextResponse.json({ error: 'ticketId ve amount zorunlu' }, { status: 400 });
        }

        const ticket = await prisma.serviceTicket.findUnique({
            where: { id: ticketId },
            include: { payments: true },
        });

        if (!ticket) return NextResponse.json({ error: 'Fiş bulunamadı' }, { status: 404 });

        const currentPaid = ticket.payments.reduce((s, p) => s + Number(p.amount), 0);
        const totalCost = Number(ticket.totalCost);
        const maxPayable = totalCost - currentPaid;

        if (maxPayable <= 0) {
            return NextResponse.json({ error: 'Bu fiş zaten tamamen ödenmiş' }, { status: 400 });
        }

        const payAmount = Math.min(parseFloat(amount), maxPayable);
        const totalPaid = currentPaid + payAmount;

        // Ödeme kaydı oluştur
        const payment = await prisma.payment.create({
            data: {
                tenantId: user.tenantId,
                ticketId,
                amount: payAmount,
                method: method || 'CASH',
                paymentDate: new Date(),
                notes: notes || null,
            },
        });

        // Ödeme durumunu güncelle
        let newStatus = 'PARTIAL';
        if (totalPaid >= totalCost) newStatus = 'PAID';
        if (totalPaid <= 0) newStatus = 'UNPAID';

        await prisma.serviceTicket.update({
            where: { id: ticketId },
            data: { paymentStatus: newStatus },
        });

        // Muhasebe kaydı oluştur
        await prisma.financialTransaction.create({
            data: {
                tenantId: user.tenantId,
                type: 'INCOME',
                category: 'SERVICE_FEE',
                amount: payAmount,
                method: method || 'CASH',
                description: `Borç ödemesi: ${ticket.ticketNumber}${notes ? ` — ${notes}` : ''}`,
                customerId: ticket.customerId,
                ticketId: ticket.id,
                date: new Date(),
            },
        });

        return NextResponse.json({
            payment,
            newPaymentStatus: newStatus,
            totalPaid,
            totalCost,
            remaining: Math.max(0, totalCost - totalPaid),
        });
    } catch (e: any) {
        console.error('DEBTOR PAY ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
