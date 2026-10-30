import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// ⛔ SIR KODA GÖMÜLMEZ. Bu dosyada sabit bir sır vardı ('setup-servis-...')
// ve DEPO PUBLIC: sır GitHub'da herkese açıktı. Bu ucu bilen herkes demo
// bayisi açıp kullanıcı yazabiliyordu.
//
// Artık sır YALNIZ ortam değişkeninden gelir ve tanımlı değilse uç KAPALIDIR
// (fail-closed). Kurulum bir kez yapılır; kalıcı açık bir arka kapı olmamalı.
// Aynı desen sayaç e-posta ucunda da kullanılıyor.
export async function POST(req: NextRequest) {
    try {
        const beklenen = process.env.SETUP_SECRET;
        if (!beklenen) {
            return ucHatasi('KURULUM_UCU_KAPALI_SETUP_SECRET', 503);
        }
        const { secret, password } = await req.json();
        if (secret !== beklenen) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
        }
        // Demo admin şifresinin de varsayılanı YOK: eskiden koddaki sabit şifreyle
        // kuruyor/sıfırlıyordu ve depo public. Şifre gövdede gelir, yanıtta dönmez.
        const demoSifre = typeof password === 'string' ? password : '';
        if (!demoSifre) {
            return ucHatasi('KURULUM_EPOSTA_SIFRE_ZORUNLU', 400);
        }
        if (demoSifre.length < 12) {
            return ucHatasi('KURULUM_SIFRE_EN_AZ_12', 400);
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
            const hash = await bcrypt.hash(demoSifre, 10);
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
            results.push('✅ Admin oluşturuldu: admin@demo.com');
        } else {
            // Şifreyi sıfırla
            const hash = await bcrypt.hash(demoSifre, 10);
            await prisma.user.update({
                where: { id: existingAdmin.id },
                data: { passwordHash: hash, isActive: true },
            });
            results.push('✅ Admin şifresi sıfırlandı: admin@demo.com');
        }

        // admindemo@gmail.com kullanıcısı
        const demoEmail = 'admindemo@gmail.com';
        const existingDemo = await prisma.user.findFirst({ where: { email: demoEmail } });
        if (existingDemo) {
            const hash = await bcrypt.hash(demoSifre, 10);
            await prisma.user.update({
                where: { id: existingDemo.id },
                data: { passwordHash: hash, isActive: true },
            });
            results.push('✅ admindemo@gmail.com şifresi sıfırlandı');
        }

        return NextResponse.json({
            success: true,
            results,
            credentials: [
                { email: 'admin@demo.com', role: 'ADMIN' },
                { email: 'admindemo@gmail.com', role: 'ADMIN (şifre sıfırlandı)' },
            ],
        });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
