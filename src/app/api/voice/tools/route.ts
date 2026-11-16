import { NextRequest, NextResponse } from 'next/server';
import { aracIstegi } from '@/lib/ses-cekirdek/uc';
import { servisSesUyarlayici } from '@/lib/telefon-ajani-veri';

/**
 * POST /api/voice/tools — telefon ajanının KONUŞMA SIRASINDA çağırdığı uç.
 *
 * Retell "custom function" olarak çağırır; arayan hatta bekler.
 *
 * İş çekirdekte (lib/ses-cekirdek/uc.ts aracIstegi), Servis'e özgü kısım
 * uyarlayıcıda (lib/telefon-ajani-veri.ts servisSesUyarlayici):
 *  · paylaşılan sır başlıkta VE Retell imzası — ikisi de tutmalı (fail-closed),
 *  · kiracı yalnız `call.agent_id`'den, müşteri yalnız `call.from_number`'dan,
 *  · her hata cümleli döner (asistan ortada susmaz).
 * Sorgu dizesinden sır KABUL EDİLMEZ.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const r = await aracIstegi(
    {
      ham: await req.text(),
      baslik: (ad) => req.headers.get(ad),
      sir: process.env.VOICE_TOOL_SECRET,
      anahtar: process.env.RETELL_API_KEY,
    },
    servisSesUyarlayici,
  );
  return NextResponse.json(r.govde, { status: r.durum });
}
