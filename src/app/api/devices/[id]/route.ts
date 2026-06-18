import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        // IDOR koruması: cihaz bu tenant'a mı ait?
        const existing = await prisma.device.findFirst({ where: { id, tenantId: user.tenantId } });
        if (!existing) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

        const body = await req.json();
        // Cihaz baska bir musteriye tasiniyorsa, hedef musteri de ayni tenant'ta olmali
        if (body.customerId !== undefined && body.customerId) {
            const target = await prisma.customer.findFirst({ where: { id: body.customerId, tenantId: user.tenantId } });
            if (!target) return NextResponse.json({ error: 'Geçersiz müşteri' }, { status: 400 });
        }
        const updateData: any = {};
        if (body.brand !== undefined) updateData.brand = body.brand;
        if (body.model !== undefined) updateData.model = body.model;
        if (body.serialNo !== undefined) updateData.serialNo = body.serialNo;
        if (body.barcode !== undefined) updateData.barcode = body.barcode?.trim() || null;
        if (body.location !== undefined) updateData.location = body.location || null;
        if (body.customerId !== undefined) updateData.customerId = body.customerId;
        if (body.isRental !== undefined) updateData.isRental = body.isRental;
        if (body.monthlyRent !== undefined) updateData.monthlyRent = parseFloat(body.monthlyRent) || 0;
        if (body.pricePerBlack !== undefined) updateData.pricePerBlack = body.pricePerBlack === '' || body.pricePerBlack === null ? null : parseFloat(body.pricePerBlack);
        if (body.pricePerColor !== undefined) updateData.pricePerColor = body.pricePerColor === '' || body.pricePerColor === null ? null : parseFloat(body.pricePerColor);
        // Kademeli fiyatlandırma (dahil paket + aşım)
        if (body.includedBlack !== undefined) updateData.includedBlack = parseInt(body.includedBlack) || 0;
        if (body.includedColor !== undefined) updateData.includedColor = parseInt(body.includedColor) || 0;
        if (body.overagePriceBlack !== undefined) updateData.overagePriceBlack = body.overagePriceBlack === '' || body.overagePriceBlack === null ? null : parseFloat(body.overagePriceBlack);
        if (body.overagePriceColor !== undefined) updateData.overagePriceColor = body.overagePriceColor === '' || body.overagePriceColor === null ? null : parseFloat(body.overagePriceColor);

        // Kiralık değilse fiyatları sıfırla
        if (body.isRental === false) {
            updateData.monthlyRent = 0;
            updateData.pricePerBlack = null;
            updateData.pricePerColor = null;
            updateData.includedBlack = 0;
            updateData.includedColor = 0;
            updateData.overagePriceBlack = null;
            updateData.overagePriceColor = null;
        }

        const device = await prisma.device.update({
            where: { id },
            data: updateData,
        });
        return NextResponse.json(device);
    } catch (e: any) {
        console.error('DEVICE UPDATE ERROR:', e.message);
        if (e.code === 'P2002') {
            const f = (e.meta?.target || []).join(',');
            return NextResponse.json({ error: f.includes('barcode') ? 'Bu barkod başka bir cihaza atanmış (model-bazlı barkod olabilir; seri no kullanın)' : 'Bu seri no zaten kayıtlı' }, { status: 409 });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        // IDOR koruması: yalnızca bu tenant'ın cihazı silinebilir
        const res = await prisma.device.deleteMany({ where: { id, tenantId: user.tenantId } });
        if (res.count === 0) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
