import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getToken } from 'next-auth/jwt';
import { demoYazmaYasak, DEMO_YAZMA_MESAJI } from '@/lib/demo-yazma';
import { saRol, rolErisebilir, EKIP_ANA_SAYFA } from '@/lib/super-admin-rol';

// Fail-closed: gömülü fallback YOK. Secret tanımlı değilse süper-admin erişimi tümden reddedilir.
const RAW_SECRET = process.env.SUPER_ADMIN_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '';
const SECRET = RAW_SECRET ? new TextEncoder().encode(RAW_SECRET) : null;

/**
 * Ana sayfada oturum çerezi var mı — SADECE yönlendirme için.
 *
 * Jeton BURADA DOĞRULANMAZ ve gerekmiyor: burada güvenlik kararı verilmiyor,
 * yalnız "panele mi gitsin landing'e mi" konfor kararı veriliyor. Çerez
 * sahteyse panel zaten girişe geri atar. Doğrulamayı buraya koymak ana sayfayı
 * yine her istekte iş yapan bir yola çevirirdi.
 */
function oturumCerezi(request: NextRequest): boolean {
    return Boolean(
        request.cookies.get('authjs.session-token')?.value ||
        request.cookies.get('__Secure-authjs.session-token')?.value ||
        request.cookies.get('next-auth.session-token')?.value ||
        request.cookies.get('__Secure-next-auth.session-token')?.value,
    );
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ─── Herkese açık demo: silme ve ayar istekleri kapalı ────────────────────
    // Kural ve gerekçe lib/demo-yazma.ts'te. Oturum jetonu yalnız kural bir
    // isteği kapsıyorsa açılır; okuma (GET) istekleri buraya hiç uğramaz.
    if (demoYazmaYasak(request.method, pathname)) {
        const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
        const jeton = secret
            ? await getToken({ req: request, secret, secureCookie: process.env.NODE_ENV === 'production' }).catch(() => null)
            : null;
        if (jeton?.demo) {
            const dil = request.cookies.get('dil')?.value === 'en' ? 'en' : 'tr';
            return NextResponse.json({ error: DEMO_YAZMA_MESAJI[dil], kod: 'DEMO_KAPALI' }, { status: 403 });
        }
        return NextResponse.next();
    }

    // ─── Ana sayfa: girişliyse panele ─────────────────────────────────────────
    // Bu kontrol eskiden page.tsx içinde auth() ile yapılıyordu. Çerez okumak
    // sayfayı DİNAMİK yapıyor ve 555 KB'lık landing her ziyarette sunucuda
    // yeniden üretiliyordu (Cache-Control: no-store). Buraya taşınınca sayfa
    // statik kaldı; middleware yalnız çereze bakıyor, render etmiyor.
    // /en aynı sayfanın İngilizcesi; girişli ziyaretçi için davranışı da aynı.
    if (pathname === '/' || pathname === '/en') {
        if (oturumCerezi(request)) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.next();
    }

    // ─── Super Admin Routes ────────────────────────────────────────────────────
    if (pathname.startsWith('/super-admin') && pathname !== '/super-admin/login') {
        const token = request.cookies.get('sa_session')?.value;
        if (!token || !SECRET) {
            return NextResponse.redirect(new URL('/super-admin/login', request.url));
        }
        try {
            const { payload } = await jwtVerify(token, SECRET);
            if (!payload.isSuperAdmin) {
                return NextResponse.redirect(new URL('/super-admin/login', request.url));
            }
            // Ekip hesabı yalnız izin listesindeki ekranları açar (lib/super-admin-rol).
            if (!rolErisebilir(saRol(payload.rol), pathname)) {
                return NextResponse.redirect(new URL(EKIP_ANA_SAYFA, request.url));
            }
        } catch {
            return NextResponse.redirect(new URL('/super-admin/login', request.url));
        }
    }

    // ─── Super-admin API Routes ────────────────────────────────────────────────
    if (pathname.startsWith('/api/super-admin') && !pathname.includes('/api/super-admin/login')) {
        const token = request.cookies.get('sa_session')?.value;
        if (!token || !SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        try {
            const { payload } = await jwtVerify(token, SECRET);
            if (!payload.isSuperAdmin) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            if (!rolErisebilir(saRol(payload.rol), pathname)) {
                return NextResponse.json({ error: 'Forbidden', kod: 'EKIP_ERISEMEZ' }, { status: 403 });
            }
        } catch {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }
    }

    // ─── Maintenance Mode (gelecek genişleme için placeholder) ────────────────
    // Bakım modu kontrolü platform settings'den okununca aktif edilecek
    // const settings = await getPlatformSettings();
    // if (settings?.maintenanceMode && !pathname.startsWith('/super-admin')) {
    //     return NextResponse.rewrite(new URL('/maintenance', request.url));
    // }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/',
        '/en',
        '/super-admin/:path*',
        '/api/super-admin/:path*',
        // Demo koruması (yukarıda) yalnız yazma isteklerinde jeton açar.
        '/api/:path*',
    ],
};
