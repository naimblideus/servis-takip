import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const tenant = await prisma.tenant.findFirst({
        where: { id, deletedAt: null } as any,
        include: {
            users: { select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } },
            subscriptionHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
            invoices: { orderBy: { createdAt: 'desc' }, take: 20 },
            _count: { select: { serviceTickets: true, customers: true, devices: true } },
        } as any,
    });
    if (!tenant) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
    return NextResponse.json(tenant);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const tenant = await prisma.tenant.update({
            where: { id },
            data: body as any,
        });
        return NextResponse.json(tenant);
    } catch (error: any) {
        return NextResponse.json({ error: 'Güncellenemedi' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    await prisma.tenant.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false } as any,
    });
    return NextResponse.json({ success: true });
}
