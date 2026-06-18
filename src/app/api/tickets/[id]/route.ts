import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncTicketToCari } from '@/lib/ticket-cari';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // IDOR koruması: yalnızca bu tenant'ın fişi
    const ticket = await prisma.serviceTicket.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
            device: { include: { customer: true } },
            assignedUser: true,
            createdBy: true,
        },
    });

    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(ticket);
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // IDOR koruması: fiş bu tenant'a mı ait?
        const existing = await prisma.serviceTicket.findFirst({ where: { id, tenantId: user.tenantId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await req.json();

        const updateData: any = {};
        if (body.status !== undefined) {
            updateData.status = body.status;
            updateData.statusUpdatedAt = new Date();
        }
        if (body.assignedUserId !== undefined) updateData.assignedUserId = body.assignedUserId || null;
        if (body.issueText !== undefined) updateData.issueText = body.issueText;
        if (body.actionText !== undefined) updateData.actionText = body.actionText;
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.totalCost !== undefined) updateData.totalCost = parseFloat(body.totalCost);
        if (body.laborCost !== undefined) updateData.laborCost = parseFloat(body.laborCost);
        if (body.createdAt !== undefined && body.createdAt) {
            const d = new Date(body.createdAt);
            if (!isNaN(d.getTime())) updateData.createdAt = d; // Fiş tarih/saati düzenlenebilir
        }
        if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus;
        if (body.priority !== undefined) updateData.priority = body.priority;
        // Çöp kutusundan geri alma
        if (body.restore === true) updateData.deletedAt = null;

        const ticket = await prisma.serviceTicket.update({
            where: { id },
            data: updateData,
        });

        // Servis fişini Muhasebe/Cari'ye otomatik yansıt (teslim edilince SATIŞ + ödendiyse TAHSİLAT)
        let cari = { synced: false, amount: 0 };
        try { cari = await syncTicketToCari(id, user.tenantId); } catch (e: any) { console.error('TICKET CARI SYNC ERROR:', e?.message); }

        return NextResponse.json({ ...ticket, cari });
    } catch (e: any) {
        console.error('TICKET UPDATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// Soft-delete (çöp kutusuna taşı) veya ?permanent=true ile kalıcı sil
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const url = new URL(req.url);
        const permanent = url.searchParams.get('permanent') === 'true';

        // IDOR koruması: yalnızca bu tenant'ın fişi
        if (permanent) {
            // Fişe bağlı cari kayıtlarını da temizle (artık fiş yok)
            await prisma.accountEntry.deleteMany({ where: { tenantId: user.tenantId, ticketId: id } });
            const res = await prisma.serviceTicket.deleteMany({ where: { id, tenantId: user.tenantId } });
            if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        } else {
            const res = await prisma.serviceTicket.updateMany({
                where: { id, tenantId: user.tenantId },
                data: { deletedAt: new Date() },
            });
            if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            // Çöpe atılan fişin cari kayıtlarını kaldır (sync: shouldHave=false → siler)
            try { await syncTicketToCari(id, user.tenantId); } catch (e: any) { console.error('TICKET CARI SYNC (delete) ERROR:', e?.message); }
        }
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
