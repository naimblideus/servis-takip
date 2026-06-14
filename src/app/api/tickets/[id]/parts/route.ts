import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Bu fişin parçalarını listele
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parts = await prisma.ticketPart.findMany({
        where: { ticketId: id },
        include: { part: true },
        orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(parts);
}

// POST: Fişe parça ekle (stoktan düş)
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: ticketId } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await req.json();
        const { partId, barcode, quantity = 1, unitPrice: overridePrice } = body;

        // Parçayı TENANT-SCOPED bul (IDOR koruması). partId yoksa BARKOD ile ara (okuyucu akışı).
        const part = partId
            ? await prisma.part.findFirst({ where: { id: partId, tenantId: user.tenantId } })
            : barcode
                ? await prisma.part.findFirst({ where: { barcode: String(barcode), tenantId: user.tenantId } })
                : null;
        if (!part) return NextResponse.json({ error: barcode ? `Barkod bulunamadı: ${barcode}` : 'Parça bulunamadı' }, { status: 404 });
        if (part.stockQty < quantity) {
            return NextResponse.json({ error: `Stok yetersiz (mevcut: ${part.stockQty})` }, { status: 400 });
        }

        // Kullanılacak birim fiyat: override varsa onu kullan, yoksa stok satış fiyatı
        const finalUnitPrice = overridePrice !== undefined ? overridePrice : Number(part.sellPrice);

        // Transaction: fişe parça ekle + stoktan düş
        const [ticketPart] = await prisma.$transaction([
            prisma.ticketPart.create({
                data: {
                    tenantId: user.tenantId,
                    ticketId,
                    partId: part.id,
                    quantity,
                    unitPrice: finalUnitPrice,
                },
            }),
            // Stoktan düş
            prisma.part.update({
                where: { id: part.id },
                data: { stockQty: { decrement: quantity } },
            }),
            // Fiş toplam tutarını güncelle
            prisma.serviceTicket.update({
                where: { id: ticketId },
                data: {
                    totalCost: {
                        increment: finalUnitPrice * quantity,
                    },
                },
            }),
        ]);

        return NextResponse.json(ticketPart);
    } catch (e: any) {
        console.error('TICKET PART ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE: Fişten parça çıkar (stoğa geri koy)
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: ticketId } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const url = new URL(req.url);
        const ticketPartId = url.searchParams.get('ticketPartId');
        if (!ticketPartId) return NextResponse.json({ error: 'ticketPartId gerekli' }, { status: 400 });

        const ticketPart = await prisma.ticketPart.findFirst({
            where: { id: ticketPartId, tenantId: user.tenantId },
            include: { part: true },
        });
        if (!ticketPart) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

        await prisma.$transaction([
            prisma.ticketPart.delete({ where: { id: ticketPartId } }),
            // Stoğa geri koy
            prisma.part.update({
                where: { id: ticketPart.partId },
                data: { stockQty: { increment: ticketPart.quantity } },
            }),
            // Fiş toplam tutarını güncelle
            prisma.serviceTicket.update({
                where: { id: ticketId },
                data: {
                    totalCost: {
                        decrement: Number(ticketPart.unitPrice) * ticketPart.quantity,
                    },
                },
            }),
        ]);

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
