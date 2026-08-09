import { NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { nobetciCalistir } from '@/lib/nobetci';

export const dynamic = 'force-dynamic';

// GET /api/super-admin/nobetci — panelde canlı sistem durumu.
// Cron ucuyla aynı kontroller; burada alarm GÖNDERİLMEZ, sadece gösterilir.
export async function GET() {
  const sa = await getSuperAdminSession();
  if (!sa) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await nobetciCalistir());
}
