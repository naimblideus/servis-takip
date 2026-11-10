import { NextResponse } from 'next/server';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { dosyaCagirani } from '@/lib/baski-musteri-uc';
import { yuklemeAc } from '@/lib/baski-dosya-kayit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/b/dosya/baslat — yüklemeyi açar. Gövde: { ad, boyut, sayfaSayisi?, olcu?, uyarilar? }
 * ile birlikte müşteri için { kisaAd, jeton }, personel için { isId, tur? }.
 * Dosyanın kendisi buraya GELMEZ: tarayıcı parçaları R2'ye doğrudan yükler.
 */
export async function POST(req: Request) {
  try {
    const g = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const c = await dosyaCagirani(req, g, { ad: 'dosya-baslat', adet: 40, dakika: 10 });
    if (!c.ok) return c.yanit;
    const r = await yuklemeAc(c.tenantId, c.isId, g, c.kim);
    if (!r.ok) return baskiHatasi(r.kod, c.dil);
    return NextResponse.json({ ok: true, dosyaId: r.dosyaId, parca: r.parca, parcaBoyu: r.parcaBoyu }, { status: 201 });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
