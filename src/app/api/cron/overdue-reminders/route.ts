import { NextRequest, NextResponse } from 'next/server';
import { vadeHatirlatmalari } from '@/lib/vade-hatirlatma';
import { tekSeferlik } from '@/lib/zamanlanmis-is';

export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL-CLOSED: CRON_SECRET yoksa erişimi REDDET (asla open)
  const header = req.headers.get('authorization');
  const qp = new URL(req.url).searchParams.get('secret');
  return header === `Bearer ${secret}` || qp === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return tekSeferlik(req, 'hatirlatma', 'gunluk', async () => NextResponse.json({ ok: true, ...(await vadeHatirlatmalari()) }));
}
