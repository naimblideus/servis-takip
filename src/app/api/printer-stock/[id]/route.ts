import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/printer-stock/[id] — Stok güncelle (satış kaydı dahil)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;

    try {
        const body = await req.json();

        const item = await prisma.printerStock.update({
            where: { id, tenantId: user.tenantId },
            data: {
                ...body,
                soldAt: body.soldAt ? new Date(body.soldAt) : undefined,
                soldPrice: body.soldPrice ? parseFloat(body.soldPrice) : undefined,
                buyPrice: body.buyPrice !== undefined ? parseFloat(body.buyPrice) : undefined,
                sellPrice: body.sellPrice !== undefined ? parseFloat(body.sellPrice) : undefined,
                quantity: body.quantity !== undefined ? parseInt(body.quantity) : undefined,
            },
        });

        return NextResponse.json(item);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE /api/printer-stock/[id] — Stok sil
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;

    try {
        await prisma.printerStock.delete({ where: { id, tenantId: user.tenantId } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
