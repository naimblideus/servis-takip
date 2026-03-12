import { NextRequest, NextResponse } from 'next/server';
import { loginSuperAdmin, createSuperAdminSession, SA_COOKIE, SA_MAX_AGE } from '@/lib/super-admin-auth';

// POST — giriş yap
export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();
        if (!email || !password) {
            return NextResponse.json({ error: 'E-posta ve şifre gerekli' }, { status: 400 });
        }

        const session = await loginSuperAdmin(email, password);
        if (!session) {
            return NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 });
        }

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
