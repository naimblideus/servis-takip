import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { isKabulEt } from '@/lib/baski-is-kayit';

export const dynamic = 'force-dynamic';

/** POST /api/matbaa/isler/:id/kabul { sayfalar: { kalemId: sayfa } } — tahmini fiyatlı işi personel onaylar. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireMatbaaUser(['ADMIN', 'FRONT_DESK']);
    const { id } = await params;
    const g = (await req.json().catch(() => ({}))) as { sayfalar?: Record<string, unknown> };
    const r = await isKabulEt(tenantId, id, g.sayfalar ?? {}, user);
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.json({ ok: true, toplam: r.toplam });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
