import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GÜVENLİK: Bu endpoint kullanıldıktan sonra silin!
// Erişim için secret key gerekir
const SETUP_SECRET = process.env.SETUP_SECRET || 'setup-servis-takip-2026';

export async function POST(req: NextRequest) {
    try {
        const { secret, email, password, name } = await req.json();

        if (secret !== SETUP_SECRET) {
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
