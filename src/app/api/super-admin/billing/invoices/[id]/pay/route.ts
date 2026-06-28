import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSuperAdminSession } from '@/lib/super-admin-auth';

// POST /api/super-admin/billing/invoices/[id]/pay — Tenant faturasını "ödendi" işaretle (YALNIZ super-admin)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // FAIL-CLOSED yetki: önceden HİÇ auth yoktu → herkes herhangi bir faturayı "paid" yapabiliyordu.
    const sa = await getSuperAdminSession();
    if (!sa) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { paidAmount, paidDate, paymentMethod, notes } = await req.json();

    // Atomik koşullu yazma: olmayan id sessizce count=0 → 404 (varlık enumerasyonu da engellenir).
    const res = await (prisma as any).tenantInvoice.updateMany({
        where: { id },
        data: {
            status: 'paid',
            paidAmount: paidAmount != null ? Number(paidAmount) : null,
            paidDate: paidDate ? new Date(paidDate) : new Date(),
            paymentMethod: paymentMethod || 'transfer',
            notes: notes || null,
        },
    });
    if (res.count === 0) return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 });

    const invoice = await (prisma as any).tenantInvoice.findUnique({ where: { id } });
    return NextResponse.json(invoice);
}
