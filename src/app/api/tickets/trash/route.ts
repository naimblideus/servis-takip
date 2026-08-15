import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';

// GET: Çöp kutusundaki fişleri listele
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const me = await oturumKullanicisi(session);
    if (!me) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const tickets = await prisma.serviceTicket.findMany({
        where: { tenantId: me.tenantId, deletedAt: { not: null } },
        include: { device: { include: { customer: true } } },
        orderBy: { deletedAt: 'desc' },
    } as any);

    return NextResponse.json(tickets);
}

// DELETE: Çöp kutusunu tamamen boşalt (tüm soft-deleted fişleri kalıcı sil)
export async function DELETE() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const me = await oturumKullanicisi(session);
    if (!me || me.role !== 'ADMIN') return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });

    const { count } = await prisma.serviceTicket.deleteMany({
        where: { tenantId: me.tenantId, deletedAt: { not: null } } as any,
    });

    return NextResponse.json({ deleted: count });
}
