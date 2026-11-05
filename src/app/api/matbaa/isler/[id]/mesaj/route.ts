import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { mesajKaydet } from '@/lib/baski-is-kayit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/matbaa/isler/:id/mesaj { tur } — WhatsApp düğmesine dokunuldu.
 * Mesajı göndermez (matbaanın kendi WhatsApp'ı gönderir), yalnız kaydeder.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireMatbaaUser(['ADMIN', 'FRONT_DESK']);
    const { id } = await params;
    const g = (await req.json().catch(() => ({}))) as { tur?: unknown };
    const r = await mesajKaydet(tenantId, id, g.tur, user);
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
