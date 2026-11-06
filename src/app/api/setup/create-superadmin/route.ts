import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

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
        // Kurtarma anahtarı tahminle bulunmasın: IP başına 10 dakikada 5 deneme.
        const rl = rateLimit(`sa-kurtar:${clientIp(req)}`, 5, 10 * 60_000);
        if (!rl.ok) return NextResponse.json({ ...tooMany(rl.retryAfter), hata: 'COK_DENEME' }, { status: 429 });

        const beklenen = process.env.SETUP_SECRET;
        if (!beklenen) {
            return ucHatasi('KURULUM_UCU_KAPALI_SETUP_SECRET', 503);
        }

        const { secret, email, password, name, ikiAdimSifirla } = await req.json();

        if (secret !== beklenen) {
            return ucHatasi('YETKISIZ_ERISIM', 403);
        }

        const adminEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const adminPassword = typeof password === 'string' ? password : '';
        if (!adminEmail || !adminPassword) {
            return ucHatasi('KURULUM_EPOSTA_SIFRE_ZORUNLU', 400);
        }
        if (adminPassword.length < EN_KISA_SIFRE) {
            return ucHatasi('KURULUM_SIFRE_EN_AZ_12', 400);
        }
        const adminName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : 'Süper Admin';
        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        // ŞİFREMİ UNUTTUM: hesap varsa SİLİNMEZ, yalnız şifresi yenilenir.
        // Eskiden silinip yeniden açılıyordu: kimliği değişiyor, ekip ya da
        // distribütör hesabı varsayılan rolle (SAHIP) geri doğuyordu ve 2FA
        // kayboluyordu. Artık kimlik, rol, marka ve geçmiş olduğu gibi kalır.
        // 2FA yalnız istenirse (telefon kaybolduysa) kapatılır.
        const existing = await prisma.superAdmin.findUnique({ where: { email: adminEmail }, select: { id: true, totpEnabled: true } });
        if (existing) {
            const ikiAdimSifirlandi = ikiAdimSifirla === true && existing.totpEnabled;
            await prisma.superAdmin.update({
                where: { id: existing.id },
                data: {
                    password: hashedPassword,
                    ...(ikiAdimSifirla === true ? { totpEnabled: false, totpSecret: null, totpLastCounter: null, recoveryCodes: [] } : {}),
                },
            });
            return NextResponse.json({ success: true, durum: 'SIFRE_YENILENDI', id: existing.id, email: adminEmail, loginUrl: '/super-admin/login', ikiAdimSifirlandi });
        }

        const admin = await prisma.superAdmin.create({
            data: { email: adminEmail, password: hashedPassword, name: adminName },
        });
        return NextResponse.json({ success: true, durum: 'HESAP_ACILDI', id: admin.id, email: adminEmail, loginUrl: '/super-admin/login', ikiAdimSifirlandi: false });
    } catch (error: any) {
        console.error('Setup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
