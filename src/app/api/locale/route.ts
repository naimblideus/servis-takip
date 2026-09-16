import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dilMi, DIL_CEREZI } from '@/lib/i18n/sozluk';

export const dynamic = 'force-dynamic';

/**
 * POST /api/locale — dil tercihini kaydet.
 *
 * İki yere yazar: ÇEREZ (anında; sunucu bileşenleri bir sonraki render'da
 * okur) ve oturum varsa KULLANICI kaydı (kalıcı; başka cihazdan girince de
 * aynı dil açılsın). Çerez yazımı asla kullanıcı kaydına bağlı değil —
 * veritabanı yazımı başarısız olsa bile ekran dili değişir.
 *
 * Oturumsuz da çalışır: giriş sayfasında dil seçilebilmeli.
 */
export async function POST(req: NextRequest) {
  const govde = await req.json().catch(() => null);
  const dil = govde?.dil;
  if (!dilMi(dil)) {
    return NextResponse.json({ error: 'Geçersiz dil' }, { status: 400 });
  }

  const cerezler = await cookies();
  cerezler.set(DIL_CEREZI, dil, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false, // istemci de okuyabilsin (ör. tarih biçimi önizlemesi)
  });

  const oturum = await auth().catch(() => null);
  const kullaniciId = (oturum?.user as any)?.id as string | undefined;
  if (kullaniciId) {
    // Kalıcı tercih; başarısızlığı yutuyoruz — çerez zaten yazıldı.
    await prisma.user.update({ where: { id: kullaniciId }, data: { locale: dil } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, dil });
}
