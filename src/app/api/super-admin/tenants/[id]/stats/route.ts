import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET — kullanım istatistikleri
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const tenantId = params.id;
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
        userCount,
        totalTickets,
        thisMonthTickets,
        customerCount,
        deviceCount,
        tenant,
    ] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.serviceTicket.count({ where: { tenantId } }),
        prisma.serviceTicket.count({ where: { tenantId, createdAt: { gte: firstOfMonth } } }),
        prisma.customer.count({ where: { tenantId } }),
        prisma.device.count({ where: { tenantId } }),
        prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { maxUsers: true, maxTicketsPerMonth: true, storageLimitMB: true, storageUsedMB: true, plan: true, isActive: true },
        }),
    ]);

    // Son giriş tarihi
    const lastUser = await prisma.user.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true, name: true },
    });

    return NextResponse.json({
        userCount,
        maxUsers: tenant?.maxUsers ?? 0,
        totalTickets,
        thisMonthTickets,
        maxTicketsPerMonth: tenant?.maxTicketsPerMonth,
        customerCount,
        deviceCount,
        storageUsedMB: tenant?.storageUsedMB ?? 0,
        storageLimitMB: tenant?.storageLimitMB ?? 500,
        lastActivity: lastUser?.updatedAt,
    });
}
