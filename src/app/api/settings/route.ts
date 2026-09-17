import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sayacAdresi } from '@/lib/sayac-eposta';

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
            id: true, name: true, logo: true, phone: true, address: true,
            pricePerBlack: true, pricePerColor: true, portalShowFinancials: true, sayacEpostaKodu: true,
            // Çalışma takvimi — SLA ölçümü mesai saatine göre yapılır.
            workTimezone: true, workDays: true, workStartMin: true, workEndMin: true, workHolidays: true,
        },
    });

    // Adres sunucuda kurulur: alan adı ortam değişkeninden gelir ve kanal
    // kapalıysa null döner — ekran hiç göstermesin (bkz. lib/sayac-eposta.ts).
    return NextResponse.json({ ...tenant, sayacEpostaAdresi: sayacAdresi(tenant?.sayacEpostaKodu) });
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
    }

    const body = await req.json();
    const {
        name, phone, address, pricePerBlack, pricePerColor, portalShowFinancials,
        workTimezone, workDays, workStartMin, workEndMin, workHolidays,
    } = body;

    // ÇALIŞMA TAKVİMİ — SLA'nın ölçüldüğü zemin. Bozuk ayar sessizce
    // kaydedilirse rapor "0 dakikada müdahale" der ve ihlali gizler; o yüzden
    // burada reddediliyor.
    const gunListesi = (v: unknown): string | null => {
        if (v === undefined || v === null) return null;
        const g = String(v).split(',').map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
        return g.length ? [...new Set(g)].sort((a, b) => a - b).join(',') : null;
    };
    const dakika = (v: unknown): number | null => {
        if (v === undefined || v === null || v === '') return null;
        const n = Number(v);
        return Number.isInteger(n) && n >= 0 && n <= 24 * 60 ? n : null;
    };
    const bas = dakika(workStartMin);
    const bit = dakika(workEndMin);
    if (workStartMin !== undefined && bas === null) return ucHatasi('GECERSIZ_ISTEK', 400);
    if (workEndMin !== undefined && bit === null) return ucHatasi('GECERSIZ_ISTEK', 400);
    if (bas !== null && bit !== null && bit <= bas) return ucHatasi('GECERSIZ_ISTEK', 400);
    if (workDays !== undefined && gunListesi(workDays) === null) return ucHatasi('GECERSIZ_ISTEK', 400);
    // Saat dilimi gerçekten var mı — yazım hatası ölçümü sessizce kaydırırdı.
    if (workTimezone !== undefined && workTimezone !== null && workTimezone !== '') {
        try { new Intl.DateTimeFormat('en-US', { timeZone: String(workTimezone) }); }
        catch { return ucHatasi('GECERSIZ_ISTEK', 400); }
    }
    const tatilListesi = (v: unknown): string | null => {
        if (v === undefined || v === null) return null;
        const g = String(v).split(',').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
        return g.join(',');
    };

    const tenant = await prisma.tenant.update({
        where: { id: user.tenantId },
        data: {
            ...(name !== undefined && { name }),
            ...(phone !== undefined && { phone }),
            ...(address !== undefined && { address }),
            ...(pricePerBlack !== undefined && { pricePerBlack: parseFloat(pricePerBlack) }),
            ...(pricePerColor !== undefined && { pricePerColor: parseFloat(pricePerColor) }),
            // Müşteri panelinde bakiye/fatura/tutar gösterilsin mi
            ...(portalShowFinancials !== undefined && { portalShowFinancials: Boolean(portalShowFinancials) }),
            ...(workTimezone !== undefined && workTimezone !== '' && { workTimezone: String(workTimezone) }),
            ...(workDays !== undefined && { workDays: gunListesi(workDays) ?? '1,2,3,4,5' }),
            ...(bas !== null && { workStartMin: bas }),
            ...(bit !== null && { workEndMin: bit }),
            ...(workHolidays !== undefined && { workHolidays: tatilListesi(workHolidays) }),
        },
    });

    return NextResponse.json(tenant);
}

// Logo yükleme — Base64 data URL olarak DB'ye kaydeder (Docker/Coolify uyumlu, filesystem gerektirmez)
export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('logo') as File;
        if (!file) return ucHatasi('LOGO_DOSYASI_GEREKLI', 400);

        // Dosya uzantısı kontrolü
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
        const allowedExts = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
        if (!allowedExts.includes(ext)) {
            return ucHatasi('SADECE_PNG_JPG_SVG_WEBP', 400);
        }

        // Boyut kontrolü: max 2MB
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
            return ucHatasi('LOGO_2MB_DAN_KUCUK_OLMALIDIR', 400);
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // MIME tipi belirle
        const mimeMap: Record<string, string> = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            svg: 'image/svg+xml',
            webp: 'image/webp',
        };
        const mimeType = mimeMap[ext] || 'image/png';

        // Base64 data URL olarak kaydet — dosya sistemi gerektirmez, Docker/Coolify restart'larından etkilenmez
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;

        // DB güncelle
        await prisma.tenant.update({
            where: { id: user.tenantId },
            data: { logo: dataUrl },
        });

        return NextResponse.json({ logo: dataUrl });
    } catch (e: any) {
        console.error('LOGO UPLOAD ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
