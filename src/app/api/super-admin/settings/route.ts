import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET — platform ayarlarını getir
export async function GET() {
    let settings = await (prisma as any).platformSettings.findFirst();
    if (!settings) {
        settings = await (prisma as any).platformSettings.create({
            data: {
                platformName: 'Servis Takip',
                defaultTrialDays: 14,
                maintenanceMode: false,
            },
        });
    }
    return NextResponse.json(settings);
}

// PUT — platform ayarlarını güncelle (allow-list + komisyon clamp; mass-assignment yok)
export async function PUT(req: NextRequest) {
    const body = await req.json();

    const data: any = {};
    if (typeof body.platformName === 'string') data.platformName = body.platformName.slice(0, 120);
    if (body.platformLogo !== undefined) data.platformLogo = body.platformLogo || null;
    if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail || null;
    if (body.defaultTrialDays !== undefined) data.defaultTrialDays = Math.max(0, Math.min(365, parseInt(body.defaultTrialDays) || 0));
    if (body.maintenanceMode !== undefined) data.maintenanceMode = !!body.maintenanceMode;
    if (body.announcementText !== undefined) data.announcementText = body.announcementText || null;
    if (body.announcementActive !== undefined) data.announcementActive = !!body.announcementActive;
    if (body.marketCommissionPct !== undefined) data.marketCommissionPct = Math.max(0, Math.min(100, Number(body.marketCommissionPct) || 0));

    let settings = await (prisma as any).platformSettings.findFirst();
    if (settings) {
        settings = await (prisma as any).platformSettings.update({ where: { id: settings.id }, data });
    } else {
        settings = await (prisma as any).platformSettings.create({ data });
    }

    return NextResponse.json(settings);
}
