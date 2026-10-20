import { NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { bayininDuyurulari } from '@/lib/distributor-veri';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marka-duyurusu — bayi panelindeki marka duyuruları.
 *
 * Bayi oturumu şart (requireTenantUser): müşteri paneli bu uca ulaşamaz ve
 * çağırmaz. Yalnız bayinin CİHAZI OLAN markaların süresi dolmamış duyuruları,
 * en yeni 3; demo bayide boş liste. Bütün bayi rolleri görür.
 */
export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();
    return NextResponse.json({ duyurular: await bayininDuyurulari(tenantId) });
  } catch (e) {
    return authErrorResponse(e);
  }
}
