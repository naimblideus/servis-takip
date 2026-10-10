import { NextRequest, NextResponse } from 'next/server';
import { tekSeferlik } from '@/lib/zamanlanmis-is';
import { ozetiGonder } from '@/lib/sahip-ozet';

export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL-CLOSED — diğer cron uçlarıyla aynı kural
  const header = req.headers.get('authorization');
  const qp = new URL(req.url).searchParams.get('secret');
  return header === `Bearer ${secret}` || qp === secret;
}

/**
 * GET /api/cron/sahip-ozet — platform sahibine sabah özeti (lib/sahip-ozet.ts).
 * Zamanlayıcı her sabah 08:30'da çağırır; gün başına bir kez.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return tekSeferlik(req, 'sahip-ozet', 'gunluk', async () => NextResponse.json({ ok: true, ...(await ozetiGonder()) }));
}
