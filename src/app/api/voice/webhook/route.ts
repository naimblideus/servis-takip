import { NextRequest, NextResponse } from 'next/server';
import { olayIstegi } from '@/lib/ses-cekirdek/uc';
import { servisSesUyarlayici } from '@/lib/telefon-ajani-veri';

/**
 * POST /api/voice/webhook — Retell olayları (iş çekirdekte: lib/ses-cekirdek/uc.ts olayIstegi).
 *
 * 1. `call_inbound` (gelen arama, numaranın `inbound_webhook_url`'i): hangi
 *    ajan konuşacak? Ajan AÇIKSA asıl ajan; kapalıysa, bayi askıdaysa ya da
 *    hat tanınmıyorsa "yalnız aktarma" ajanı. Bu uç düşerse, imza tutmazsa ya
 *    da geç kalırsa Retell numaranın varsayılanını kullanır — o da aktarma
 *    ajanıdır: bot konuşmaz, hat kapanmaz.
 * 2. Çağrı olayları (`call_ended`): yalnız alındı, hiçbir şey saklanmaz. Adres
 *    ajanda AÇIKÇA yazılı ki Retell, hesap düzeyindeki adrese (aynı hesaptaki
 *    başka bir ürün) servis görüşmesi göndermesin.
 *
 * İmza zorunlu (RETELL_API_KEY ile HMAC). Tanımsızsa uç kapalıdır.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  const r = await olayIstegi(
    { ham: await req.text(), baslik: (ad) => req.headers.get(ad), anahtar: process.env.RETELL_API_KEY },
    servisSesUyarlayici,
  );
  return r.govde === null ? new NextResponse(null, { status: r.durum }) : NextResponse.json(r.govde, { status: r.durum });
}
