import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { odemeEkle } from '@/lib/baski-is-kayit';

export const dynamic = 'force-dynamic';

/** POST /api/matbaa/isler/:id/odeme { tutar (kuruş), yol } — operatör para almaz. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireMatbaaUser(['ADMIN', 'FRONT_DESK']);
    const { id } = await params;
    const g = (await req.json().catch(() => ({}))) as { tutar?: unknown; yol?: unknown; not?: string };
    const r = await odemeEkle(tenantId, id, { tutar: g.tutar, yol: g.yol, not: g.not }, user);
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.json({ ok: true, odenen: r.odenen });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
