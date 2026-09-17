import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { filoRaporu, PENCERE_AY } from '@/lib/filo-veri';

export const dynamic = 'force-dynamic';

/**
 * GET /api/filo?ay=3 — filo optimizasyonu raporu.
 *
 * Pencere KISA tutuluyor (varsayılan 3 ay): bir yillik ortalama, üç ay önce
 * boşta kalmış makineyi hâlâ çalışıyor gösterir.
 */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const ay = Number(new URL(req.url).searchParams.get('ay')) || PENCERE_AY;
    return NextResponse.json(await filoRaporu(tenantId, ay));
  } catch (e: any) {
    return authErrorResponse(e);
  }
}
