import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi, yoneticiMi } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { magazaIstegi, magazaYanitiCevir } from '@/lib/magaza-ayar';

export const dynamic = 'force-dynamic';

/**
 * /api/magaza/ayarlar — "Mağaza ayarları" ekranı (Servis içinde).
 *
 * Mağazanın /api/servis/ayarlar ucuna vekil. Bayinin servis kimliği
 * oturumdan eklenir; istemci başka bir bayinin kimliğini gönderemez.
 * Yalnız yönetici. DEMO hesap okur ama yazamaz (kurulum ucuyla aynı kural:
 * herkese açık demodan canlı bir mağazanın ayarı değişmesin).
 */
async function kullanici() {
  const session = await auth();
  if (!session) return { hata: NextResponse.json({ ok: false, kod: 'OTURUM' }, { status: 401 }) };
  const user = await oturumKullanicisi(session);
  if (!user) return { hata: NextResponse.json({ ok: false, kod: 'OTURUM' }, { status: 401 }) };
  if (!yoneticiMi(user)) return { hata: NextResponse.json({ ok: false, kod: 'YETKI' }, { status: 403 }) };
  return { user };
}

const yanit = (r: { kod: number; govde: Record<string, unknown> }) =>
  NextResponse.json(r.govde, { status: r.kod, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const k = await kullanici();
  if (k.hata) return k.hata;
  const y = await magazaIstegi(`/api/servis/ayarlar?tenantId=${encodeURIComponent(k.user.tenantId)}`);
  return yanit(magazaYanitiCevir(y));
}

export async function POST(req: Request) {
  const k = await kullanici();
  if (k.hata) return k.hata;

  const t = await prisma.tenant.findUnique({ where: { id: k.user.tenantId }, select: { demo: true } });
  if (!t) return NextResponse.json({ ok: false, kod: 'OTURUM' }, { status: 401 });
  if (t.demo) return NextResponse.json({ ok: false, kod: 'DEMO' }, { status: 403 });

  const sinir = rateLimit(`magaza-ayar:${k.user.tenantId}`, 30, 10 * 60_000);
  if (!sinir.ok) return NextResponse.json({ ok: false, kod: 'SINIR' }, { status: 429 });

  const g = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!g || typeof g !== 'object') return NextResponse.json({ ok: false, kod: 'GECERSIZ' }, { status: 400 });

  // Yalnız bilinen işlemler ve alanlar geçer; kimlik her zaman oturumdan.
  const islem = g.islem;
  let govde: Record<string, unknown>;
  if (islem === 'KAYDET') govde = { islem, veri: g.veri };
  else if (islem === 'KAMPANYA_BASLAT') govde = { islem, tur: g.tur, yuzde: g.yuzde, gun: g.gun };
  else if (islem === 'KAMPANYA_DURDUR') govde = { islem, id: g.id };
  else return NextResponse.json({ ok: false, kod: 'GECERSIZ' }, { status: 400 });

  const y = await magazaIstegi('/api/servis/ayarlar', { method: 'POST', json: { ...govde, tenantId: k.user.tenantId } });
  return yanit(magazaYanitiCevir(y));
}
