import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createLogoIntegration } from '@/lib/logo-integration';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = (session.user as any).tenantId;

    // Dış muhasebeye (Logo) FATURA yazar — geri alınamaz. Yalnız yönetici.
    const kullanici = await prisma.user.findFirst({
        where: { email: session.user?.email!, ...(tenantId ? { tenantId } : {}) },
        select: { role: true },
    });
    if (kullanici?.role !== 'ADMIN' && kullanici?.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Bu işlem için yönetici yetkisi gerekir.' }, { status: 403 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const integration = createLogoIntegration(tenant);
    if (!integration) return NextResponse.json({ error: 'Logo entegrasyonu aktif değil' }, { status: 400 });

    const { period } = await req.json();
    // Dönem filtresi BOZUKTU: gte ile lt aynı tarihti (`YYYY-MM-01` ve
    // `YYYY-MM-01T00:00:00Z`), yani aralık boş — dönem verildiğinde HİÇBİR
    // fiş eşleşmiyor, "0 fatura aktarıldı" sessizce dönüyordu.
    // Doğrusu: ayın 1'inden ERTESİ ayın 1'ine.
    let dateFilter: { gte: Date; lt: Date } | undefined;
    if (period) {
        const [yil, ay] = String(period).split('-').map(Number);
        if (Number.isFinite(yil) && Number.isFinite(ay) && ay >= 1 && ay <= 12) {
            dateFilter = {
                gte: new Date(Date.UTC(yil, ay - 1, 1)),
                lt: new Date(Date.UTC(ay === 12 ? yil + 1 : yil, ay === 12 ? 0 : ay, 1)),
            };
        } else {
            return NextResponse.json({ error: 'Dönem YYYY-AA biçiminde olmalı' }, { status: 400 });
        }
    }

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
