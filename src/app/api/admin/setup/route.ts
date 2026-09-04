import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// POST /api/admin/setup — İlk SUPER_ADMIN kullanıcıyı oluştur.
//
// Tek korumu "zaten SUPER_ADMIN varsa reddet"ti. Bu yarış açıktı: süper admin
// HENÜZ yokken (taze kurulum, sıfırlanmış veritabanı, geri yükleme sonrası)
// adresi bilen herkes kendine en yetkili hesabı açabilirdi. Artık diğer iki
// kurulum ucuyla aynı kapı: SETUP_SECRET tanımlı ve doğru olmalı.
export async function POST(req: Request) {
    try {
        const beklenen = process.env.SETUP_SECRET;
        if (!beklenen) {
            return NextResponse.json(
                { error: 'Kurulum ucu kapalı — SETUP_SECRET tanımlı değil.' },
                { status: 503 },
            );
        }

        // Zaten SUPER_ADMIN varsa reddet
        const existing = await prisma.user.findFirst({
            where: { role: 'SUPER_ADMIN' as any },
        });
        if (existing) {
            return NextResponse.json({ error: 'Super Admin zaten mevcut' }, { status: 400 });
        }

        const body = await req.json();
        if (body?.secret !== beklenen) {
            return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
        }
        const { email, password, name } = body;

        if (!email || !password || !name) {
            return NextResponse.json({ error: 'email, password, name zorunlu' }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // İlk tenant yoksa oluştur, varsa mevcut olanı kullan
        let tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
        if (!tenant) {
            tenant = await prisma.tenant.create({
                data: { name: 'Ana Yönetim', plan: 'pro' },
            });
        }

        const user = await prisma.user.create({
            data: {
                tenantId: tenant.id,
                email,
                passwordHash,
                name,
                role: 'SUPER_ADMIN' as any,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Super Admin oluşturuldu! Artık giriş yapabilirsiniz.',
            user: { id: user.id, email: user.email, name: user.name },
        });
    } catch (e: any) {
        console.error('SETUP ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
