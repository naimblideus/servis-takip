import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/fix-tsk-to-sf — DB'deki tüm TSK- fişlerini SF- olarak yeniden adlandır
export async function POST() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
    }

    // TSK- ile başlayan tüm fişleri bul
    const tskTickets = await prisma.serviceTicket.findMany({
        where: {
            tenantId: user.tenantId,
            ticketNumber: { startsWith: 'TSK-' },
        },
        select: { id: true, ticketNumber: true },
    });

    let updated = 0;
    let skipped = 0;

    for (const ticket of tskTickets) {
        // TSK-760 → SF-760
        const newNumber = ticket.ticketNumber.replace(/^TSK-/, 'SF-');

        // Çakışma kontrolü: SF-760 zaten varsa atla
        const conflict = await prisma.serviceTicket.findFirst({
            where: { tenantId: user.tenantId, ticketNumber: newNumber },
            select: { id: true },
        });

        if (conflict) {
            skipped++;
            continue;
        }

        await prisma.serviceTicket.update({
            where: { id: ticket.id },
            data: { ticketNumber: newNumber },
        });
        updated++;
    }

    return NextResponse.json({
        success: true,
        total: tskTickets.length,
        updated,
        skipped,
        message: `${updated} fiş TSK- → SF- olarak güncellendi. ${skipped} adet atlandı (çakışma).`,
    });
}
