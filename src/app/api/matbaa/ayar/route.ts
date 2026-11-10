import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { ayarKaydet } from '@/lib/matbaa-ayar-kayit';

export const dynamic = 'force-dynamic';

/** PUT /api/matbaa/ayar — sipariş sayfası ayarları. Adres ve açık/kapalı işletme kararıdır: yalnız sahip. */
export async function PUT(req: Request) {
  try {
    const { tenantId } = await requireMatbaaUser(['ADMIN']);
    const g = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const r = await ayarKaydet(tenantId, g);
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.json({ ok: true, kisaAd: r.ayar.kisaAd });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
