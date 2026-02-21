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
        const body = await req.json();
        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.buyPrice !== undefined) updateData.buyPrice = parseFloat(body.buyPrice);
        if (body.sellPrice !== undefined) updateData.sellPrice = parseFloat(body.sellPrice);
        if (body.stockQty !== undefined) updateData.stockQty = parseInt(body.stockQty);
        if (body.minStock !== undefined) updateData.minStock = parseInt(body.minStock);
        // Stok artırma/azaltma
        if (body.adjustQty !== undefined) {
            updateData.stockQty = { increment: parseInt(body.adjustQty) };
        }

        const part = await prisma.part.update({ where: { id }, data: updateData });
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
        await prisma.part.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
