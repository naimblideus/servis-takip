import { NextRequest, NextResponse } from 'next/server';
import { aracCagrisi, cagriBaglami, hataCevabi, SIR_BASLIGI } from '@/lib/telefon-ajani';
import { aracSirriGecerli, retellImzasiGecerli } from '@/lib/telefon-ajani-imza';
import { aracCalistir, aracKiracisi } from '@/lib/telefon-ajani-veri';

/**
 * POST /api/voice/tools — telefon ajanının KONUŞMA SIRASINDA çağırdığı uç.
 *
 * Retell "custom function" olarak çağırır; arayan hatta bekler.
 *
 * GÜVENLİK — iki kilit, İKİSİ de tutmalı (fail-closed):
 *  · paylaşılan sır başlıkta (VOICE_TOOL_SECRET ≥16; tanımsızsa uç kapalı),
 *  · Retell imzası (RETELL_API_KEY ile HMAC; 5 dk'dan eski paket ret).
 *
 * KİRACI GÖVDEDEN SEÇİLMEZ: yalnız `call.agent_id` ile, kurulumda bizim
 * yazdığımız ajan kimliğinden bulunur. Müşteri kimliği yalnız
 * `call.from_number`'dan gelir; modelin doldurduğu argümanlardan asla.
 *
 * Her hata CÜMLELİ döner: boş yanıt, asistanın ortada susması demek.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const ham = await req.text();
  const sirTamam = aracSirriGecerli(req.headers.get(SIR_BASLIGI), process.env.VOICE_TOOL_SECRET);
  const imzaTamam = retellImzasiGecerli(ham, req.headers.get('x-retell-signature'), process.env.RETELL_API_KEY);
  if (!sirTamam || !imzaTamam) return NextResponse.json({ ok: false }, { status: 401 });

  let govde: unknown;
  try {
    govde = JSON.parse(ham);
  } catch {
    return NextResponse.json(hataCevabi());
  }

  const baglam = cagriBaglami(govde);
  if (!baglam) return NextResponse.json(hataCevabi());

  try {
    const kiraci = await aracKiracisi(baglam.agentId);
    if (!kiraci) return NextResponse.json(hataCevabi());
    const { ad, args } = aracCagrisi(govde);
    return NextResponse.json(
      await aracCalistir(
        { tenantId: kiraci.tenantId, callId: baglam.callId, arayanSon10: baglam.arayanSon10, acik: kiraci.acik },
        ad,
        args,
      ),
    );
  } catch (e) {
    console.error('[voice-tools]', (e as Error)?.message);
    return NextResponse.json(hataCevabi());
  }
}
