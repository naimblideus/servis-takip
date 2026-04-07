import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TransactionType, TransactionCategory, PaymentMethod } from '@prisma/client';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: deviceId } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await req.json();
        const { counterBlack, counterColor, ticketId, includeMonthlyRent } = body;

        if (counterBlack === undefined || counterColor === undefined) {
            return NextResponse.json({ error: 'counterBlack ve counterColor zorunlu' }, { status: 400 });
        }

        // Cihaz ve tenant bilgilerini al
        const device = await prisma.device.findUnique({ where: { id: deviceId } });
        if (!device) return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });

        const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
        if (!tenant) return NextResponse.json({ error: 'Tenant bulunamadı' }, { status: 404 });

        // Son okumayı bul (delta hesabı için)
        const prev = await prisma.counterReading.findFirst({
            where: { tenantId: user.tenantId, deviceId },
            orderBy: { readingDate: 'desc' },
        });

        const deltaBlack = prev ? Math.max(0, counterBlack - prev.counterBlack) : 0;
        const deltaColor = prev ? Math.max(0, counterColor - prev.counterColor) : 0;

        // Birim fiyat: cihaz bazlı varsa onu kullan, yoksa tenant varsayılanı
        const effectiveBlackPrice = device.pricePerBlack !== null ? Number(device.pricePerBlack) : Number(tenant.pricePerBlack);
        const effectiveColorPrice = device.pricePerColor !== null ? Number(device.pricePerColor) : Number(tenant.pricePerColor);

        // Kiralık cihaz ise ücret hesapla
        let calculatedCost = 0;
        let monthlyRentAmount = 0;

        if (device.isRental) {
            const blackCost = deltaBlack * effectiveBlackPrice;
            const colorCost = deltaColor * effectiveColorPrice;
            calculatedCost = blackCost + colorCost;

            if (includeMonthlyRent) {
                monthlyRentAmount = Number(device.monthlyRent);
                calculatedCost += monthlyRentAmount;
            }
        }

        const reading = await prisma.counterReading.create({
            data: {
                tenantId: user.tenantId,
                deviceId,
                ticketId: ticketId || null,
                counterBlack,
                counterColor,
                deltaBlack,
                deltaColor,
                calculatedCost,
                monthlyRent: monthlyRentAmount,
            },
        });

        // Cihaz sayaç değerlerini güncelle
        await prisma.device.update({
            where: { id: deviceId },
            data: { counterBlack, counterColor },
        });

        // Kiralık cihazsa otomatik muhasebe kaydı oluştur
        if (device.isRental && calculatedCost > 0) {
            const blackCost = deltaBlack * effectiveBlackPrice;
            const colorCost = deltaColor * effectiveColorPrice;
            const counterFee = blackCost + colorCost;

            // Sayaç ücreti gelir kaydı
            if (counterFee > 0) {
                await prisma.financialTransaction.create({
                    data: {
                        tenantId: user.tenantId,
                        customerId: device.customerId,
                        readingId: reading.id,
                        type: 'INCOME' as TransactionType,
                        category: 'COUNTER_FEE' as TransactionCategory,
                        amount: counterFee,
                        method: 'CASH' as PaymentMethod,
                        description: `Sayaç okuma: S:${deltaBlack} R:${deltaColor} — ${device.brand} ${device.model}`,
                        date: new Date(),
                    },
                });
            }

            // Aylık aidat gelir kaydı
            if (monthlyRentAmount > 0) {
                await prisma.financialTransaction.create({
                    data: {
                        tenantId: user.tenantId,
                        customerId: device.customerId,
                        readingId: reading.id,
                        type: 'INCOME' as TransactionType,
                        category: 'RENTAL_FEE' as TransactionCategory,
                        amount: monthlyRentAmount,
                        method: 'CASH' as PaymentMethod,
                        description: `Aylık kira bedeli — ${device.brand} ${device.model}`,
                        date: new Date(),
                    },
                });
            }
        }

        return NextResponse.json({
            ...reading,
            breakdown: device.isRental ? {
                deltaBlack,
                deltaColor,
                pricePerBlack: effectiveBlackPrice,
                pricePerColor: effectiveColorPrice,
                blackCost: deltaBlack * effectiveBlackPrice,
                colorCost: deltaColor * effectiveColorPrice,
                monthlyRent: monthlyRentAmount,
                total: calculatedCost,
            } : null,
        });
    } catch (e: any) {
        console.error('COUNTER READING ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: deviceId } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Cihaz bilgisi + tenant fiyatlarını da dön
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { pricePerBlack: true, pricePerColor: true },
    });

    const readings = await prisma.counterReading.findMany({
        where: { deviceId },
        orderBy: { readingDate: 'desc' },
        take: 20,
        include: { ticket: { select: { ticketNumber: true } } },
    });

    // Effective pricing: device-level overrides tenant-level
    const effectiveBlackPrice = device?.pricePerBlack !== null && device?.pricePerBlack !== undefined
        ? Number(device.pricePerBlack) : Number(tenant?.pricePerBlack ?? 0);
    const effectiveColorPrice = device?.pricePerColor !== null && device?.pricePerColor !== undefined
        ? Number(device.pricePerColor) : Number(tenant?.pricePerColor ?? 0);

    return NextResponse.json({
        readings,
        device: device ? {
            isRental: device.isRental,
            monthlyRent: Number(device.monthlyRent),
            pricePerBlack: device.pricePerBlack !== null ? Number(device.pricePerBlack) : null,
            pricePerColor: device.pricePerColor !== null ? Number(device.pricePerColor) : null,
        } : null,
        pricing: {
            pricePerBlack: effectiveBlackPrice,
            pricePerColor: effectiveColorPrice,
            isDeviceLevel: device?.pricePerBlack !== null || device?.pricePerColor !== null,
        },
    });
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: deviceId } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const url = new URL(req.url);
        const readingId = url.searchParams.get('readingId');
        if (!readingId) return NextResponse.json({ error: 'readingId zorunlu' }, { status: 400 });

        // Okumanın var olduğunu ve tenant'a ait olduğunu kontrol et
        const reading = await prisma.counterReading.findFirst({
            where: { id: readingId, tenantId: user.tenantId, deviceId },
        });
        if (!reading) return NextResponse.json({ error: 'Okuma bulunamadı' }, { status: 404 });

        // Sayaç okumasını sil (muhasebe kayıtları SİLİNMEZ)
        await prisma.counterReading.delete({ where: { id: readingId } });

        // Cihaz sayaç değerlerini son okumayla güncelle
        const lastReading = await prisma.counterReading.findFirst({
            where: { tenantId: user.tenantId, deviceId },
            orderBy: { readingDate: 'desc' },
        });

        await prisma.device.update({
            where: { id: deviceId },
            data: {
                counterBlack: lastReading?.counterBlack ?? null,
                counterColor: lastReading?.counterColor ?? null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('COUNTER READING DELETE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
