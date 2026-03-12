import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createLogoIntegration } from '@/lib/logo-integration';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = (session.user as any).tenantId;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const integration = createLogoIntegration(tenant);
    if (!integration) return NextResponse.json({ error: 'Logo entegrasyonu aktif değil' }, { status: 400 });

    const { period } = await req.json();
    const dateFilter = period
        ? { gte: new Date(`${period}-01`), lt: new Date(`${period}-01T00:00:00Z`) }
        : undefined;

    const tickets = await prisma.serviceTicket.findMany({
        where: { tenantId, paymentStatus: 'PAID', ...(dateFilter ? { createdAt: dateFilter } : {}) },
        include: { device: { include: { customer: true } } },
        take: 100,
    });

    let success = 0, failed = 0;
    const errors: { entityId: string; error: string }[] = [];

    for (const ticket of tickets) {
        const result = await integration.createInvoice({
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            totalCost: Number(ticket.totalCost),
            customer: ticket.device.customer,
            createdAt: ticket.createdAt,
        });

        if (result.success) success++;
        else { failed++; errors.push({ entityId: ticket.id, error: result.error || '' }); }
    }

    await (prisma as any).logoSyncLog.create({
        data: {
            tenantId,
            operation: 'invoice_sync',
            entityType: 'invoice',
            direction: 'export',
            status: failed === 0 ? 'success' : success > 0 ? 'partial' : 'error',
            responseData: { total: tickets.length, success, failed, errors } as any,
        },
    });

    return NextResponse.json({ total: tickets.length, success, failed, errors });
}
