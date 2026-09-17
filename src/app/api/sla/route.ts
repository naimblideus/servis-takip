import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { slaOlc } from '@/lib/sla-veri';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sla?ay=YYYY-MM[&musteri=<id>]
 *
 * Sözleşmedeki müdahale/çözüm sözünün o ay TUTULUP tutulmadığı.
 *
 * Dönem AÇILIŞA göre süzülür, kapanışa göre değil: SLA sözü "bildirimden
 * itibaren" işler ve kapanışa göre süzmek, ay sonunda hâlâ açık duran
 * gecikmiş fişi rapordan düşürürdü — yani raporun en önemli satırını gizlerdi.
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

    const sonuc = await slaOlc(tenantId, bas, son, simdi);

    const musteriId = sp.get('musteri');
    const fisler = musteriId ? sonuc.fisler.filter((f) => f.musteriId === musteriId) : sonuc.fisler;

    return NextResponse.json({
      donem: `${yil}-${String(aySira + 1).padStart(2, '0')}`,
      ...sonuc,
      // Fiş listesi süzülmüş olabilir; özetler HER ZAMAN bayinin tamamıdır.
      fisler,
    });
  } catch (e: any) {
    return authErrorResponse(e);
  }
}
