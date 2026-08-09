/**
 * Super Admin Auth Utilities
 * Normal NextAuth'dan bağımsız — ayrı JWT cookie kullanır
 */
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { verifyTOTP, hashRecoveryCode } from '@/lib/totp';

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

/** Giriş sonucu — 2FA açıksa kod gelene kadar oturum AÇILMAZ. */
export type SaLoginResult =
    | { ok: true; session: SuperAdminSession }
    | { ok: false; reason: 'BAD_CREDENTIALS' | 'TOTP_REQUIRED' | 'BAD_TOTP' };

/**
 * Süper admin girişi.
 *
 * 2FA açıksa kod olmadan oturum açılmaz. Bu hesap TÜM bayilerin verisini
 * gördüğü için normal kullanıcıdaki gibi "isteğe bağlı" bırakılamaz —
 * tek bir şifre sızıntısı bütün kiracıları açardı.
 *
 * Kod yerine tek kullanımlık KURTARMA KODU da kabul edilir ve kullanılan kod
 * listeden silinir; telefon kaybında sistemden tamamen kilitlenmemek için.
 */
export async function loginSuperAdmin(
    email: string,
    password: string,
    totp?: string,
): Promise<SaLoginResult> {
    const admin = await (prisma as any).superAdmin.findUnique({ where: { email } });
    if (!admin) return { ok: false, reason: 'BAD_CREDENTIALS' };

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return { ok: false, reason: 'BAD_CREDENTIALS' };

    if (admin.totpEnabled && admin.totpSecret) {
        const kod = String(totp || '').trim();
        if (!kod) return { ok: false, reason: 'TOTP_REQUIRED' };

        const counter = verifyTOTP(admin.totpSecret, kod, { lastCounter: admin.totpLastCounter });
        if (counter !== null) {
            // Aynı kodun ikinci kez kullanılmasını engelle
            await (prisma as any).superAdmin.update({
                where: { id: admin.id }, data: { totpLastCounter: counter },
            });
        } else {
            // Kurtarma kodu mu? Kullanılan kod listeden ÇIKARILIR.
            const hash = hashRecoveryCode(kod);
            const oncekiler: string[] = admin.recoveryCodes || [];
            const kalan = oncekiler.filter((h) => h !== hash);
            if (kalan.length === oncekiler.length) return { ok: false, reason: 'BAD_TOTP' };
            await (prisma as any).superAdmin.update({
                where: { id: admin.id }, data: { recoveryCodes: kalan },
            });
        }
    }

    await (prisma as any).superAdmin.update({
        where: { id: admin.id }, data: { lastLoginAt: new Date() },
    });

    return {
        ok: true,
        session: { id: admin.id, email: admin.email, name: admin.name, isSuperAdmin: true },
    };
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
