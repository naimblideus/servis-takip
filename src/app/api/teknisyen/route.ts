import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { karneOlc } from '@/lib/teknisyen-veri';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teknisyen?ay=YYYY-MM
 *
 * Dönemin teknisyen karnesi: iş bir seferde bitiyor mu, ne kadar sürüyor.
 *
 * Dönem AÇILIŞA göre süzülür. Kapanışa göre süzmek, dönem içinde açılıp hâlâ
 * kapanmamış işleri karneden düşürürdü — yani en uzun sürenleri.
 */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const sp = new URL(req.url).searchParams;

    const ay = sp.get('ay') || '';
    const m = /^(\d{4})-(\d{2})$/.exec(ay);
    const simdi = new Date();
    const yil = m ? Number(m[1]) : simdi.getFullYear();
    const aySira = m ? Number(m[2]) - 1 : simdi.getMonth();
    if (aySira < 0 || aySira > 11) return ucHatasi('GECERSIZ_DONEM', 400);

    const bas = new Date(yil, aySira, 1, 0, 0, 0, 0);
    const son = new Date(yil, aySira + 1, 0, 23, 59, 59, 999);

    return NextResponse.json({
      donem: `${yil}-${String(aySira + 1).padStart(2, '0')}`,
      ...(await karneOlc(tenantId, bas, son, simdi)),
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}
