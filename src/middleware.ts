export { auth as middleware } from '@/lib/auth';

export const config = {
    matcher: [
        /*
         * Tüm route'ları koru, aşağıdakiler hariç:
         * - api/auth (NextAuth endpoints)
         * - _next/static, _next/image (Next.js static dosyaları)
         * - favicon.ico
         * - login sayfası
         */
        '/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)',
    ],
};
