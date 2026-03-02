import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/customers/[id]/devices — Müşterinin cihazlarını döndür
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

        const { id: customerId } = await params;

        const user = await prisma.user.findFirst({
            where: { email: session.user?.email! },
        });
        if (!user) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });

        const devices = await prisma.device.findMany({
            where: { tenantId: user.tenantId, customerId },
            orderBy: { brand: 'asc' },
        });

        // Sadece ihtiyaç duyulan alanları döndür
        const result = devices.map(d => ({
            id: d.id,
            brand: d.brand,
            model: d.model,
            serialNo: d.serialNo,
            counterBlack: d.counterBlack ?? null,
            counterColor: d.counterColor ?? null,
            location: d.location,
        }));

        return NextResponse.json(result);
    } catch (e: any) {
        console.error('CUSTOMER DEVICES ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
