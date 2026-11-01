import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { matbaaYaniti } from '@/lib/matbaa-uc';
import { sablonlariKur } from '@/lib/baski-urun';

export const dynamic = 'force-dynamic';

/** POST /api/matbaa/urunler/sablon — eksik hazır ürünleri (fiyatsız) ekler; olanlara dokunmaz. */
export async function POST() {
  try {
    const { tenantId } = await requireMatbaaUser(['ADMIN']);
    return NextResponse.json({ ok: true, eklenen: await sablonlariKur(tenantId) });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
