import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { markaSec } from '@/lib/distributor';
import { distributorOzeti } from '@/lib/distributor-veri';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super-admin/distributor — distribütör panelinin özeti.
 *
 * Marka OTURUMDAN gelir: distribütörde `session.marka`, istekteki ?marka=
 * YOK SAYILIR (lib/distributor markaSec). Sahip ?marka= ile seçer; ekip 403.
 * Bütün sayılar k-anonim (en az 3 bayi); bayi adı yalnız ad izni olanlarda.
 * Hatalar kod döner ({ hata: 'KOD' }); cümleyi ekran kurar.
 */
export async function GET(req: NextRequest) {
  const session = await getSuperAdminSession();
  const secim = markaSec(session && { rol: session.rol, marka: session.marka }, new URL(req.url).searchParams.get('marka'));
  if (!secim.ok) return NextResponse.json({ hata: secim.hata }, { status: secim.durum });
  try {
    return NextResponse.json(await distributorOzeti(secim.marka));
  } catch (e) {
    console.error('DISTRIBUTOR OZETI:', (e as Error)?.message);
    return NextResponse.json({ hata: 'GENEL' }, { status: 500 });
  }
}
