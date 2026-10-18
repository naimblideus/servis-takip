import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { depoGirdisi, DEPO_HATA_DURUMU } from '@/lib/depo';
import { depoOzeti, kendiAraci } from '@/lib/depo-veri';
import { writeAudit, istekIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const yoneticiMi = (rol: string) => rol === 'ADMIN' || rol === 'SUPER_ADMIN';

/**
 * GET /api/depolar — ana depo + araçlar + ek depolar, her birinde kalem ve
 * adet. Değer (₺) yalnız yöneticiye. Teknisyen kendi aracını `benimArac`
 * olarak alır; yönetici araç açarken seçeceği teknisyen listesini alır.
 */
export async function GET() {
  try {
    const { user, tenantId } = await requireTenantUser();
    const yonetici = yoneticiMi(user.role);
    const [ozet, arac, teknisyenler] = await Promise.all([
      depoOzeti(tenantId, yonetici),
      kendiAraci(tenantId, user.id),
      yonetici
        ? prisma.user.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } })
        : Promise.resolve([]),
    ]);
    return NextResponse.json({ ...ozet, benimArac: arac?.id ?? null, yonetici, kullanicilar: teknisyenler });
  } catch (e) {
    return authErrorResponse(e);
  }
}

/** POST /api/depolar — yeni araç ya da ek depo (yalnız yönetici). */
export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantUser();
    if (!yoneticiMi(user.role)) return ucHatasi('BU_ISLEM_ICIN_YONETICI_YETKISI', 403);
    const g = depoGirdisi(await req.json().catch(() => null));
    if (typeof g === 'string') return ucHatasi(g, DEPO_HATA_DURUMU[g]);
    if (g.kullaniciId) {
      const k = await prisma.user.findFirst({ where: { id: g.kullaniciId, tenantId }, select: { id: true } });
      if (!k) return ucHatasi('DEPO_TEKNISYEN_GEREKLI', 400);
    }
    const ayni = await prisma.depo.findFirst({ where: { tenantId, ad: g.ad }, select: { id: true } });
    if (ayni) return ucHatasi('DEPO_AD_GECERSIZ', 409);
    const depo = await prisma.depo.create({ data: { tenantId, ad: g.ad, tur: g.tur, kullaniciId: g.kullaniciId } });
    await writeAudit({ tenantId, action: 'DEPO_EKLENDI', entityType: 'Depo', entityId: depo.id, userId: user.id, newValue: g, ipAddress: istekIp(req) });
    return NextResponse.json({ ok: true, id: depo.id });
  } catch (e) {
    return authErrorResponse(e);
  }
}
