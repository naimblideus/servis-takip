/**
 * Super Admin Auth Utilities
 * Normal NextAuth'dan bağımsız — ayrı JWT cookie kullanır
 */
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// FAIL-CLOSED: super-admin imzası tenant JWT'sinden AYRI bir secret ister.
// SUPER_ADMIN_SECRET yoksa/zayıfsa imza + doğrulama çalışmaz → super-admin devre dışı
// (token taklit edilemez; literal/paylaşılan secret fallback'i KALDIRILDI).
function saSecret(): Uint8Array {
    const s = process.env.SUPER_ADMIN_SECRET;
    if (!s || s.length < 16) {
        throw new Error('SUPER_ADMIN_SECRET tanımlı değil veya 16 karakterden kısa — super-admin fail-closed devre dışı.');
    }
    return new TextEncoder().encode(s);
}
const COOKIE_NAME = 'sa_session';
const MAX_AGE = 8 * 60 * 60; // 8 saat

export interface SuperAdminSession {
    id: string;
    email: string;
    name: string;
    isSuperAdmin: true;
}

/**
 * Süper admin girişi — şifreyi doğrula, JWT döndür
 */
export async function loginSuperAdmin(email: string, password: string): Promise<SuperAdminSession | null> {
    const admin = await (prisma as any).superAdmin.findUnique({ where: { email } });
    if (!admin) return null;

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return null;

    // Son giriş tarihini güncelle
    await (prisma as any).superAdmin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
    });

    return { id: admin.id, email: admin.email, name: admin.name, isSuperAdmin: true };
}

/**
 * Session oluştur ve cookie set et
 */
export async function createSuperAdminSession(session: SuperAdminSession): Promise<string> {
    const token = await new SignJWT({ ...session })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${MAX_AGE}s`)
        .sign(saSecret());
    return token;
}

/**
 * Request'ten super admin session oku
 */
export async function getSuperAdminSession(): Promise<SuperAdminSession | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        if (!token) return null;

        const { payload } = await jwtVerify(token, saSecret());
        if (!payload.isSuperAdmin) return null;

        return payload as unknown as SuperAdminSession;
    } catch {
        return null;
    }
}

/**
 * Super admin session sil (logout)
 */
export async function clearSuperAdminSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

export const SA_COOKIE = COOKIE_NAME;
export const SA_MAX_AGE = MAX_AGE;
