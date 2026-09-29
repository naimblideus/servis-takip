import { NextRequest, NextResponse } from 'next/server';
import { garantiDurumu, donemAraligi } from '@/lib/ilk-ay-garantisi';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: tenantId } = await params;
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [userCount, totalTickets, thisMonthTickets, customerCount, deviceCount, tenant] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.serviceTicket.count({ where: { tenantId } }),
        prisma.serviceTicket.count({ where: { tenantId, createdAt: { gte: firstOfMonth } } }),
        prisma.customer.count({ where: { tenantId } }),
        prisma.device.count({ where: { tenantId } }),
        prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { maxUsers: true, maxTicketsPerMonth: true, storageLimitMB: true, storageUsedMB: true, plan: true } as any,
        }),
    ]);

    const lastUser = await prisma.user.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
    });

    // ── İLK AY GARANTİSİ ────────────────────────────────────────────────
    // Tanıtım sayfasının sözü: ilk ödenen ay sayaç okutan bayi iade isteyebilir.
    // Hak veriden türetiliyor; iadenin kendisi elle yapılır.
    const ilkOdenen = await prisma.tenantInvoice.findFirst({
        where: { tenantId, status: 'paid' },
        orderBy: { period: 'asc' },
        select: { period: true },
    });
    const aralik = ilkOdenen ? donemAraligi(ilkOdenen.period) : null;
    const [okumaSayisi, okunan, kiralikCihaz] = aralik
        ? await Promise.all([
            prisma.counterReading.count({ where: { tenantId, readingDate: { gte: aralik.bas, lt: aralik.bit } } }),
            prisma.counterReading.groupBy({ by: ['deviceId'], where: { tenantId, readingDate: { gte: aralik.bas, lt: aralik.bit } } }),
            prisma.device.count({ where: { tenantId, isRental: true } }),
        ])
        : [0, [], 0];
    const garanti = garantiDurumu({
        plan: (tenant as any)?.plan ?? null,
        ilkOdenenDonem: ilkOdenen?.period ?? null,
        okuma: { okumaSayisi, okunanCihaz: okunan.length, kiralikCihaz },
        simdi: now,
    });

    return NextResponse.json({
        garanti,
        userCount,
        maxUsers: (tenant as any)?.maxUsers ?? 0,
        totalTickets,
        thisMonthTickets,
        maxTicketsPerMonth: (tenant as any)?.maxTicketsPerMonth,
        customerCount,
        deviceCount,
        storageUsedMB: (tenant as any)?.storageUsedMB ?? 0,
        storageLimitMB: (tenant as any)?.storageLimitMB ?? 500,
        lastActivity: lastUser?.updatedAt,
    });
}
