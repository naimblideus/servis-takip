import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bayiSuzgeci } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { egitimDonemiBitisi, egitimDonemindeMi } from '@/lib/egitim-videolari';

/**
 * GET /api/egitim/durum — sayfalardaki "▶ 1 dk" düğmeleri bu kişiye hâlâ
 * gösterilsin mi (components/EgitimVideosu).
 *
 * Kişinin hesabı açıldıktan sonraki ilk 45 gün evet (lib/egitim-videolari
 * EGITIM_ACIK_GUN); sonra düğmeler yalnız Yardım'da ve ilk giriş adımlarında.
 * Süre KİŞİDEN sayılır, bayiden değil: sonradan gelen teknisyen kendi 45
 * gününü alır, yıllardır kullanan sahibin ekranı dolmaz.
 *
 * `bitis`: dönemin bittiği an (ms). Tarayıcı bunu saklar ve bir daha sormaz;
 * böylece her sayfa açılışında bu uca istek gitmez. Demo bayisinde hep evet
 * (gezen herkes yeni) ve bitis yok: saklanmaz.
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
  if (!user) return NextResponse.json({ ogrenmede: false, bitis: null });
  const demo = Boolean(user.tenant?.demo);
  return NextResponse.json({
    ogrenmede: demo || egitimDonemindeMi(user.createdAt),
    bitis: demo ? null : egitimDonemiBitisi(user.createdAt),
  });
}
