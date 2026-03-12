import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
    process.env.SUPER_ADMIN_SECRET || process.env.NEXTAUTH_SECRET || 'super-admin-secret-key-change-in-production'
);

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ─── Super Admin Routes ────────────────────────────────────────────────────
    if (pathname.startsWith('/super-admin') && pathname !== '/super-admin/login') {
        const token = request.cookies.get('sa_session')?.value;
        if (!token) {
            return NextResponse.redirect(new URL('/super-admin/login', request.url));
        }
        try {
            const { payload } = await jwtVerify(token, SECRET);
            if (!payload.isSuperAdmin) {
                return NextResponse.redirect(new URL('/super-admin/login', request.url));
            }
        } catch {
            return NextResponse.redirect(new URL('/super-admin/login', request.url));
        }
    }

    // ─── Super-admin API Routes ────────────────────────────────────────────────
    if (pathname.startsWith('/api/super-admin') && !pathname.includes('/api/super-admin/login')) {
        const token = request.cookies.get('sa_session')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        try {
            const { payload } = await jwtVerify(token, SECRET);
            if (!payload.isSuperAdmin) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
        '/super-admin/:path*',
        '/api/super-admin/:path*',
    ],
};
