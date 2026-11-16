import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { taslakListesi, taslakSayaci } from '@/lib/telefon-ajani-veri';

/**
 * GET /api/telefon-ajani/taslaklar?durum=BEKLIYOR|HEPSI — ajanın açtığı
 * taslaklar (gelen kutusunun en üstü) + sayaç. Bekleyenlerde ACİL olanlar önce.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const secim = new URL(req.url).searchParams.get('durum') === 'HEPSI' ? 'HEPSI' : 'BEKLIYOR';
    const [taslaklar, sayac] = await Promise.all([taslakListesi(tenantId, secim), taslakSayaci(tenantId)]);
    return NextResponse.json({ taslaklar, sayac });
  } catch (e) {
    return authErrorResponse(e);
  }
}
