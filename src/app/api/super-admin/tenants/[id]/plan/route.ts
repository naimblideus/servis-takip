import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addSubscriptionHistory } from '@/lib/tenant-manager';

const PLAN_LIMITS: Record<string, { maxUsers: number; maxTicketsPerMonth: number | null; storageLimitMB: number }> = {
    trial: { maxUsers: 2, maxTicketsPerMonth: 50, storageLimitMB: 200 },
    starter: { maxUsers: 3, maxTicketsPerMonth: 200, storageLimitMB: 500 },
    professional: { maxUsers: 10, maxTicketsPerMonth: null, storageLimitMB: 2000 },
    enterprise: { maxUsers: 50, maxTicketsPerMonth: null, storageLimitMB: 10000 },
};

// PUT — paket değiştir
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const body = await req.json();
    const { plan, amount, notes, overrideLimits } = body;

    if (!plan || !PLAN_LIMITS[plan]) {
        return NextResponse.json({ error: 'Geçersiz paket' }, { status: 400 });
    }

    const limits = overrideLimits || PLAN_LIMITS[plan];
    const tenant = await prisma.tenant.findUnique({ where: { id: params.id }, select: { plan: true } });
    const oldPlan = tenant?.plan || 'trial';

    const action = plan > oldPlan ? 'upgraded' : plan < oldPlan ? 'downgraded' : 'renewed';

    await prisma.tenant.update({
        where: { id: params.id },
        data: {
            plan,
            maxUsers: limits.maxUsers,
            maxTicketsPerMonth: limits.maxTicketsPerMonth,
            storageLimitMB: limits.storageLimitMB,
            planStartDate: new Date(),
        } as any,
    });

    await addSubscriptionHistory(params.id, action, plan, amount, notes);

    return NextResponse.json({ success: true, plan });
}
