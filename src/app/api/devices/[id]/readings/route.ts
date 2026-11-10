import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createReading, ReadingError, okumaDuzelt, okumaSil } from '@/lib/readings';
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
        const { counterBlack, counterColor, ticketId, includeMonthlyRent, photo, reset, resetTur } = body;

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
            // Sebep olmadan gelen 'reset' CIHAZ_DEGISTI sayılır (fark 0). Bu tekil
            // uç eskiden türü hiç geçirmiyordu: Sayaç Turu'nda "sayaç sıfırlandı"
            // diyen bayi o dönemin kullanımını faturalayabiliyor, cihaz kartından
            // aynı şeyi diyen bayi ise sessizce SIFIR yazıyordu. Aynı beyan, iki
            // ekran, iki farklı tutar.
            resetTur,
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
    if (!device) return ucHatasi('CIHAZ_BULUNAMADI', 404);
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
            // Renkli sayaç alanı yalnız renkli cihazda (readings/bulk ile aynı kural; Pantum'un çoğu tek renkli).
            hasColor: (device.includedColor ?? 0) > 0 || device.pricePerColor != null || device.overagePriceColor != null || (device.counterColor ?? 0) > 0,
        } : null,
        pricing: {
            pricePerBlack: effectiveBlackPrice,
            pricePerColor: effectiveColorPrice,
            isDeviceLevel: device?.pricePerBlack !== null || device?.pricePerColor !== null,
        },
    });
}

/**
 * Okuma zinciri hatasını (lib/readings ReadingError) ucun çevrilebilir yanıtına çevirir.
 * `yol` aynı kodun iki uçtaki cümlesini ayırır (silinemez / düzenlenemez).
 */
function zincirHatasi(e: ReadingError, yol: 'SIL' | 'DUZELT') {
    switch (e.code) {
        case 'READING_NOT_FOUND': return ucHatasi('OKUMA_BULUNAMADI', 404);
        case 'DEVICE_NOT_FOUND': return ucHatasi('CIHAZ_BULUNAMADI', 404);
        case 'BILLED':
            return ucHatasi(yol === 'SIL' ? 'BU_OKUMA_FATURALANDIGI_ICIN_SILINEMEZ' : 'BU_OKUMA_FATURALANDIGI_ICIN_DUZENLENEMEZ', 409);
        case 'NEXT_BILLED':
            return yol === 'SIL'
                ? ucHatasi('BU_OKUMA_SILINEMEZ_SONRASINDAKI_OKUMA', 409)
                : ucHatasi('BIR_SONRAKI_OKUMA_FATURALANDIGI_ICIN', 409, { ek: { code: 'SONRAKI_FATURALI' } });
        case 'NEXT_LOWER':
            // Sayı sunucuda biçimlenmiyor: cümleyi kuran sözlük, biçimi de okuyanın diline bırakıyor.
            return ucHatasi('BU_DEGER_BIR_SONRAKI_OKUMADAN', 400, { deger: { p1: Number(e.veri?.p1 ?? 0) }, ek: { code: 'SONRAKI_DUSUK' } });
        case 'COUNTER_DECREASE':
            return ucHatasi('SAYAC_DEGERI_ONCEKINDEN_DUSUK_CIHAZ', 400, { ek: { code: 'COUNTER_DECREASE' } });
        default:
            return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
}

// Silme ve düzeltmenin kuralları lib/readings.ts'te (okumaSil, okumaDuzelt):
// kilitler, faturalanmış okuma koruması, beyanın (cihaz değişti / sayaç
// sıfırlandı) korunması ve zincirin onarımı tek yerde.
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

        const r = await okumaSil({ tenantId: user.tenantId, deviceId, readingId });
        return NextResponse.json({ success: true, zincirOnarildi: r.zincirOnarildi });
    } catch (e: any) {
        if (e instanceof ReadingError) return zincirHatasi(e, 'SIL');
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
        const { counterBlack, counterColor, reset, resetTur } = body;
        if (counterBlack === undefined || counterColor === undefined) {
            return NextResponse.json({ error: 'counterBlack ve counterColor zorunlu' }, { status: 400 });
        }

        const { updated, sonrakiYeniFark } = await okumaDuzelt({
            tenantId: user.tenantId,
            deviceId,
            readingId,
            counterBlack: Number(counterBlack),
            counterColor: Number(counterColor),
            // Gönderilmediyse okumanın saklı beyanı korunur (düzeltme penceresi göndermiyor).
            reset: typeof reset === 'boolean' ? reset : undefined,
            resetTur: resetTur === 'SAYAC_SIFIRLANDI' || resetTur === 'CIHAZ_DEGISTI' ? resetTur : undefined,
        });

        return NextResponse.json({
            success: true,
            reading: updated,
            // Arayüz "sonraki okumanın farkı da güncellendi" diyebilsin
            sonrakiGuncellendi: sonrakiYeniFark,
        });
    } catch (e: any) {
        if (e instanceof ReadingError) return zincirHatasi(e, 'DUZELT');
        console.error('COUNTER READING PATCH ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
