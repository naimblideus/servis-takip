import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/tickets/[id]/print-data — Yazdırma için tüm ticket bilgilerini döndür
export async function GET(
    req: NextRequest,
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
            ticketParts: { include: { part: true } },
        },
    });

    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const tenant = await prisma.tenant.findUnique({ where: { id: ticket.tenantId } });

    return NextResponse.json({
        ticket: {
            ticketNumber: ticket.ticketNumber,
            status: ticket.status,
            priority: ticket.priority,
            issueText: ticket.issueText,
            actionText: ticket.actionText,
            notes: ticket.notes,
            totalCost: Number(ticket.totalCost),
            paymentStatus: ticket.paymentStatus,
            createdAt: ticket.createdAt.toISOString(),
            assignedUserName: ticket.assignedUser?.name || null,
            createdByName: ticket.createdBy?.name || null,
        },
        customer: {
            name: ticket.device.customer.name,
            phone: ticket.device.customer.phone,
            address: ticket.device.customer.address,
        },
        device: {
            brand: ticket.device.brand,
            model: ticket.device.model,
            serialNo: ticket.device.serialNo,
            location: ticket.device.location,
            counterBlack: ticket.device.counterBlack ?? null,
            counterColor: ticket.device.counterColor ?? null,
            publicCode: ticket.device.publicCode,
        },
        parts: ticket.ticketParts.map(tp => ({
            sku: tp.part.sku,
            name: tp.part.name,
            group: tp.part.group,
            quantity: tp.quantity,
            unitPrice: Number(tp.unitPrice),
        })),
        companyName: tenant?.name || 'Servis Takip',
    });
}
