import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bayiSuzgeci } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { egitimDonemindeMi } from '@/lib/egitim-videolari';

/**
 * GET /api/egitim/durum — sayfalardaki "▶ 1 dk" düğmeleri bu kişiye hâlâ
 * gösterilsin mi (components/EgitimVideosu).
 *
 * Kişinin hesabı açıldıktan sonraki ilk 45 gün evet (lib/egitim-videolari
 * EGITIM_ACIK_GUN); sonra düğmeler yalnız Yardım'da ve ilk giriş adımlarında.
 * Süre KİŞİDEN sayılır, bayiden değil: sonradan gelen teknisyen kendi 45
 * gününü alır, yıllardır kullanan sahibin ekranı dolmaz.
 * Demo bayisinde hep evet: orayı gezen herkes yeni.
 */
export async function GET() {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !id) return ucHatasi('OTURUM_BULUNAMADI', 401);

  const user = await prisma.user.findFirst({
    where: { id, ...bayiSuzgeci(session) },
    select: { createdAt: true, tenant: { select: { demo: true } } },
  });
  // Kayıt bulunamazsa düğme çıkmaz.
  const ogrenmede = user ? Boolean(user.tenant?.demo) || egitimDonemindeMi(user.createdAt) : false;
  return NextResponse.json({ ogrenmede });
}
