import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

        const [
            totalTenants,
            activeTenants,
            trialTenants,
            suspendedTenants,
            newThisMonth,
            expiringSoon,
            overdueInvoices,
            monthlyRevenue,
            planCounts,
        ] = await Promise.all([
            prisma.tenant.count({ where: { deletedAt: null } }),
            prisma.tenant.count({ where: { deletedAt: null, isActive: true, isSuspended: false } }),
            prisma.tenant.count({ where: { deletedAt: null, plan: 'trial' } }),
            prisma.tenant.count({ where: { deletedAt: null, isSuspended: true } }),
            prisma.tenant.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
            prisma.tenant.count({
                where: {
                    deletedAt: null,
                    isActive: true,
                    OR: [
                        { trialEndsAt: { gte: now, lte: sevenDaysLater } },
                        { planEndDate: { gte: now, lte: sevenDaysLater } },
                    ],
                },
            }),
            (prisma as any).tenantInvoice.count({ where: { status: 'overdue' } }),
            (prisma as any).tenantInvoice.aggregate({
                where: { status: 'paid', createdAt: { gte: firstOfMonth } },
                _sum: { totalAmount: true },
            }),
            prisma.tenant.groupBy({
                by: ['plan'],
                where: { deletedAt: null, isActive: true },
                _count: { plan: true },
            }),
        ]);

        const recentTenants = await prisma.tenant.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: { id: true, name: true, plan: true, isActive: true, isSuspended: true, createdAt: true, ownerName: true, city: true },
        });

        return NextResponse.json({
            totalTenants,
            activeTenants,
            trialTenants,
            suspendedTenants,
            newThisMonth,
            expiringSoon,
            overdueInvoices,
            monthlyRevenue: monthlyRevenue._sum?.totalAmount || 0,
            planCounts: Object.fromEntries(planCounts.map(p => [p.plan, p._count.plan])),
            recentTenants,
        });
    } catch (error: any) {
        console.error('SA dashboard error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
