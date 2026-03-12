import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addSubscriptionHistory } from '@/lib/tenant-manager';

// POST — abonelik bitiş tarihini uzat
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const { days, notes } = await req.json();

    const tenant = await prisma.tenant.findUnique({ where: { id: params.id }, select: { planEndDate: true, trialEndsAt: true, plan: true } });
    if (!tenant) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

    const base = tenant.plan === 'trial'
        ? (tenant.trialEndsAt || new Date())
        : (tenant.planEndDate || new Date());

    const newDate = new Date(base);
    newDate.setDate(newDate.getDate() + (days || 30));

    const data: any = tenant.plan === 'trial'
        ? { trialEndsAt: newDate }
        : { planEndDate: newDate };

    await prisma.tenant.update({ where: { id: params.id }, data });
    await addSubscriptionHistory(params.id, 'renewed', tenant.plan || 'trial', undefined, notes || `${days} gün uzatıldı`);

    return NextResponse.json({ success: true, newDate });
}
