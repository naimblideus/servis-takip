import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { ANA } from '@/lib/depo';
import { depoKalemleri } from '@/lib/depo-veri';
import { writeAudit, istekIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const yoneticiMi = (rol: string) => rol === 'ADMIN' || rol === 'SUPER_ADMIN';

/** GET /api/depolar/<id|ana> — deponun kalemleri. Birim maliyet yalnız yöneticiye. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireTenantUser();
    const { id } = await params;
    const kalemler = await depoKalemleri(tenantId, id === ANA ? ANA : id, yoneticiMi(user.role));
    if (!kalemler) return ucHatasi('DEPO_YOK', 404);
    return NextResponse.json({ kalemler });
  } catch (e) {
    return authErrorResponse(e);
  }
}

/**
 * PATCH /api/depolar/<id> — ad ya da aktiflik (yalnız yönetici).
 * Pasif araç fişte stok düşmez, aktarım almaz; içindeki parça sayılmaya
 * devam eder (toplam stok değişmez), boşaltmak için önce ana depoya aktarılır.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireTenantUser();
    if (!yoneticiMi(user.role)) return ucHatasi('BU_ISLEM_ICIN_YONETICI_YETKISI', 403);
    const { id } = await params;
    const depo = await prisma.depo.findFirst({ where: { id, tenantId } });
    if (!depo) return ucHatasi('DEPO_YOK', 404);
    const g = (await req.json().catch(() => ({}))) as { ad?: unknown; aktif?: unknown };
    const veri: { ad?: string; aktif?: boolean } = {};
    if (typeof g.ad === 'string') {
      const ad = g.ad.trim().replace(/\s+/g, ' ');
      if (ad.length < 2 || ad.length > 60) return ucHatasi('DEPO_AD_GECERSIZ', 400);
      veri.ad = ad;
    }
    if (typeof g.aktif === 'boolean') veri.aktif = g.aktif;
    const yeni = await prisma.depo.update({ where: { id }, data: veri });
    await writeAudit({ tenantId, action: 'DEPO_GUNCELLENDI', entityType: 'Depo', entityId: id, userId: user.id, oldValue: { ad: depo.ad, aktif: depo.aktif }, newValue: veri, ipAddress: istekIp(req) });
    return NextResponse.json({ ok: true, depo: { id: yeni.id, ad: yeni.ad, aktif: yeni.aktif } });
  } catch (e) {
    return authErrorResponse(e);
  }
}
