import { NextResponse } from 'next/server';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { dosyaCagirani } from '@/lib/baski-musteri-uc';
import { yuklemeKapat, yuklemeVazgec } from '@/lib/baski-dosya-kayit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/b/dosya/bitir { dosyaId, vazgec? } — yüklemeyi kapatır. Parçaları
 * sunucu R2'den kendisi sayar; eksikse dosya "yüklendi" olmaz. `vazgec`
 * yarım yüklemeyi atar.
 */
export async function POST(req: Request) {
  try {
    const g = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const c = await dosyaCagirani(req, g, { ad: 'dosya-bitir', adet: 80, dakika: 10 });
    if (!c.ok) return c.yanit;
    const dosyaId = String(g.dosyaId ?? '');
    if (g.vazgec === true) {
      await yuklemeVazgec(c.tenantId, c.isId, dosyaId);
      return NextResponse.json({ ok: true });
    }
    const r = await yuklemeKapat(c.tenantId, c.isId, dosyaId);
    if (!r.ok) return baskiHatasi(r.kod, c.dil);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
