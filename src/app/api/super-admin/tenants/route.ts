import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTenant } from '@/lib/tenant-manager';

// GET — işletme listesi
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const q = searchParams.get('q') || '';
    const plan = searchParams.get('plan') || '';
    const status = searchParams.get('status') || '';
    const city = searchParams.get('city') || '';

    const where: any = { deletedAt: null };
    if (q) where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { ownerName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
    ];
    if (plan) where.plan = plan;
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (status === 'active') { where.isActive = true; where.isSuspended = false; }
    if (status === 'suspended') where.isSuspended = true;
    if (status === 'trial') where.plan = 'trial';
    if (status === 'inactive') where.isActive = false;

    const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, name: true, slug: true, ownerName: true, phone: true, email: true,
                city: true, plan: true, isActive: true, isSuspended: true, suspendReason: true,
                trialEndsAt: true, planEndDate: true, createdAt: true, businessType: true,
                _count: { select: { users: true, serviceTickets: true } },
            },
        }),
        prisma.tenant.count({ where }),
    ]);

    // Bayi SAĞLIK/aktivite: son fiş tarihi (son aktivite) + son 30 gün fiş sayısı
    const ids = tenants.map((t) => t.id);
    const thirty = new Date(Date.now() - 30 * 86400000);
    const [lastAgg, recentAgg] = await Promise.all([
        prisma.serviceTicket.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids } }, _max: { createdAt: true } }),
        prisma.serviceTicket.groupBy({ by: ['tenantId'], where: { tenantId: { in: ids }, createdAt: { gte: thirty } }, _count: true }),
    ]);
    const lastMap = new Map(lastAgg.map((a) => [a.tenantId, a._max.createdAt]));
    const recentMap = new Map(recentAgg.map((a) => [a.tenantId, (a as any)._count as number]));
    const enriched = tenants.map((t) => ({
        ...t,
        lastActivityAt: lastMap.get(t.id) ?? null,
        tickets30d: recentMap.get(t.id) ?? 0,
    }));

    return NextResponse.json({ tenants: enriched, total, pages: Math.ceil(total / limit), page });
}

// POST — yeni işletme oluştur
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const result = await createTenant(body);
        return NextResponse.json({
            tenant: result.tenant,
            adminEmail: result.user.email,
            tempPassword: result.tempPassword,
        }, { status: 201 });
    } catch (error: any) {
        console.error('SA create tenant error:', error);
        return NextResponse.json({ error: error.message || 'İşletme oluşturulamadı' }, { status: 500 });
    }
}
