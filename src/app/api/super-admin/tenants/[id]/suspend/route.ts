import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addSubscriptionHistory } from '@/lib/tenant-manager';

// POST — askıya al / aktif et
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const body = await req.json();
    const { action, reason } = body; // action: suspend | activate

    const isSuspended = action === 'suspend';
    await prisma.tenant.update({
        where: { id: params.id },
        data: {
            isSuspended,
            suspendReason: isSuspended ? (reason || '') : null,
            isActive: !isSuspended,
        } as any,
    });

    await addSubscriptionHistory(
        params.id,
        isSuspended ? 'suspended' : 'activated',
        'current',
        undefined,
        reason
    );

    return NextResponse.json({ success: true, isSuspended });
}
