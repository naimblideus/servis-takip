import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { durumDegistir } from '@/lib/baski-is-kayit';

export const dynamic = 'force-dynamic';

/** POST /api/matbaa/isler/:id/durum { durum, iptalNedeni? } — kural lib/baski-is gecisIzinli (rol dahil). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireMatbaaUser();
    const { id } = await params;
    const g = (await req.json().catch(() => ({}))) as { durum?: unknown; iptalNedeni?: string };
    const r = await durumDegistir(tenantId, id, g.durum, user, { iptalNedeni: g.iptalNedeni });
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.json({ ok: true, durum: r.durum });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
