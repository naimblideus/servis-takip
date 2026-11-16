import { NextRequest, NextResponse } from 'next/server';
import { retellImzasiGecerli } from '@/lib/telefon-ajani-imza';
import { gelenAramaKarari } from '@/lib/telefon-ajani-veri';

/**
 * POST /api/voice/webhook — Retell olayları.
 *
 * 1. `call_inbound` (gelen arama, numaranın `inbound_webhook_url`'i):
 *    hangi ajan konuşacak? Ajan AÇIKSA asıl ajan; kapalıysa, bayi askıdaysa
 *    ya da hat tanınmıyorsa "yalnız aktarma" ajanı. Bu uç düşerse, imza
 *    tutmazsa ya da yanıt geç kalırsa Retell numaranın varsayılanını kullanır
 *    — o da aktarma ajanıdır: bot konuşmaz, hat kapanmaz.
 *
 * 2. Çağrı olayları (`call_ended`): yalnız alındı. Hiçbir şey saklanmıyor.
 *    Bu adresin ajanda AÇIKÇA yazılı olmasının tek sebebi, Retell'in hesap
 *    düzeyindeki adrese (aynı hesaptaki başka bir ürün) servis görüşmesi
 *    göndermemesi.
 *
 * İmza zorunlu (RETELL_API_KEY ile HMAC). Tanımsızsa uç kapalıdır.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  const ham = await req.text();
  if (!retellImzasiGecerli(ham, req.headers.get('x-retell-signature'), process.env.RETELL_API_KEY)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let govde: { event?: unknown; call_inbound?: { to_number?: unknown } } | null = null;
  try {
    govde = JSON.parse(ham);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  if (govde?.event === 'call_inbound') {
    try {
      return NextResponse.json(await gelenAramaKarari(govde.call_inbound?.to_number));
    } catch (e) {
      // Boş cevap = numaranın varsayılanı (aktarma ajanı). Hemen dön: arayan çalan telefonu dinliyor.
      console.error('[voice-webhook] gelen arama:', (e as Error)?.message);
      return NextResponse.json({ call_inbound: {} });
    }
  }
  return new NextResponse(null, { status: 204 });
}
