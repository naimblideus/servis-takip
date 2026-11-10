import { NextResponse } from 'next/server';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { matbaaDili, sinirAsildi } from '@/lib/baski-musteri-uc';
import { kisaAddanMatbaa } from '@/lib/matbaa-ayar-kayit';
import { provaYanitla } from '@/lib/baski-prova';

export const dynamic = 'force-dynamic';

/**
 * POST /api/b/prova { kisaAd, jeton, karar: 'ONAY' | 'DUZELTME', not? }
 * Müşterinin prova yanıtı (oturum yok). Bağlantı süreli ve tek kullanımlık:
 * kural lib/baski-is provaYanitlanir, yazma koşullu (lib/baski-prova).
 */
export async function POST(req: Request) {
  try {
    const g = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const kisaAd = String(g.kisaAd ?? '');
    const dil = matbaaDili((await kisaAddanMatbaa(kisaAd))?.tenant.locale);
    if (sinirAsildi(req, { ad: 'prova', adet: 20, dakika: 10 })) return baskiHatasi('COK_ISTEK', dil);
    const r = await provaYanitla(kisaAd, String(g.jeton ?? ''), g.karar, g.not);
    if (!r.ok) return baskiHatasi(r.kod, dil);
    return NextResponse.json({ ok: true, durum: r.durum });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
