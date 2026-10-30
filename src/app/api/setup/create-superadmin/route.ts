import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// ⛔ Bu uç SÜPER ADMİN hesabı üretiyor — platformun en yetkili hesabı.
// Eskiden ortam değişkeni yoksa KODDAKİ SABİT sırra düşüyordu ve DEPO PUBLIC:
// o sır GitHub'da herkese açıktı. Yani SETUP_SECRET tanımlanmamış bir kurulumda
// adresi bilen herkes kendine süper admin açabilirdi.
//
// Artık sabit yedek YOK: sır tanımlı değilse uç kapalı (fail-closed).
//
// Aynı sebeple e-posta ve şifrenin de varsayılanı YOK. Eskiden gövdede
// gelmezse koddaki sabit hesap bilgisine düşüyordu; depo public olduğu için
// varsayılanla kurulmuş her süper admin hesabının şifresi herkesçe biliniyordu.
// Şifre en az 12 karakter: bu hesap bütün bayilerin verisini görür.
const EN_KISA_SIFRE = 12;

export async function POST(req: NextRequest) {
    try {
        const beklenen = process.env.SETUP_SECRET;
        if (!beklenen) {
            return ucHatasi('KURULUM_UCU_KAPALI_SETUP_SECRET', 503);
        }

        const { secret, email, password, name } = await req.json();

        if (secret !== beklenen) {
            return ucHatasi('YETKISIZ_ERISIM', 403);
        }

        const adminEmail = typeof email === 'string' ? email.trim() : '';
        const adminPassword = typeof password === 'string' ? password : '';
        if (!adminEmail || !adminPassword) {
            return ucHatasi('KURULUM_EPOSTA_SIFRE_ZORUNLU', 400);
        }
        if (adminPassword.length < EN_KISA_SIFRE) {
            return ucHatasi('KURULUM_SIFRE_EN_AZ_12', 400);
        }
        const adminName = name || 'Süper Admin';

        // Varsa sil, yeniden oluştur. Silmek hesabın 2FA kaydını (TOTP sırrı,
        // kurtarma kodları) da götürür: yeni hesap 2FA'sız başlar. Bunu sessizce
        // yapmıyoruz, yanıtta söylüyoruz ki kurulumu yapan 2FA'yı yeniden açsın.
        const existing = await (prisma as any).superAdmin.findUnique({
            where: { email: adminEmail }
        });

        const ikiAdimSifirlandi = !!existing?.totpEnabled;
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
            message: existing ? 'Süper Admin yeniden oluşturuldu (eski hesap silindi)' : 'Süper Admin oluşturuldu',
            id: admin.id,
            email: adminEmail,
            loginUrl: '/super-admin/login',
            eskiHesapDegisti: !!existing,
            ikiAdimSifirlandi,
            ...(ikiAdimSifirlandi && {
                uyari: "Eski hesabın iki adımlı doğrulaması (2FA) silindi. Girişten sonra 2FA'yı yeniden açın.",
            }),
        });
    } catch (error: any) {
        console.error('Setup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
