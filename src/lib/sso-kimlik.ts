/**
 * SSO KİMLİĞİ — Google / Microsoft girişinin hangi kullanıcıya bağlanacağı.
 *
 * İki kapı var ve ikisi de geçilmeden oturum açılmaz:
 *
 *   1) E-POSTA DOĞRULANMIŞ OLMALI. Sağlayıcının verdiği her e-posta kanıt
 *      değildir. Microsoft Entra'da `email` alanını kullanıcının dizininin
 *      yöneticisi DİLEDİĞİ gibi yazar; çok kiracılı (organizations) girişte
 *      herkes ücretsiz bir dizin açıp kullanıcısına bayinin yöneticisinin
 *      e-postasını yazabilir ("nOAuth"). Bu yüzden:
 *        · Google: `email_verified` true olmalı.
 *        · Entra, tek dizine kilitli: e-postayı o firmanın kendi yöneticisi
 *          yönetir — güvenilir.
 *        · Entra, kilitsiz: `xms_edov` (e-posta alan adı sahibi doğrulandı)
 *          true olmalı ya da doğrulanmış birincil e-posta gelmeli. Yoksa RET.
 *
 *   2) EŞLEŞME BİREBİR OLMALI. Prisma'nın `mode: 'insensitive'` eşitliği
 *      PostgreSQL'de kaçışsız ILIKE olur: `_` tek karakter, `%` her şey
 *      jokeridir — "admin@dem_.com" gerçek "admin@demo.com"u buluyordu.
 *      Burada ham SQL ile `lower(email) = lower($1)` kullanılır; tek aktif
 *      eşleşme yoksa giriş reddedilir (belirsizlik tahminle çözülmez).
 */
import { prisma } from '@/lib/prisma';

/** Microsoft girişinin issuer'ı: varsayılan yalnız iş/okul hesapları (kişisel Microsoft hesabı yok). */
export const ENTRA_ISSUER = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
  || 'https://login.microsoftonline.com/organizations/v2.0';

const DIZIN_KIMLIGI = /^https:\/\/login\.microsoftonline\.com\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/v2\.0\/?$/i;

/** Issuer tek bir firmanın dizinine mi kilitli (dizin kimliği GUID)? */
export function tekDizineKilitli(issuer: string): boolean {
  return DIZIN_KIMLIGI.test(issuer.trim());
}

const EPOSTA_BICIMI = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

/** Biçimi doğru e-posta → küçük harf; değilse null. */
export function epostaNormal(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const e = x.trim().toLowerCase();
  if (e.length > 254 || !EPOSTA_BICIMI.test(e)) return null;
  return e;
}

const dogru = (v: unknown) => v === true || v === 'true' || v === 1;

export type SsoRetSebebi = 'eposta-yok' | 'eposta-dogrulanmamis';

/**
 * Sağlayıcı profilinden GÜVENİLİR e-posta. Profil, kimlik belirtecinin ham
 * talepleridir (next-auth signIn/jwt geri çağrısındaki `profile`).
 */
export function ssoEpostasi(
  saglayici: string,
  profil: Record<string, unknown> | null | undefined,
  entraIssuer: string = ENTRA_ISSUER,
): { eposta: string | null; sebep: SsoRetSebebi | null } {
  const p = profil ?? {};
  if (saglayici === 'google') {
    const e = epostaNormal(p.email);
    if (!e) return { eposta: null, sebep: 'eposta-yok' };
    return dogru(p.email_verified) ? { eposta: e, sebep: null } : { eposta: null, sebep: 'eposta-dogrulanmamis' };
  }
  if (saglayici === 'microsoft-entra-id') {
    // Doğrulanmış birincil e-posta (isteğe bağlı talep) varsa o esastır.
    const birincil = Array.isArray(p.verified_primary_email) ? p.verified_primary_email[0] : p.verified_primary_email;
    const dogrulanmis = epostaNormal(birincil);
    if (dogrulanmis) return { eposta: dogrulanmis, sebep: null };
    const e = epostaNormal(p.email);
    if (!e) return { eposta: null, sebep: 'eposta-yok' };
    if (tekDizineKilitli(entraIssuer) || dogru(p.xms_edov)) return { eposta: e, sebep: null };
    return { eposta: null, sebep: 'eposta-dogrulanmamis' };
  }
  // Tanımadığımız sağlayıcıya güvenmeyiz.
  return { eposta: null, sebep: 'eposta-dogrulanmamis' };
}

/**
 * Doğrulanmış e-postayı tanımlı kullanıcıya bağlar. Joker yok: birebir,
 * büyük-küçük harf duyarsız eşitlik. Kullanıcı ve bayi aktif, bayi
 * silinmemiş olmalı. Tek eşleşme yoksa giriş REDDEDİLİR.
 */
export async function ssoKullaniciBul(eposta: string) {
  const e = epostaNormal(eposta);
  if (!e) return { user: null, sebep: 'tanimsiz' as const };
  const satirlar = await prisma.$queryRaw<{ id: string }[]>`
    SELECT u."id" FROM "User" u
    JOIN "Tenant" t ON t."id" = u."tenantId"
    WHERE lower(u."email") = lower(${e})
      AND u."isActive" = true
      AND t."isActive" = true
      AND t."deletedAt" IS NULL
    LIMIT 2`;
  if (satirlar.length !== 1) return { user: null, sebep: satirlar.length === 0 ? 'tanimsiz' as const : 'coklu' as const };
  const user = await prisma.user.findUnique({
    where: { id: satirlar[0].id },
    include: { tenant: { select: { name: true, isActive: true, deletedAt: true } } },
  });
  return user ? { user, sebep: null } : { user: null, sebep: 'tanimsiz' as const };
}
