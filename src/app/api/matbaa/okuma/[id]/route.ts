import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { okumaAt } from '@/lib/baski-okuyucu-kayit';

export const dynamic = 'force-dynamic';

/** DELETE /api/matbaa/okuma/:id — taslağı at (iş açılmaz; kişisel bilgi silinir, sayım için kayıt kalır). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireMatbaaUser(['ADMIN', 'FRONT_DESK']);
    const { id } = await params;
    const r = await okumaAt(tenantId, id);
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
