import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { markaSec, duyuruGirdisi } from '@/lib/distributor';
import { duyuruListesi, duyuruEkle, duyuruSil } from '@/lib/distributor-veri';

export const dynamic = 'force-dynamic';

/**
 * /api/super-admin/distributor/duyuru — markanın bayilere duyurusu.
 *   GET    liste (süresi dolanlar dahil)
 *   POST   { baslik ≤80, metin ≤600, baglanti? (yalnız https), bitis? 'YYYY-AA-GG' }
 *   DELETE ?id=
 *
 * Marka OTURUMDAN: distribütörde `session.marka`, istekteki marka YOK
 * SAYILIR; yalnız kendi markasının duyurusunu yazar ve siler. Sahip
 * ?marka= ile seçer; ekip 403. Kurum adı da oturumdan (ör. Pantum Türkiye).
 */
async function secim(req: NextRequest) {
  const session = await getSuperAdminSession();
  const s = markaSec(session && { rol: session.rol, marka: session.marka }, new URL(req.url).searchParams.get('marka'));
  return { session, s };
}

export async function GET(req: NextRequest) {
  const { s } = await secim(req);
  if (!s.ok) return NextResponse.json({ hata: s.hata }, { status: s.durum });
  return NextResponse.json({ marka: s.marka, duyurular: await duyuruListesi(s.marka) });
}

export async function POST(req: NextRequest) {
  const { session, s } = await secim(req);
  if (!s.ok || !session) return NextResponse.json({ hata: s.ok ? 'OTURUM_YOK' : s.hata }, { status: s.ok ? 401 : s.durum });
  const g = duyuruGirdisi(await req.json().catch(() => null));
  if ('hata' in g) return NextResponse.json({ hata: g.hata }, { status: 400 });
  const kurumAd = session.rol === 'DISTRIBUTOR' ? (session.kurumAd || s.marka) : s.marka;
  const r = await duyuruEkle(s.marka, kurumAd, session.id, g);
  if (!r.ok) return NextResponse.json({ hata: r.hata }, { status: 409 });
  return NextResponse.json({ ok: true, id: r.id }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { s } = await secim(req);
  if (!s.ok) return NextResponse.json({ hata: s.hata }, { status: s.durum });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id || id.length > 64) return NextResponse.json({ hata: 'GECERSIZ' }, { status: 400 });
  if (!(await duyuruSil(s.marka, id))) return NextResponse.json({ hata: 'YOK' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
