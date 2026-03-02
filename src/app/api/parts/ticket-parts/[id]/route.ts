import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/parts/ticket-parts/[id] — TicketPart fiyatı/adedi güncelle
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

    const { id } = await params;

    const user = await prisma.user.findFirst({
        where: { email: session.user?.email! },
    });
    if (!user) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });

    const body = await req.json();

    // Güvenlik: TicketPart aynı tenant'a mı ait?
    const tp = await prisma.ticketPart.findFirst({
        where: { id, tenantId: user.tenantId },
    });
    if (!tp) return NextResponse.json({ error: 'TicketPart bulunamadı' }, { status: 404 });

    const updateData: any = {};
    if (body.unitPrice !== undefined) updateData.unitPrice = parseFloat(body.unitPrice);
    if (body.quantity !== undefined) updateData.quantity = parseInt(body.quantity);

    const updated = await prisma.ticketPart.update({
        where: { id },
        data: updateData,
    });

    return NextResponse.json(updated);
}
