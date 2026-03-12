import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { paidAmount, paidDate, paymentMethod, notes } = await req.json();

    const invoice = await (prisma as any).tenantInvoice.update({
        where: { id },
        data: {
            status: 'paid',
            paidAmount: paidAmount || null,
            paidDate: paidDate ? new Date(paidDate) : new Date(),
            paymentMethod: paymentMethod || 'transfer',
            notes: notes || null,
        },
    });

    return NextResponse.json(invoice);
}
