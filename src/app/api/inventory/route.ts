import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { detectBrandInText } from '@/lib/device-brands';
import { normalizePartGroup, guessPartGroup } from '@/lib/part-groups';

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const parts = await prisma.part.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: 'asc' },
    });

    return NextResponse.json(parts);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await req.json();

        // Auto-SKU: boşsa sıralı kod üret
        let sku = (body.sku || '').trim();
        if (!sku) {
            // En son sıralı SKU'yu bul
            const lastPart = await prisma.part.findFirst({
                where: {
                    tenantId: user.tenantId,
                    sku: { startsWith: 'PRN-' },
                },
                orderBy: { sku: 'desc' },
            });
            let nextNum = 1;
            if (lastPart) {
                const match = lastPart.sku.match(/PRN-(\d+)/);
                if (match) nextNum = parseInt(match[1]) + 1;
            }
            sku = `PRN-${String(nextNum).padStart(4, '0')}`;
        }

        const part = await prisma.part.create({
            data: {
                tenantId: user.tenantId,
                sku,
                name: body.name,
                buyPrice: parseFloat(body.buyPrice) || 0,
                sellPrice: parseFloat(body.sellPrice) || 0,
                stockQty: parseInt(body.stockQty) || 0,
                minStock: parseInt(body.minStock) || 5,
                // Grup: seçilen değeri kanonikleştir; boşsa parça adından yakalamayı dene
                // ("...MÜREKKEP SARI DOLUM" -> Mürekkep). Emin olunamazsa BOŞ kalır.
                group: normalizePartGroup(body.group) ?? guessPartGroup(body.name),
                barcode: body.barcode?.trim() || null,
                // OEM kodu: bayiye özel sku'yu üreticinin resmî koduna bağlar —
                // çapraz-bayi parça analizinin tek yolu. İsteğe bağlı, sürtünme eklemez.
                oemCode: body.oemCode?.trim() || null,
                // Marka yazılmadıysa parça adından yakala ("Canon fırın ünitesi" -> Canon).
                // Bulunamazsa boş kalır; tahmin YAZILMAZ.
                oemBrand: body.oemBrand?.trim() || detectBrandInText(body.name),
            },
        });

        return NextResponse.json(part);
    } catch (e: any) {
        console.error('PART CREATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
