import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateInvoiceNumber } from '@/lib/tenant-manager';
import { monthlyAmount, amountNote } from '@/lib/plan-pricing';

// POST — tüm aktif abonelikler için aylık fatura üret
export async function POST(req: NextRequest) {
    const { period, dueDate } = await req.json();
    const targetPeriod = period || new Date().toISOString().slice(0, 7);

    // Aktif ve trial olmayan tenantları al
    const tenants = await (prisma as any).tenant.findMany({
        where: {
            deletedAt: null,
            isActive: true,
            isSuspended: false,
            plan: { not: 'trial' },
        },
        select: { id: true, name: true, plan: true },
    });

    const results: { tenantId: string; invoiceNumber: string; status: string; note?: string }[] = [];

    // Kiralık cihaz sayıları — tek sorguda (bayi başına ayrı sorgu atma)
    const rentalCounts = new Map<string, number>();
    const grouped = await (prisma as any).device.groupBy({
        by: ['tenantId'],
        where: { isRental: true, tenantId: { in: tenants.map((t: any) => t.id) } },
        _count: { _all: true },
    });
    for (const g of grouped) rentalCounts.set(g.tenantId, g._count._all);

    for (const tenant of tenants) {
        // Bu dönem için fatura zaten var mı?
        const existing = await (prisma as any).tenantInvoice.findFirst({
            where: { tenantId: tenant.id, period: targetPeriod },
        });
        if (existing) {
            results.push({ tenantId: tenant.id, invoiceNumber: existing.invoiceNumber, status: 'skipped' });
            continue;
        }

        // Taban + dahil cihaz + cihaz başına aşım (satılan model buydu; eskiden düz paket
        // fiyatı kesiliyordu ve aşım hiç faturalanmıyordu).
        const b = monthlyAmount(tenant.plan, rentalCounts.get(tenant.id) || 0);
        const { amount, vatAmount, totalAmount } = b;
        const invoiceNumber = await generateInvoiceNumber();

        await (prisma as any).tenantInvoice.create({
            data: {
                tenantId: tenant.id,
                invoiceNumber,
                period: targetPeriod,
                amount,
                vatAmount,
                totalAmount,
                status: 'pending',
                dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 86400000),
            },
        });

        results.push({ tenantId: tenant.id, invoiceNumber, status: 'created', note: amountNote(b) });
    }

    return NextResponse.json({ period: targetPeriod, total: results.length, results });
}
