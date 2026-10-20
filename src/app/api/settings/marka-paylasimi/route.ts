import { NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse, yoneticiMi } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { writeAudit, istekIp } from '@/lib/audit';
import { demoBayiMi } from '@/lib/demo-koruma';
import { paylasimGirdisi } from '@/lib/distributor';
import { paylasimOku, paylasimYaz } from '@/lib/distributor-veri';

/**
 * /api/settings/marka-paylasimi — bayinin üreticiyle paylaşım rızası.
 *   GET   { oemDataSharing, markaAdIzni }
 *   PATCH { oemDataSharing?: boolean, markaAdIzni?: boolean }
 *
 * Yalnız yönetici. Ad izni yalnız paylaşım açıkken açık kalabilir
 * (lib/distributor paylasimSonrasi); açılan iznin anı yazılır. Her
 * değişiklik denetim kaydına geçer: rıza sonradan sorgulanabilir olmalı.
 * Demo bayide yazma kapalı (middleware de /api/settings yazmasını keser).
 */
export async function GET() {
  try {
    const { user, tenantId } = await requireTenantUser();
    if (!yoneticiMi(user)) return ucHatasi('BU_EKRAN_ICIN_YONETICI_YETKISI', 403);
    const p = await paylasimOku(tenantId);
    if (!p) return ucHatasi('GECERSIZ_ISTEK', 404);
    return NextResponse.json(p);
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, tenantId } = await requireTenantUser();
    if (!yoneticiMi(user)) return ucHatasi('BU_EKRAN_ICIN_YONETICI_YETKISI', 403);
    if (await demoBayiMi(tenantId)) return ucHatasi('DEMO_HESABINDA_KAPALI', 403);
    const istek = paylasimGirdisi(await req.json().catch(() => null));
    if ('hata' in istek) return ucHatasi('GECERSIZ_ISTEK', 400);
    const r = await paylasimYaz(tenantId, istek);
    if (!r) return ucHatasi('GECERSIZ_ISTEK', 404);
    if (r.once.oemDataSharing !== r.sonra.oemDataSharing || r.once.markaAdIzni !== r.sonra.markaAdIzni) {
      await writeAudit({
        tenantId,
        userId: user.id,
        action: 'MARKA_PAYLASIMI_DEGISTI',
        entityType: 'Tenant',
        entityId: tenantId,
        oldValue: r.once,
        newValue: r.sonra,
        ipAddress: istekIp(req),
        actorType: 'USER',
        actorName: user.email,
      });
    }
    return NextResponse.json(r.sonra);
  } catch (e) {
    return authErrorResponse(e);
  }
}
