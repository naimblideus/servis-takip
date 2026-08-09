import { NextRequest, NextResponse } from 'next/server';
import { nobetciCalistir, alarmGonder } from '@/lib/nobetci';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function yetkili(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL-CLOSED — diğer cron uçlarıyla aynı kural
  const header = req.headers.get('authorization');
  const qp = new URL(req.url).searchParams.get('secret');
  return header === `Bearer ${secret}` || qp === secret;
}

/**
 * GET /api/cron/nobetci — sessiz arıza taraması, sorun varsa alarm.
 *
 * /api/saglik "uygulama ayakta mı"yı söyler; bu uç "işler yürüyor mu"yu.
 * İkisi farklı sorulardır: cron ölmüşken uygulama gayet ayakta görünür.
 *
 * Coolify → Scheduled Tasks, günde bir:  node run-cron.mjs nobetci
 *
 * KRİTİK bulguda HTTP 500 döner — Coolify görevi "başarısız" gösterir, yani
 * ALARM_WEBHOOK_URL hiç kurulmamış olsa bile bir yerde iz kalır.
 */
export async function GET(req: NextRequest) {
  if (!yetkili(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sonuc = await nobetciCalistir();
  const alarm = await alarmGonder(sonuc);

  console.log(`[nobetci] ${sonuc.seviye}: ${sonuc.ozet} (alarm: ${alarm})`);
  for (const k of sonuc.kontroller.filter((x) => x.seviye !== 'iyi')) {
    console.log(`[nobetci]   ${k.seviye}: ${k.ad} — ${k.mesaj}`);
  }

  return NextResponse.json(
    { ...sonuc, alarm },
    { status: sonuc.seviye === 'kritik' ? 500 : 200 },
  );
}
