import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET — senkronizasyon log geçmişi
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = (session.user as any).tenantId;

    const logs = await (prisma as any).logoSyncLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    return NextResponse.json(logs);
}
