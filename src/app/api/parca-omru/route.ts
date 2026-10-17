import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse, yoneticiMi } from '@/lib/api-auth';
import { parcaOmruVerisi } from '@/lib/parca-omru-veri';

export const dynamic = 'force-dynamic';

/**
 * GET /api/parca-omru            — en acil ILK_SATIR satır + özet + stok ihtiyacı
 * GET /api/parca-omru?tumu=1     — bütün satırlar
 *
 * Teknisyen de görür: sahada "bu makinenin drumu bitiyor, yanına al"
 * bilgisi onun işi. Yanıtta para YOK (adet ve sayfa); "Sipariş et" yalnız
 * yöneticiye çizilir, çünkü tedarikçi siparişi ekranı yöneticiye kilitli.
 * Yalnız okur: demoda kapatılacak yazma yok.
 */
export async function GET(req: NextRequest) {
  try {
    const { user, tenantId } = await requireTenantUser();
    const tumu = req.nextUrl.searchParams.get('tumu') === '1';
    const veri = await parcaOmruVerisi(tenantId, { tumu });
    return NextResponse.json({ ...veri, yonetici: yoneticiMi(user) });
  } catch (e) {
    return authErrorResponse(e);
  }
}
