import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addSubscriptionHistory } from '@/lib/tenant-manager';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { days, notes } = await req.json();

    const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: { planEndDate: true, trialEndsAt: true, plan: true } as any,
    });
    if (!tenant) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

    const t = tenant as any;
    const base = t.plan === 'trial' ? (t.trialEndsAt || new Date()) : (t.planEndDate || new Date());
    const newDate = new Date(base);
    newDate.setDate(newDate.getDate() + (days || 30));

    const data: any = t.plan === 'trial' ? { trialEndsAt: newDate } : { planEndDate: newDate };
    await prisma.tenant.update({ where: { id }, data });
    await addSubscriptionHistory(id, 'renewed', t.plan || 'trial', undefined, notes || `${days} gün uzatıldı`);

    return NextResponse.json({ success: true, newDate });
}
