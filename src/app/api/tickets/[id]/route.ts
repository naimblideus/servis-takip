import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ticket = await prisma.serviceTicket.findUnique({
        where: { id },
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
        if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus;
        if (body.priority !== undefined) updateData.priority = body.priority;
        // Çöp kutusundan geri alma
        if (body.restore === true) updateData.deletedAt = null;

        const ticket = await prisma.serviceTicket.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(ticket);
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
        const url = new URL(req.url);
        const permanent = url.searchParams.get('permanent') === 'true';

        if (permanent) {
            await prisma.serviceTicket.delete({ where: { id } });
        } else {
            await prisma.serviceTicket.update({
                where: { id },
                data: { deletedAt: new Date() },
            });
        }
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
