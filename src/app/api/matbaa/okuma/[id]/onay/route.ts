import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { okumaOnayla } from '@/lib/baski-okuyucu-kayit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/matbaa/okuma/:id/onay — tezgah formunun gövdesi (+ firma,
 * teslimYerel). Taslak onaylanır, iş açılır (kanal WHATSAPP): { id: işId }.
 * Tutar istemciden alınmaz, fiyat listesinden hesaplanır.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireMatbaaUser(['ADMIN', 'FRONT_DESK']);
    const { id } = await params;
    const govde = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!govde || typeof govde !== 'object' || Array.isArray(govde)) return baskiHatasi('KALEM_YOK');
    const r = await okumaOnayla(tenantId, id, govde, user);
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.json({ ok: true, id: r.isId }, { status: 201 });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
