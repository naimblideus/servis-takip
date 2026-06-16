import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { counterOverage } from '@/lib/invoicing';

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
        const { counterBlack, counterColor, ticketId, includeMonthlyRent, photo } = body;
        // Sayaç fotoğrafı (küçültülmüş JPEG data URL); güvenli boyut sınırı
        const safePhoto = typeof photo === 'string' && photo.startsWith('data:image/') && photo.length < 800000 ? photo : null;

        if (counterBlack === undefined || counterColor === undefined) {
            return NextResponse.json({ error: 'counterBlack ve counterColor zorunlu' }, { status: 400 });
        }

        // Cihaz ve tenant bilgilerini al
        const device = await prisma.device.findFirst({ where: { id: deviceId, tenantId: user.tenantId } });
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

        // Kiralık cihaz ise kademeli (dahil paket + aşım) ücret hesapla — gerçek fatura mantığıyla aynı (tek kaynak)
        let calculatedCost = 0;
        let monthlyRentAmount = 0;
        let ch: ReturnType<typeof counterOverage> | null = null;

        if (device.isRental) {
            // Bu dönemde daha önce okunan sayfalar — dahil paketi kümülatif uygula (mükerrer indirim önle)
            const now = new Date();
            const pStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const pEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const prevAgg = await prisma.counterReading.aggregate({
                where: { tenantId: user.tenantId, deviceId, readingDate: { gte: pStart, lt: pEnd } },
                _sum: { deltaBlack: true, deltaColor: true },
            });
            ch = counterOverage(device, deltaBlack, deltaColor, tenant, prevAgg._sum.deltaBlack ?? 0, prevAgg._sum.deltaColor ?? 0);
            calculatedCost = ch.total;

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
                photo: safePhoto,
            },
        });

        // Cihaz sayaç değerlerini güncelle
        await prisma.device.update({
            where: { id: deviceId },
            data: { counterBlack, counterColor },
        });

        // NOT: Gelir kaydı artık burada YAZILMAZ. Sayaç okuması sadece kaydedilir;
        // gelir (FinancialTransaction) dönem faturası kesilince src/lib/invoicing.ts
        // tarafından oluşturulur (mükerrer gelir önlenir). Bu okuma billed=false olarak
        // birikir ve aylık cron / DELIVERED tetiğiyle faturaya dönüşür.

        return NextResponse.json({
            ...reading,
            breakdown: device.isRental && ch ? {
                // Faturalanan (aşım) sayfa adedi — dahil paket düşülmüş; included=0 ise delta'nın aynısı
                deltaBlack: ch.billB,
                deltaColor: ch.billC,
                pricePerBlack: ch.overBlack,
                pricePerColor: ch.overColor,
                blackCost: ch.blackTotal,
                colorCost: ch.colorTotal,
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

    // Cihaz bilgisi + tenant fiyatlarını da dön (IDOR: yalnız bu tenant'ın cihazı)
    const device = await prisma.device.findFirst({ where: { id: deviceId, tenantId: user.tenantId } });
    if (!device) return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });
    const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { pricePerBlack: true, pricePerColor: true },
    });

    const readings = await prisma.counterReading.findMany({
        where: { deviceId, tenantId: user.tenantId },
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
        // Foto'yu listede taşıma (ağır); sadece var/yok bilgisi — görsel ayrı uçtan çekilir
        readings: readings.map(({ photo, ...r }) => ({ ...r, hasPhoto: !!photo })),
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
        if (reading.billed) return NextResponse.json({ error: 'Bu okuma faturalandığı için silinemez' }, { status: 409 });

        // Sayaç okumasını sil
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

export async function PATCH(
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

        const body = await req.json();
        const { counterBlack, counterColor } = body;

        if (counterBlack === undefined || counterColor === undefined) {
            return NextResponse.json({ error: 'counterBlack ve counterColor zorunlu' }, { status: 400 });
        }

        // Okumanın var olduğunu ve tenant'a ait olduğunu kontrol et
        const reading = await prisma.counterReading.findFirst({
            where: { id: readingId, tenantId: user.tenantId, deviceId },
        });
        if (!reading) return NextResponse.json({ error: 'Okuma bulunamadı' }, { status: 404 });

        const device = await prisma.device.findFirst({ where: { id: deviceId, tenantId: user.tenantId } });
        if (!device) return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });

        const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });

        // Bir önceki okumayı bul (bu okumadan önce)
        const prev = await prisma.counterReading.findFirst({
            where: { tenantId: user.tenantId, deviceId, readingDate: { lt: reading.readingDate }, id: { not: readingId } },
            orderBy: { readingDate: 'desc' },
        });

        const deltaBlack = prev ? Math.max(0, counterBlack - prev.counterBlack) : 0;
        const deltaColor = prev ? Math.max(0, counterColor - prev.counterColor) : 0;

        let calculatedCost = 0;
        if (device.isRental && tenant) {
            // Kademeli ücret — bu dönemde bu okumadan ÖNCEKİ sayfalar dahil paketi kümülatif yer
            const rd = reading.readingDate;
            const pStart = new Date(rd.getFullYear(), rd.getMonth(), 1);
            const prevAgg = await prisma.counterReading.aggregate({
                where: { tenantId: user.tenantId, deviceId, id: { not: readingId }, readingDate: { gte: pStart, lt: rd } },
                _sum: { deltaBlack: true, deltaColor: true },
            });
            const ch = counterOverage(device, deltaBlack, deltaColor, tenant, prevAgg._sum.deltaBlack ?? 0, prevAgg._sum.deltaColor ?? 0);
            calculatedCost = ch.total + Number(reading.monthlyRent);
        }

        // Okuyu güncelle
        const updated = await prisma.counterReading.update({
            where: { id: readingId },
            data: { counterBlack, counterColor, deltaBlack, deltaColor, calculatedCost },
        });

        // Eğer bu en son okumaysa cihaz sayacını da güncelle
        const lastReading = await prisma.counterReading.findFirst({
            where: { tenantId: user.tenantId, deviceId },
            orderBy: { readingDate: 'desc' },
        });
        if (lastReading?.id === readingId) {
            await prisma.device.update({
                where: { id: deviceId },
                data: { counterBlack, counterColor },
            });
        }

        return NextResponse.json({ success: true, reading: updated });
    } catch (e: any) {
        console.error('COUNTER READING PATCH ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
