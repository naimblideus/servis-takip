import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/tickets/next-ticket-number — Sonraki sıralı TSK numarasını döndür
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // TSK-XXX formatındaki en yüksek numarayı bul
    const lastTicket = await prisma.serviceTicket.findFirst({
        where: {
            tenantId: user.tenantId,
            ticketNumber: { startsWith: 'TSK-' },
        },
        orderBy: { ticketNumber: 'desc' },
    });

    let nextNum = 1;
    if (lastTicket) {
        const match = lastTicket.ticketNumber.match(/TSK-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
    }

    // SF- formatındakileri de kontrol et (eski format olabilir)
    const sfCount = await prisma.serviceTicket.count({
        where: { tenantId: user.tenantId },
    });

    // En yüksek olanı kullan
    if (sfCount >= nextNum) nextNum = sfCount + 1;

    const ticketNumber = `TSK-${nextNum}`;

    return NextResponse.json({ ticketNumber, nextNum });
}
