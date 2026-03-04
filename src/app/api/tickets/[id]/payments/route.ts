import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PaymentStatus } from '@prisma/client';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payments = await prisma.payment.findMany({
        where: { ticketId: id },
        orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(payments);
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: ticketId } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await req.json();
        const amount = parseFloat(body.amount);
        if (!amount || amount <= 0) return NextResponse.json({ error: 'Geçersiz tutar' }, { status: 400 });

        // Ticket + müşteri bilgilerini al
        const ticket = await prisma.serviceTicket.findUnique({
            where: { id: ticketId },
            include: { device: { include: { customer: true } } },
        });
        if (!ticket) return NextResponse.json({ error: 'Fiş bulunamadı' }, { status: 404 });

        // Tüm ödemelerin toplamını hesapla
        const existing = await prisma.payment.aggregate({
            where: { ticketId },
            _sum: { amount: true },
        });
        const totalPaid = Number(existing._sum.amount || 0) + amount;
        const totalCost = Number(ticket.totalCost);

        let newPaymentStatus: string;
        if (totalPaid >= totalCost) newPaymentStatus = 'PAID';
        else if (totalPaid > 0) newPaymentStatus = 'PARTIAL';
        else newPaymentStatus = 'UNPAID';

        const method = body.method || 'CASH';
        const customerId = ticket.device.customer.id;
        const ticketNumber = ticket.ticketNumber;
        const methodLabels: Record<string, string> = { CASH: 'Nakit', CARD: 'Kart', TRANSFER: 'Havale', OTHER: 'Diğer' };

        // Atomik işlem: Ödeme + fiş güncelleme + muhasebe otomatik kaydı
        const [payment] = await prisma.$transaction([
            prisma.payment.create({
                data: {
                    tenantId: user.tenantId,
                    ticketId,
                    amount,
                    method,
                    notes: body.note || null,
                },
            }),
            prisma.serviceTicket.update({
                where: { id: ticketId },
                data: { paymentStatus: newPaymentStatus as PaymentStatus },
            }),
            // ─── Otomatik Muhasebe → Servis Ücreti Geliri ───────────────────
            prisma.financialTransaction.create({
                data: {
                    tenantId: user.tenantId,
                    type: 'INCOME',
                    category: 'SERVICE_FEE',
                    amount,
                    method,
                    description: `[${ticketNumber}] Servis Ödemesi — ${methodLabels[method] || method}`,
                    customerId,
                    ticketId,
                    date: new Date(),
                },
            }),
        ]);

        return NextResponse.json({ ...payment, newPaymentStatus });
    } catch (e: any) {
        console.error('PAYMENT ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
