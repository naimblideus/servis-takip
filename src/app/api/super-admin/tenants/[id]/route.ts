import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addSubscriptionHistory } from '@/lib/tenant-manager';

// GET — işletme detayı
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const tenant = await prisma.tenant.findFirst({
        where: { id: params.id, deletedAt: null },
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

// PUT — işletme güncelle
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const body = await req.json();
        const { adminNotes, ...rest } = body;
        const tenant = await prisma.tenant.update({
            where: { id: params.id },
            data: { ...rest, adminNotes } as any,
        });
        return NextResponse.json(tenant);
    } catch (error: any) {
        return NextResponse.json({ error: 'Güncellenemedi' }, { status: 500 });
    }
}

// DELETE — soft delete
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    await prisma.tenant.update({
        where: { id: params.id },
        data: { deletedAt: new Date(), isActive: false } as any,
    });
    return NextResponse.json({ success: true });
}
