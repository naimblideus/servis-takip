// Ortak tenant-kullanıcı çözümleme + yetki helper'ı.
// Her API rotası bunu kullanarak {user, tenantId} alır; copy-paste auth kaymasını ve
// tenant-filtresiz (IDOR'a açık) sorguları önlemeye yardımcı olur.
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

/**
 * Oturumdaki kullanıcıyı ve tenantId'sini döndürür; yoksa AuthError fırlatır
 * (fail-closed).
 *
 * ── NEDEN OTURUMDAKİ tenantId İLE ARANIYOR ───────────────────────────────
 * E-posta bayi bazında benzersiz (@@unique([tenantId, email])), GLOBAL DEĞİL.
 * Yani aynı e-posta iki bayide olabilir ve olur da — canlı veride görüldü.
 * Yalnız e-postayla findFirst yapmak, kullanıcıyı YANLIŞ BAYİYE bağlayabilir;
 * o noktadan sonra bütün tenant-kapsamlı sorgular başka bir bayinin verisinde
 * çalışır. Oturum jetonu tenantId taşıyor (auth.ts jwt/session callback'leri),
 * doğru kaynak odur.
 *
 * Oturumda tenantId varsa ve o bayide böyle bir kullanıcı YOKSA fail-closed
 * davranıyoruz: e-postayla ikinci bir arama YAPILMIYOR, çünkü o arama tam da
 * kaçınmaya çalıştığımız yanlış eşleşmeyi geri getirir.
 */
export async function requireTenantUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new AuthError(401, 'Unauthorized');

  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  const user = await prisma.user.findFirst({
    where: tenantId ? { email, tenantId } : { email },
  });
  if (!user) throw new AuthError(404, 'User not found');
  return { user, tenantId: user.tenantId, session };
}

/**
 * Sayfa/rota içinde elle `prisma.user.findFirst({ where: { email } })` yazmak
 * yerine bunu kullan — aynı yanlış-bayi tuzağına düşmez.
 * (Depoda hâlâ ~99 yerde eski desen var; yenileri bunu kullanmalı.)
 */
export async function oturumKullanicisi(session: { user?: { email?: string | null } | null } | null) {
  const email = session?.user?.email;
  if (!email) return null;
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  return prisma.user.findFirst({ where: tenantId ? { email, tenantId } : { email } });
}

/** AuthError'ı standart JSON yanıta çevirir; değilse 500. Rota catch'inde kullan. */
export function authErrorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('API ERROR:', (e as any)?.message);
  return NextResponse.json({ error: (e as any)?.message || 'Sunucu hatası' }, { status: 500 });
}

/**
 * Yalnız YÖNETİCİ erişebilir. Mali ekranların uçlarında kullanılır.
 *
 * ── NEDEN GEREKLİ ────────────────────────────────────────────────────────
 * Kenar menüde bu sayfalar ADMIN'e kilitliydi ama besleyen API'ler rolü
 * ZORLAMIYORDU: teknisyen adresi elle yazıp bayinin tüm mali verisini
 * (cari, fatura, tahsilat, kaçan gelir) okuyabiliyordu. Menüde gizlemek
 * yetkilendirme değildir, yalnız görsel bir perdedir.
 *
 * ── SAHA AKIŞI BOZULMUYOR ────────────────────────────────────────────────
 * Teknisyenin sahadaki gerçek ihtiyacı "işini bitirdiği fişten tahsilat
 * almak"tır ve o AYRI bir uçtan geçer: /api/tickets/[id]/payments — hem
 * bayiye hem fişe kapsamlı. Burada kilitlenen şey, bütün müşterilerin borç
 * listesini gezmek; o saha işi değil, ofis işidir.
 */
export async function requireAdminUser() {
  const { user, tenantId, session } = await requireTenantUser();
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    throw new AuthError(403, 'Bu ekran için yönetici yetkisi gerekir.');
  }
  return { user, tenantId, session };
}
