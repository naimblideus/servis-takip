import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const SETUP_SECRET = 'setup-servis-takip-2026';

export async function POST(req: NextRequest) {
    try {
        const { secret } = await req.json();
        if (secret !== SETUP_SECRET) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
        }

        const results: string[] = [];

        // Tenant var mı kontrol et
        let tenant = await prisma.tenant.findFirst({ where: { name: 'Demo Teknik Servis' } });
        if (!tenant) {
            tenant = await prisma.tenant.create({
                data: { name: 'Demo Teknik Servis', plan: 'pro' },
            });
            results.push('✅ Tenant oluşturuldu: Demo Teknik Servis');
        } else {
            results.push('ℹ️ Tenant zaten var: ' + tenant.name);
        }

        // Admin kullanıcı
        const adminEmail = 'admin@demo.com';
        const existingAdmin = await prisma.user.findFirst({ where: { email: adminEmail, tenantId: tenant.id } });
        if (!existingAdmin) {
            const hash = await bcrypt.hash('admin170305', 10);
            await prisma.user.create({
                data: {
                    tenantId: tenant.id,
                    email: adminEmail,
                    passwordHash: hash,
                    name: 'Admin User',
                    role: 'ADMIN',
                    isActive: true,
                },
            });
            results.push('✅ Admin oluşturuldu: admin@demo.com / admin170305');
        } else {
            // Şifreyi sıfırla
            const hash = await bcrypt.hash('admin170305', 10);
            await prisma.user.update({
                where: { id: existingAdmin.id },
                data: { passwordHash: hash, isActive: true },
            });
            results.push('✅ Admin şifresi sıfırlandı: admin@demo.com / admin170305');
        }

        // admindemo@gmail.com kullanıcısı
        const demoEmail = 'admindemo@gmail.com';
        const existingDemo = await prisma.user.findFirst({ where: { email: demoEmail } });
        if (existingDemo) {
            const hash = await bcrypt.hash('admin170305', 10);
            await prisma.user.update({
                where: { id: existingDemo.id },
                data: { passwordHash: hash, isActive: true },
            });
            results.push('✅ admindemo@gmail.com şifresi sıfırlandı: admin170305');
        }

        return NextResponse.json({
            success: true,
            results,
            credentials: [
                { email: 'admin@demo.com', password: 'admin170305', role: 'ADMIN' },
                { email: 'admindemo@gmail.com', password: 'admin170305', role: 'ADMIN (şifre sıfırlandı)' },
            ],
        });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
