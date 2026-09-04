import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// ⛔ Bu uç SÜPER ADMİN hesabı üretiyor — platformun en yetkili hesabı.
// Eskiden ortam değişkeni yoksa KODDAKİ SABİT sırra düşüyordu ve DEPO PUBLIC:
// o sır GitHub'da herkese açıktı. Yani SETUP_SECRET tanımlanmamış bir kurulumda
// adresi bilen herkes kendine süper admin açabilirdi.
//
// Artık sabit yedek YOK: sır tanımlı değilse uç kapalı (fail-closed).
export async function POST(req: NextRequest) {
    try {
        const beklenen = process.env.SETUP_SECRET;
        if (!beklenen) {
            return NextResponse.json(
                { error: 'Kurulum ucu kapalı — SETUP_SECRET tanımlı değil.' },
                { status: 503 },
            );
        }

        const { secret, email, password, name } = await req.json();

        if (secret !== beklenen) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 });
        }

        const adminEmail = email || 'superadmin@demo.com';
        const adminPassword = password || 'admin170305';
        const adminName = name || 'Süper Admin';

        // Varsa sil, yeniden oluştur
        const existing = await (prisma as any).superAdmin.findUnique({
            where: { email: adminEmail }
        });

        if (existing) {
            await (prisma as any).superAdmin.delete({ where: { email: adminEmail } });
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const admin = await (prisma as any).superAdmin.create({
            data: {
                email: adminEmail,
                password: hashedPassword,
                name: adminName,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Süper Admin oluşturuldu',
            id: admin.id,
            email: adminEmail,
            loginUrl: '/super-admin/login',
        });
    } catch (error: any) {
        console.error('Setup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
