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
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        // IDOR koruması: müşteri bu tenant'a mı ait?
        const existing = await prisma.customer.findFirst({ where: { id, tenantId: user.tenantId } });
        if (!existing) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

        const body = await req.json();
        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.phone !== undefined) updateData.phone = body.phone;
        if (body.address !== undefined) updateData.address = body.address || null;
        if (body.taxNo !== undefined) updateData.taxNo = body.taxNo || null;

        const customer = await prisma.customer.update({
            where: { id },
            data: updateData,
        });
        return NextResponse.json(customer);
    } catch (e: any) {
        console.error('CUSTOMER UPDATE ERROR:', e.message);
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
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        // IDOR koruması: yalnızca bu tenant'ın müşterisi silinebilir
        const res = await prisma.customer.deleteMany({ where: { id, tenantId: user.tenantId } });
        if (res.count === 0) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
