import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateInvoiceNumber } from '@/lib/tenant-manager';

// POST — tüm aktif abonelikler için aylık fatura üret
export async function POST(req: NextRequest) {
    const { period, dueDate } = await req.json();
    const targetPeriod = period || new Date().toISOString().slice(0, 7);

    const PLAN_PRICES: Record<string, number> = {
        starter: 299,
        professional: 599,
        enterprise: 1499,
    };

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

    const results: { tenantId: string; invoiceNumber: string; status: string }[] = [];

    for (const tenant of tenants) {
        // Bu dönem için fatura zaten var mı?
        const existing = await (prisma as any).tenantInvoice.findFirst({
            where: { tenantId: tenant.id, period: targetPeriod },
        });
        if (existing) {
            results.push({ tenantId: tenant.id, invoiceNumber: existing.invoiceNumber, status: 'skipped' });
            continue;
        }

        const amount = PLAN_PRICES[tenant.plan] || 299;
        const vatAmount = amount * 0.20;
        const totalAmount = amount + vatAmount;
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

        results.push({ tenantId: tenant.id, invoiceNumber, status: 'created' });
    }

    return NextResponse.json({ period: targetPeriod, total: results.length, results });
}
