import { NextResponse } from 'next/server';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { ayarDurumu, faturaListesi, topluGonder } from '@/lib/bizimhesap-veri';

// GET ?donem=YYYY-MM — bağlantı durumu + dönemin faturaları ve Bizim Hesap durumları.
export async function GET(req: Request) {
  // MALİ VERİ: yalnız yönetici.
  let tenantId: string;
  try { ({ tenantId } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }
  const q = new URL(req.url).searchParams.get('donem') ?? '';
  const simdi = new Date();
  const donem = /^\d{4}-\d{2}$/.test(q) ? q : `${simdi.getFullYear()}-${String(simdi.getMonth() + 1).padStart(2, '0')}`;
  const [ayar, liste] = await Promise.all([ayarDurumu(tenantId), faturaListesi(tenantId, donem)]);
  return NextResponse.json({ ayar, donem, ...liste });
}

// POST { ids } — seçilen faturaları Bizim Hesap'a gönderir. Her fatura bir kez gider.
const MAX = 200;
export async function POST(req: Request) {
  let tenantId: string;
  try { ({ tenantId } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }
  let govde: { ids?: unknown };
  try { govde = await req.json(); } catch { return NextResponse.json({ kod: 'GECERSIZ' }, { status: 400 }); }
  const ids = Array.isArray(govde?.ids) ? govde.ids.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 64) : [];
  if (!ids.length) return NextResponse.json({ kod: 'SECIM_YOK' }, { status: 400 });
  if (ids.length > MAX) return NextResponse.json({ kod: 'COK_FATURA', n: MAX }, { status: 400 });
  return NextResponse.json({ sonuclar: await topluGonder(tenantId, [...new Set(ids)]) });
}
