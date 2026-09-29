import { NextResponse } from 'next/server';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { ekstreIsle, sonIslenenler, type IslemGirdisi } from '@/lib/banka-ekstresi-veri';

// GET — son işlenen banka satırları.
export async function GET() {
  // MALİ VERİ: yalnız yönetici.
  let tenantId: string;
  try { ({ tenantId } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }
  return NextResponse.json({ kayitlar: await sonIslenenler(tenantId) });
}

// POST — bayinin onayladığı satırları tahsilat olarak işler.
// Gövde: { satirlar: [{ hareket, musteriId }] }. Her satır kendi işleminde;
// aynı banka satırı ikinci kez gelirse "ISLENMIS" döner, hiçbir şey yazılmaz.
const MAX_SATIR = 500;

export async function POST(req: Request) {
  let tenantId: string, user: { id: string; name: string | null };
  try { ({ tenantId, user } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }

  let govde: { satirlar?: IslemGirdisi[] };
  try { govde = await req.json(); } catch { return NextResponse.json({ kod: 'GECERSIZ' }, { status: 400 }); }
  const satirlar = Array.isArray(govde?.satirlar) ? govde.satirlar : [];
  if (!satirlar.length) return NextResponse.json({ kod: 'SECIM_YOK' }, { status: 400 });
  if (satirlar.length > MAX_SATIR) return NextResponse.json({ kod: 'COK_SATIR', n: MAX_SATIR }, { status: 400 });

  const sonuclar = await ekstreIsle(tenantId, { id: user.id, name: user.name }, satirlar);
  return NextResponse.json({ sonuclar });
}
