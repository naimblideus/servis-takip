import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePartGroup } from '@/lib/part-groups';
import { oturumKullanicisi } from '@/lib/api-auth';

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // IDOR koruması: parça bu tenant'a ait mi?
        const user = await oturumKullanicisi(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        const existing = await prisma.part.findFirst({ where: { id, tenantId: user.tenantId } });
        if (!existing) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

        const body = await req.json();
        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.buyPrice !== undefined) updateData.buyPrice = parseFloat(body.buyPrice);
        if (body.sellPrice !== undefined) updateData.sellPrice = parseFloat(body.sellPrice);
        if (body.stockQty !== undefined) {
            const q = parseInt(body.stockQty);
            if (!Number.isFinite(q) || q < 0) {
                return NextResponse.json({ error: 'Stok adedi negatif olamaz.' }, { status: 400 });
            }
            updateData.stockQty = q;
        }
        if (body.minStock !== undefined) updateData.minStock = parseInt(body.minStock);
        // Grup yazımını kanonikleştir ("FIRIN GURUBU" -> "Fırın Grubu")
        if (body.group !== undefined) updateData.group = normalizePartGroup(body.group);
        if (body.barcode !== undefined) updateData.barcode = body.barcode?.trim() || null;
        // OEM kodu / markası — çapraz-bayi parça analizi için (isteğe bağlı)
        if (body.oemCode !== undefined) updateData.oemCode = body.oemCode?.trim() || null;
        if (body.oemBrand !== undefined) updateData.oemBrand = body.oemBrand?.trim() || null;
        // ── Stok artırma/azaltma ────────────────────────────────────────
        // Eskiden düz `increment`ti ve NEGATİFE düşmeyi engelleyen hiçbir şey
        // yoktu: "−" düğmesine stok 0'ken basmak stoğu -1 yapıyordu. Eksi stok
        // hem anlamsız hem de kritik-stok uyarısını ve sipariş listesini bozar.
        //
        // Kontrol `updateMany` + koşullu where ile ATOMİK yapılıyor; önce oku
        // sonra yaz deseni iki teknisyen aynı anda parça düşerse yarışırdı.
        if (body.adjustQty !== undefined) {
            const delta = parseInt(body.adjustQty);
            if (!Number.isFinite(delta)) {
                return NextResponse.json({ error: 'Geçersiz miktar.' }, { status: 400 });
            }
            const sonuc = await prisma.part.updateMany({
                // Azaltmada yalnız yeterli stok varsa güncellenir (stockQty + delta >= 0).
                where: { id: existing.id, tenantId: user.tenantId, ...(delta < 0 ? { stockQty: { gte: -delta } } : {}) },
                data: { stockQty: { increment: delta } },
            });
            if (sonuc.count === 0) {
                return NextResponse.json(
                    { error: `Yetersiz stok: "${existing.name}" için elde ${existing.stockQty} adet var.` },
                    { status: 409 },
                );
            }
            // Aynı istekte başka alanlar da geldiyse onları da yaz.
            if (Object.keys(updateData).length > 0) {
                await prisma.part.update({ where: { id: existing.id }, data: updateData });
            }
            const guncel = await prisma.part.findUnique({ where: { id: existing.id } });
            return NextResponse.json(guncel);
        }

        const part = await prisma.part.update({ where: { id: existing.id }, data: updateData });
        return NextResponse.json(part);
    } catch (e: any) {
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
        // IDOR koruması: yalnızca bu tenant'ın parçası silinebilir
        const user = await oturumKullanicisi(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        const res = await prisma.part.deleteMany({ where: { id, tenantId: user.tenantId } });
        if (res.count === 0) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
