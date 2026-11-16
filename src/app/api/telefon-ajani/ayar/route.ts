import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, requireAdminUser, authErrorResponse, yoneticiMi } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { ajanAyarDurumu, ajaniSenkronla, ayarDegistir, taslakSayaci } from '@/lib/telefon-ajani-veri';

/**
 * GET   /api/telefon-ajani/ayar — ajanın durumu, hazırlık listesi, sayaç
 * PATCH /api/telefon-ajani/ayar — aç/kapa, asistan adı, aktarma numarası (yönetici)
 * POST  /api/telefon-ajani/ayar — ayarı telefon ajanına yeniden gönder (yönetici)
 *
 * Hat numarasını bayi DEĞİŞTİREMEZ: hattı platform ekibi atar
 * (/api/super-admin/tenants/[id]/telefon-ajani). Aç/kapa anında geçerlidir;
 * gelen arama ucu her aramada bu ayara bakar.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { user, tenantId } = await requireTenantUser();
    const [durum, sayac] = await Promise.all([ajanAyarDurumu(tenantId), taslakSayaci(tenantId)]);
    return NextResponse.json({ ...durum, sayac, yonetici: yoneticiMi(user) });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, tenantId } = await requireAdminUser();
    const g = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const r = await ayarDegistir(tenantId, user, {
      acik: g.acik,
      asistanAdi: g.asistanAdi,
      aktarmaTelefonu: g.aktarmaTelefonu,
    });
    if (!r.ok) return ucHatasi(r.kod, 400);
    return NextResponse.json({ ok: true, senkron: r.senkron, ...(await ajanAyarDurumu(tenantId)) });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST() {
  try {
    const { user, tenantId } = await requireAdminUser();
    const senkron = await ajaniSenkronla(tenantId, { userId: user.id });
    return NextResponse.json({ ok: senkron.ok, senkron, ...(await ajanAyarDurumu(tenantId)) });
  } catch (e) {
    return authErrorResponse(e);
  }
}
