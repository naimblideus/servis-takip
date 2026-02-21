import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const tenantId = user.tenantId;
    const now = new Date();

    // Son 6 ay için ay bazlı veriler
    const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return {
            year: d.getFullYear(),
            month: d.getMonth(),
            label: d.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }),
            start: new Date(d.getFullYear(), d.getMonth(), 1),
            end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
        };
    }).reverse();

    const [
        totalTickets,
        totalCustomers,
        totalDevices,
        totalRevenue,
        byStatus,
        byPriority,
        recentActivity,
    ] = await Promise.all([
        prisma.serviceTicket.count({ where: { tenantId } }),
        prisma.customer.count({ where: { tenantId } }),
        prisma.device.count({ where: { tenantId } }),
        prisma.serviceTicket.aggregate({
            where: { tenantId },
            _sum: { totalCost: true },
        }),
        prisma.serviceTicket.groupBy({
            by: ['status'],
            where: { tenantId },
            _count: true,
        }),
        prisma.serviceTicket.groupBy({
            by: ['priority'],
            where: { tenantId },
            _count: true,
        }),
        // Son 30 günde oluşturulan fişler
        prisma.serviceTicket.findMany({
            where: {
                tenantId,
                createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            },
            select: { createdAt: true, totalCost: true, status: true },
            orderBy: { createdAt: 'asc' },
        }),
    ]);

    // Ay bazlı fiş sayıları
    const monthlyData = await Promise.all(
        months.map(async (m) => {
            const [count, revenue] = await Promise.all([
                prisma.serviceTicket.count({
                    where: { tenantId, createdAt: { gte: m.start, lte: m.end } },
                }),
                prisma.serviceTicket.aggregate({
                    where: { tenantId, paymentStatus: 'PAID', updatedAt: { gte: m.start, lte: m.end } },
                    _sum: { totalCost: true },
                }),
            ]);
            return { label: m.label, count, revenue: Number(revenue._sum.totalCost || 0) };
        })
    );

    return NextResponse.json({
        totals: {
            tickets: totalTickets,
            customers: totalCustomers,
            devices: totalDevices,
            revenue: Number(totalRevenue._sum.totalCost || 0),
        },
        byStatus,
        byPriority,
        monthlyData,
    });
}
