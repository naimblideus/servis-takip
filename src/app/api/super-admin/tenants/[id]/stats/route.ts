import { NextRequest, NextResponse } from 'next/server';
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
            select: { maxUsers: true, maxTicketsPerMonth: true, storageLimitMB: true, storageUsedMB: true } as any,
        }),
    ]);

    const lastUser = await prisma.user.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
    });

    return NextResponse.json({
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
