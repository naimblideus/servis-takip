import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await req.json();
    const { action, reason } = body;

    const isSuspended = action === 'suspend';
    await prisma.tenant.update({
        where: { id },
        data: {
            isSuspended,
            suspendReason: isSuspended ? (reason || '') : null,
            isActive: !isSuspended,
        } as any,
    });

    const { addSubscriptionHistory } = await import('@/lib/tenant-manager');
    await addSubscriptionHistory(id, isSuspended ? 'suspended' : 'activated', 'current', undefined, reason);

    return NextResponse.json({ success: true, isSuspended });
}
