import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/tickets/next-ticket-number — Sonraki sıralı SF numarasını döndür
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // TSK- ve SF- formatındaki tüm fişleri çekip en yüksek numarayı bul
    const allTickets = await prisma.serviceTicket.findMany({
        where: { tenantId: user.tenantId },
        select: { ticketNumber: true },
    });

    let maxNum = 0;
    for (const t of allTickets) {
        const match = t.ticketNumber.match(/^(?:TSK|SF)-(\d+)$/);
        if (match) {
            const n = parseInt(match[1]);
            if (n > maxNum) maxNum = n;
        }
    }

    const nextNum = maxNum + 1;
    const ticketNumber = `SF-${nextNum}`;

    return NextResponse.json({ ticketNumber, nextNum });
}
