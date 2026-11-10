import { NextResponse } from 'next/server';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { dosyaCagirani } from '@/lib/baski-musteri-uc';
import { parcaAdresiVer } from '@/lib/baski-dosya-kayit';

export const dynamic = 'force-dynamic';

/** POST /api/b/dosya/parca { dosyaId, no } — bir parçanın yükleneceği imzalı adres. */
export async function POST(req: Request) {
  try {
    const g = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    // 20 dosya × 38 parça + yeniden denemeler.
    const c = await dosyaCagirani(req, g, { ad: 'dosya-parca', adet: 1500, dakika: 60 });
    if (!c.ok) return c.yanit;
    const r = await parcaAdresiVer(c.tenantId, c.isId, String(g.dosyaId ?? ''), g.no);
    if (!r.ok) return baskiHatasi(r.kod, c.dil);
    return NextResponse.json({ ok: true, url: r.url });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
