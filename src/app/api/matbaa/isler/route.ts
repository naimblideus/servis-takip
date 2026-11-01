import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { isOlustur, type YeniIs } from '@/lib/baski-is-kayit';

export const dynamic = 'force-dynamic';

/** POST /api/matbaa/isler — tezgahta yeni iş. Tutar sunucuda fiyat listesinden hesaplanır. */
export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireMatbaaUser(['ADMIN', 'FRONT_DESK']);
    const govde = (await req.json().catch(() => null)) as YeniIs | null;
    if (!govde || typeof govde !== 'object') return baskiHatasi('KALEM_YOK');
    const r = await isOlustur(tenantId, govde, user, { personel: true });
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.json({ ok: true, id: r.is.id, no: r.is.no }, { status: 201 });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
