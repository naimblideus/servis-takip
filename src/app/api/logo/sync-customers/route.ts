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

    const customers = await prisma.customer.findMany({
        where: { tenantId },
        select: { id: true, name: true, phone: true, taxNo: true, address: true },
    });

    const report = await integration.syncAllCustomers(customers);

    // Log kaydet
    await (prisma as any).logoSyncLog.create({
        data: {
            tenantId,
            operation: 'customer_sync',
            entityType: 'customer',
            direction: 'export',
            status: report.failed === 0 ? 'success' : report.success > 0 ? 'partial' : 'error',
            responseData: report as any,
        },
    });

    return NextResponse.json(report);
}
