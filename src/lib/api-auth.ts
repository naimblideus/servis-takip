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

/** Oturumdaki kullanıcıyı ve tenantId'sini döndürür; yoksa AuthError fırlatır (fail-closed). */
export async function requireTenantUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new AuthError(401, 'Unauthorized');
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) throw new AuthError(404, 'User not found');
  return { user, tenantId: user.tenantId, session };
}

/** AuthError'ı standart JSON yanıta çevirir; değilse 500. Rota catch'inde kullan. */
export function authErrorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('API ERROR:', (e as any)?.message);
  return NextResponse.json({ error: (e as any)?.message || 'Sunucu hatası' }, { status: 500 });
}
