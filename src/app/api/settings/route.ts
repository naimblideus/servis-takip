import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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

// Logo yükleme
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

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Dosya uzantısı
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
        const allowedExts = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
        if (!allowedExts.includes(ext)) {
            return NextResponse.json({ error: 'Sadece PNG, JPG, SVG, WebP yüklenebilir' }, { status: 400 });
        }

        // Dosyayı public/uploads klasörüne kaydet
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const fileName = `logo-${user.tenantId}.${ext}`;
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);

        const logoUrl = `/uploads/${fileName}`;

        // DB güncelle
        await prisma.tenant.update({
            where: { id: user.tenantId },
            data: { logo: logoUrl },
        });

        return NextResponse.json({ logo: logoUrl });
    } catch (e: any) {
        console.error('LOGO UPLOAD ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
