import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // IDOR koruması: parça bu tenant'a ait mi?
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        const existing = await prisma.part.findFirst({ where: { id, tenantId: user.tenantId } });
        if (!existing) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

        const body = await req.json();
        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.buyPrice !== undefined) updateData.buyPrice = parseFloat(body.buyPrice);
        if (body.sellPrice !== undefined) updateData.sellPrice = parseFloat(body.sellPrice);
        if (body.stockQty !== undefined) updateData.stockQty = parseInt(body.stockQty);
        if (body.minStock !== undefined) updateData.minStock = parseInt(body.minStock);
        if (body.group !== undefined) updateData.group = body.group || null;
        if (body.barcode !== undefined) updateData.barcode = body.barcode?.trim() || null;
        // Stok artırma/azaltma
        if (body.adjustQty !== undefined) {
            updateData.stockQty = { increment: parseInt(body.adjustQty) };
        }

        const part = await prisma.part.update({ where: { id: existing.id }, data: updateData });
        return NextResponse.json(part);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // IDOR koruması: yalnızca bu tenant'ın parçası silinebilir
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        const res = await prisma.part.deleteMany({ where: { id, tenantId: user.tenantId } });
        if (res.count === 0) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
