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
        if (body.brand !== undefined) updateData.brand = body.brand;
        if (body.model !== undefined) updateData.model = body.model;
        if (body.serialNo !== undefined) updateData.serialNo = body.serialNo;
        if (body.location !== undefined) updateData.location = body.location || null;
        if (body.customerId !== undefined) updateData.customerId = body.customerId;
        if (body.isRental !== undefined) updateData.isRental = body.isRental;
        if (body.monthlyRent !== undefined) updateData.monthlyRent = parseFloat(body.monthlyRent) || 0;

        const device = await prisma.device.update({
            where: { id },
            data: updateData,
        });
        return NextResponse.json(device);
    } catch (e: any) {
        console.error('DEVICE UPDATE ERROR:', e.message);
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
        await prisma.device.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
