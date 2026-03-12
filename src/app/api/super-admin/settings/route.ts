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

// PUT — platform ayarlarını güncelle
export async function PUT(req: NextRequest) {
    const body = await req.json();
    let settings = await (prisma as any).platformSettings.findFirst();

    if (settings) {
        settings = await (prisma as any).platformSettings.update({
            where: { id: settings.id },
            data: body,
        });
    } else {
        settings = await (prisma as any).platformSettings.create({ data: body });
    }

    return NextResponse.json(settings);
}
