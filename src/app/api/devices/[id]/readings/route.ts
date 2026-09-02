import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { counterOverage } from '@/lib/invoicing';
import { createReading, ReadingError } from '@/lib/readings';
import { oturumKullanicisi } from '@/lib/api-auth';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: deviceId } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await oturumKullanicisi(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await req.json();
        const { counterBlack, counterColor, ticketId, includeMonthlyRent, photo, reset } = body;

        // TEK KAYNAK: aşım/dahil-paket/düşüş mantığı src/lib/readings.ts'te (toplu uç da aynısını kullanır)
        const { reading, breakdown, warning } = await createReading({
            tenantId: user.tenantId,
            deviceId,
            counterBlack,
            counterColor,
            ticketId,
            includeMonthlyRent,
            photo,
            reset,
            // Fotoğraf varsa görsel kanıt seviyesi; yoksa en zayıf seviye.
            source: photo ? 'FOTOGRAF' : 'ELLE',
        });

        return NextResponse.json({ ...reading, warning, breakdown });
    } catch (e: any) {
        // Beklenen iş kuralı hataları (ör. COUNTER_DECREASE) kodu+durumuyla dönmeli — UI buna göre davranıyor
        if (e instanceof ReadingError) {
            return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
        }
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

    const user = await oturumKullanicisi(session);
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
        const user = await oturumKullanicisi(session);
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
        const user = await oturumKullanicisi(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const url = new URL(req.url);
        const readingId = url.searchParams.get('readingId');
        if (!readingId) return NextResponse.json({ error: 'readingId zorunlu' }, { status: 400 });

        const body = await req.json();
        const { counterBlack, counterColor, reset } = body;

        if (counterBlack === undefined || counterColor === undefined) {
            return NextResponse.json({ error: 'counterBlack ve counterColor zorunlu' }, { status: 400 });
        }

        // Okumanın var olduğunu ve tenant'a ait olduğunu kontrol et
        const reading = await prisma.counterReading.findFirst({
            where: { id: readingId, tenantId: user.tenantId, deviceId },
        });
        if (!reading) return NextResponse.json({ error: 'Okuma bulunamadı' }, { status: 404 });
        // Faturalanmış okuma DEĞİŞTİRİLEMEZ (immutable evidence — fatura/defter desync olmasın).
        if (reading.billed) return NextResponse.json({ error: 'Bu okuma faturalandığı için düzenlenemez.' }, { status: 409 });

        const device = await prisma.device.findFirst({ where: { id: deviceId, tenantId: user.tenantId } });
        if (!device) return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });

        const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });

        // Bir önceki okumayı bul (bu okumadan önce)
        const prev = await prisma.counterReading.findFirst({
            where: { tenantId: user.tenantId, deviceId, readingDate: { lt: reading.readingDate }, id: { not: readingId } },
            orderBy: { readingDate: 'desc' },
        });

        const prevB = prev ? prev.counterBlack : null;
        const prevC = prev ? prev.counterColor : null;
        const decreased = (prevB !== null && counterBlack < prevB) || (prevC !== null && counterColor < prevC);
        if (decreased && !reset) {
            return NextResponse.json({ error: 'Sayaç değeri öncekinden düşük. Cihaz sıfırlandıysa/değiştiyse "sayaç sıfırlandı" onayıyla tekrar gönderin.', code: 'COUNTER_DECREASE' }, { status: 400 });
        }
        const deltaBlack = prevB === null ? 0 : (reset && counterBlack < prevB ? Math.max(0, counterBlack) : Math.max(0, counterBlack - prevB));
        const deltaColor = prevC === null ? 0 : (reset && counterColor < prevC ? Math.max(0, counterColor) : Math.max(0, counterColor - prevC));

        // ── SONRAKİ OKUMA ZİNCİRİ ────────────────────────────────────────────
        // Bir okumayı değiştirmek YALNIZ onu ilgilendirmez: bir SONRAKİ okumanın
        // farkı da bu değere göre hesaplanmıştı. Sonraki yeniden hesaplanmazsa
        // fark sessizce yanlış kalır ve o fark faturaya girer.
        const sonraki = await prisma.counterReading.findFirst({
            where: { tenantId: user.tenantId, deviceId, readingDate: { gt: reading.readingDate } },
            orderBy: { readingDate: 'asc' },
        });

        // Yeni değer sonraki okumadan büyükse zincir bozulur (sonraki düşüş olur).
        // Sonraki FATURALANMIŞSA hiç dokunamayız — düzenlemeyi tümden reddediyoruz,
        // yarım tutarlı bir zincir bırakmaktansa hayır demek doğru.
        if (sonraki) {
            if (counterBlack > sonraki.counterBlack || counterColor > sonraki.counterColor) {
                return NextResponse.json({
                    error: `Bu değer bir sonraki okumadan (S/B ${sonraki.counterBlack.toLocaleString('tr-TR')}) büyük. Sayaç geriye gidemez.`,
                    code: 'SONRAKI_DUSUK',
                }, { status: 400 });
            }
            if (sonraki.billed) {
                return NextResponse.json({
                    error: 'Bir sonraki okuma faturalandığı için bu okuma düzenlenemez — düzenleme onun farkını da değiştirirdi.',
                    code: 'SONRAKI_FATURALI',
                }, { status: 409 });
            }
        }

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

        // Okuma + zincir TEK transaction'da: yarım güncellenmiş zincir kalmasın.
        const { updated, sonrakiYeniFark } = await prisma.$transaction(async (tx) => {
            const updated = await tx.counterReading.update({
                where: { id: readingId },
                data: { counterBlack, counterColor, deltaBlack, deltaColor, calculatedCost },
            });

            // SONRAKİ okumanın farkını yeni değere göre yeniden hesapla.
            let sonrakiYeniFark: { black: number; color: number } | null = null;
            if (sonraki) {
                const sdB = Math.max(0, sonraki.counterBlack - counterBlack);
                const sdC = Math.max(0, sonraki.counterColor - counterColor);
                let sMaliyet = 0;
                if (device.isRental && tenant) {
                    const srd = sonraki.readingDate;
                    const sStart = new Date(srd.getFullYear(), srd.getMonth(), 1);
                    const sAgg = await tx.counterReading.aggregate({
                        where: {
                            tenantId: user.tenantId, deviceId, id: { not: sonraki.id },
                            readingDate: { gte: sStart, lt: srd },
                        },
                        _sum: { deltaBlack: true, deltaColor: true },
                    });
                    const sch = counterOverage(device, sdB, sdC, tenant, sAgg._sum.deltaBlack ?? 0, sAgg._sum.deltaColor ?? 0);
                    sMaliyet = sch.total + Number(sonraki.monthlyRent);
                }
                await tx.counterReading.update({
                    where: { id: sonraki.id },
                    data: { deltaBlack: sdB, deltaColor: sdC, calculatedCost: sMaliyet },
                });
                sonrakiYeniFark = { black: sdB, color: sdC };
            }

            // Bu EN SON okumaysa cihazın "güncel sayaç" önbelleği de güncellenir.
            const lastReading = await tx.counterReading.findFirst({
                where: { tenantId: user.tenantId, deviceId },
                orderBy: { readingDate: 'desc' },
                select: { id: true },
            });
            if (lastReading?.id === readingId) {
                await tx.device.update({ where: { id: deviceId }, data: { counterBlack, counterColor } });
            }
            return { updated, sonrakiYeniFark };
        });

        return NextResponse.json({
            success: true,
            reading: updated,
            // Arayüz "sonraki okumanın farkı da güncellendi" diyebilsin
            sonrakiGuncellendi: sonrakiYeniFark,
        });
    } catch (e: any) {
        console.error('COUNTER READING PATCH ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
