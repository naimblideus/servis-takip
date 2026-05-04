import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/printer-stock — Stok listesi
export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search') || '';

    const where: any = { tenantId: user.tenantId };
    if (category) where.category = category;
    if (search.trim()) {
        where.OR = [
            { brand: { contains: search, mode: 'insensitive' } },
            { model: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
        ];
    }

    const stocks = await prisma.printerStock.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });

    // Özet istatistikler
    const all = await prisma.printerStock.findMany({ where: { tenantId: user.tenantId } });
    const summary = {
        totalItems: all.length,
        totalValue: all.reduce((s, i) => s + Number(i.buyPrice) * i.quantity, 0),
        byCategory: {
            TONER: all.filter(i => i.category === 'TONER').length,
            MUREKEP: all.filter(i => i.category === 'MUREKEP').length,
            YAZICI: all.filter(i => i.category === 'YAZICI').length,
        },
        sold: all.filter(i => i.soldAt !== null).length,
        inStock: all.filter(i => i.soldAt === null).length,
    };

    return NextResponse.json({ stocks, summary });
}

// POST /api/printer-stock — Stok ekle
export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    try {
        const body = await req.json();
        const { category, brand, model, condition, color, quantity, buyPrice, sellPrice, notes } = body;

        if (!category || !brand || !model) {
            return NextResponse.json({ error: 'kategori, marka ve model zorunlu' }, { status: 400 });
        }

        const item = await prisma.printerStock.create({
            data: {
                tenantId: user.tenantId,
                category,
                brand,
                model,
                condition: condition || 'SIFIR',
                color: color || null,
                quantity: parseInt(quantity) || 1,
                buyPrice: parseFloat(buyPrice) || 0,
                sellPrice: parseFloat(sellPrice) || 0,
                notes: notes || null,
            },
        });

        return NextResponse.json(item);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
