import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, name: true, logo: true, phone: true, address: true, pricePerBlack: true, pricePerColor: true },
    });

    return NextResponse.json(tenant);
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
    }

    const body = await req.json();
    const { name, phone, address, pricePerBlack, pricePerColor } = body;

    const tenant = await prisma.tenant.update({
        where: { id: user.tenantId },
        data: {
            ...(name !== undefined && { name }),
            ...(phone !== undefined && { phone }),
            ...(address !== undefined && { address }),
            ...(pricePerBlack !== undefined && { pricePerBlack: parseFloat(pricePerBlack) }),
            ...(pricePerColor !== undefined && { pricePerColor: parseFloat(pricePerColor) }),
        },
    });

    return NextResponse.json(tenant);
}

// Logo yükleme — Base64 data URL olarak DB'ye kaydeder (Docker/Coolify uyumlu, filesystem gerektirmez)
export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('logo') as File;
        if (!file) return NextResponse.json({ error: 'Logo dosyası gerekli' }, { status: 400 });

        // Dosya uzantısı kontrolü
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
        const allowedExts = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
        if (!allowedExts.includes(ext)) {
            return NextResponse.json({ error: 'Sadece PNG, JPG, SVG, WebP yüklenebilir' }, { status: 400 });
        }

        // Boyut kontrolü: max 2MB
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json({ error: "Logo 2MB'dan küçük olmalıdır" }, { status: 400 });
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
