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

    return NextResponse.json({ tenants, total, pages: Math.ceil(total / limit), page });
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
