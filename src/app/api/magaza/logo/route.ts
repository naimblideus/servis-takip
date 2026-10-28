import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi, yoneticiMi } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { magazaIstegi, magazaYanitiCevir } from '@/lib/magaza-ayar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * /api/magaza/logo — mağaza logosu, Servis'in "Mağaza ayarları" ekranından.
 * POST (multipart: dosya) yükler, DELETE kaldırır. Mağazanın /api/servis/logo
 * ucuna vekil; dosya kuralları (PNG/JPG, 8 MB) mağazada. Yalnız yönetici,
 * demo yazamaz.
 */
async function yazabilir() {
  const session = await auth();
  if (!session) return { hata: NextResponse.json({ ok: false, kod: 'OTURUM' }, { status: 401 }) };
  const user = await oturumKullanicisi(session);
  if (!user) return { hata: NextResponse.json({ ok: false, kod: 'OTURUM' }, { status: 401 }) };
  if (!yoneticiMi(user)) return { hata: NextResponse.json({ ok: false, kod: 'YETKI' }, { status: 403 }) };
  const t = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { demo: true } });
  if (!t || t.demo) return { hata: NextResponse.json({ ok: false, kod: 'DEMO' }, { status: 403 }) };
  if (!rateLimit(`magaza-logo:${user.tenantId}`, 10, 10 * 60_000).ok)
    return { hata: NextResponse.json({ ok: false, kod: 'SINIR' }, { status: 429 }) };
  return { user };
}

const yanit = (r: { kod: number; govde: Record<string, unknown> }) =>
  NextResponse.json(r.govde, { status: r.kod, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const k = await yazabilir();
  if (k.hata) return k.hata;
  const gelen = await req.formData().catch(() => null);
  const dosya = gelen?.get('dosya');
  if (!(dosya instanceof File)) return NextResponse.json({ ok: false, hata: null, kod: 'DOSYA' }, { status: 400 });
  const form = new FormData();
  form.set('tenantId', k.user.tenantId);
  form.set('dosya', dosya, dosya.name);
  const y = await magazaIstegi('/api/servis/logo', { method: 'POST', form, zamanAsimiMs: 60_000 });
  return yanit(magazaYanitiCevir(y));
}

export async function DELETE() {
  const k = await yazabilir();
  if (k.hata) return k.hata;
  const y = await magazaIstegi(`/api/servis/logo?tenantId=${encodeURIComponent(k.user.tenantId)}`, { method: 'DELETE' });
  return yanit(magazaYanitiCevir(y));
}
