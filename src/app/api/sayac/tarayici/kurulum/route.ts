import { NextResponse } from 'next/server';
import { requireTenantUser, requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { writeAudit, istekIp } from '@/lib/audit';
import { ucHatasi } from '@/lib/uc-hata';
import { demoBayiMi } from '@/lib/demo-koruma';
import { hedefAyikla, toplulukAyikla } from '@/lib/sayac-tarama';
import { kurulumOlustur, kurulumDurumu, kurulumKapat } from '@/lib/sayac-tarama-veri';

export const dynamic = 'force-dynamic';

/**
 * POST { hedef?, topluluk? } — müşteri ofisi için kurulum kodu.
 *
 * Teknisyen de üretebilir (kurulumu sahada o yapıyor). Kod kendi başına
 * veri açmaz: kullanılınca bu bayiye tarama gönderen bir anahtar olur;
 * sayaçlar yine bayinin onay kuralından geçer.
 */
export async function POST(req: Request) {
  try {
    const { tenantId, user } = await requireTenantUser();
    if (await demoBayiMi(tenantId)) return ucHatasi('DEMO_TARAYICI_KAPALI', 403);
    const b = await req.json().catch(() => ({}));
    const h = hedefAyikla(b?.hedef);
    if ('hata' in h) return ucHatasi(h.hata === 'HEDEF_COK' ? 'KURULUM_HEDEF_COK' : 'KURULUM_HEDEF_GECERSIZ', 400);
    const tp = toplulukAyikla(b?.topluluk);
    if ('hata' in tp) return ucHatasi('KURULUM_TOPLULUK_GECERSIZ', 400);
    const k = await kurulumOlustur(tenantId, { hedef: h.hedef, topluluk: tp.topluluk, userId: user.id });
    await writeAudit({
      tenantId, userId: user.id, action: 'TARAYICI_KURULUM_KODU',
      entityType: 'TarayiciKurulumu', entityId: k.id, ipAddress: istekIp(req),
    });
    return NextResponse.json(k);
  } catch (e) {
    return authErrorResponse(e);
  }
}

/** GET ?id= — kurulum ekranı bunu birkaç saniyede bir sorar (canlı geri bildirim). */
export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantUser();
    const id = new URL(req.url).searchParams.get('id');
    const d = id ? await kurulumDurumu(tenantId, id) : null;
    if (!d) return ucHatasi('KURULUM_BULUNAMADI', 404);
    return NextResponse.json(d);
  } catch (e) {
    return authErrorResponse(e);
  }
}

/** DELETE ?id= — tek kurulumu kapatır (bilgisayar değişti, kayboldu). Yalnız yönetici. */
export async function DELETE(req: Request) {
  try {
    const { tenantId, user } = await requireAdminUser();
    const id = new URL(req.url).searchParams.get('id');
    if (!id || !(await kurulumKapat(tenantId, id))) return ucHatasi('KURULUM_BULUNAMADI', 404);
    await writeAudit({
      tenantId, userId: user.id, action: 'TARAYICI_KURULUM_KAPATILDI',
      entityType: 'TarayiciKurulumu', entityId: id, ipAddress: istekIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
