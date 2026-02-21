import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const parts = await prisma.part.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: 'asc' },
    });

    return NextResponse.json(parts);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await req.json();

        const part = await prisma.part.create({
            data: {
                tenantId: user.tenantId,
                sku: body.sku,
                name: body.name,
                buyPrice: parseFloat(body.buyPrice) || 0,
                sellPrice: parseFloat(body.sellPrice) || 0,
                stockQty: parseInt(body.stockQty) || 0,
                minStock: parseInt(body.minStock) || 5,
            },
        });

        return NextResponse.json(part);
    } catch (e: any) {
        console.error('PART CREATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
