import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createLogoIntegration } from '@/lib/logo-integration';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = (session.user as any).tenantId;

    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return NextResponse.json({ error: 'Tenant bulunamadı' }, { status: 404 });

        const integration = createLogoIntegration(tenant);
        if (!integration) {
            return NextResponse.json({ connected: false, error: 'Logo entegrasyonu aktif değil' });
        }

        const connected = await integration.testConnection();

        // Log kaydet
        await (prisma as any).logoSyncLog.create({
            data: {
                tenantId,
                operation: 'connection_test',
                entityType: 'system',
                entityId: null,
                direction: 'export',
                status: connected ? 'success' : 'error',
                errorMessage: connected ? null : 'Bağlantı kurulamadı',
            },
        });

        return NextResponse.json({ connected });
    } catch (error: any) {
        return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
    }
}
