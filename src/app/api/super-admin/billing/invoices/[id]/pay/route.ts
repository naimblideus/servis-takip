import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST — faturayi ödenmiş olarak işaretle
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const { paidAmount, paidDate, paymentMethod, notes } = await req.json();

    const invoice = await (prisma as any).tenantInvoice.update({
        where: { id: params.id },
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
