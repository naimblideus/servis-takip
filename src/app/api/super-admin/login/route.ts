import { NextRequest, NextResponse } from 'next/server';
import { loginSuperAdmin, createSuperAdminSession, SA_COOKIE, SA_MAX_AGE } from '@/lib/super-admin-auth';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

// POST — giriş yap
export async function POST(req: NextRequest) {
    try {
        // Brute-force koruması: IP başına dakikada 8 deneme
        const rl = rateLimit(`sa-login:${clientIp(req)}`, 8, 60_000);
        if (!rl.ok) return NextResponse.json(tooMany(rl.retryAfter), { status: 429 });

        const { email, password, totp } = await req.json();
        if (!email || !password) {
            return NextResponse.json({ error: 'E-posta ve şifre gerekli' }, { status: 400 });
        }

        const r = await loginSuperAdmin(email, password, totp);
        if (!r.ok) {
            // needsTotp YALNIZCA şifre doğruyken döner — giriş ekranı kod alanını
            // bu sinyalle açar. Şifre yanlışsa bu bilgi verilmez (hesap varlığı sızmasın).
            if (r.reason === 'TOTP_REQUIRED') {
                return NextResponse.json({ needsTotp: true }, { status: 401 });
            }
            if (r.reason === 'BAD_TOTP') {
                return NextResponse.json(
                    { needsTotp: true, error: 'Doğrulama kodu hatalı veya süresi geçti' },
                    { status: 401 },
                );
            }
            return NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 });
        }

        const session = r.session;
        const token = await createSuperAdminSession(session);
        const res = NextResponse.json({ success: true, name: session.name });
        res.cookies.set(SA_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SA_MAX_AGE,
            path: '/',
        });
        return res;
    } catch (error: any) {
        console.error('SA login error:', error);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}

// DELETE — çıkış yap
export async function DELETE() {
    const res = NextResponse.json({ success: true });
    res.cookies.delete(SA_COOKIE);
    return res;
}
