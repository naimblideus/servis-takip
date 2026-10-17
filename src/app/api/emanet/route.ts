import { NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse, yoneticiMi } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { writeAudit, istekIp } from '@/lib/audit';
import { docToken } from '@/lib/doc-token';
import { emanetOzeti, emanetIslemi, formSecenekleri } from '@/lib/emanet-veri';
import { HATA_DURUMU } from '@/lib/emanet';

export const dynamic = 'force-dynamic';

/**
 * GET /api/emanet — müşterilerde duran toner: tepedeki tek sayı, uyarılar,
 * müşteri listesi. Değer (₺) YALNIZ yöneticiye; teknisyen adet görür.
 * GET /api/emanet?secenek=1 — form seçenekleri (müşteriler + stok kartları, fiyatsız).
 */
export async function GET(req: Request) {
  try {
    const { tenantId, user } = await requireTenantUser();
    if (new URL(req.url).searchParams.get('secenek') === '1') return NextResponse.json(await formSecenekleri(tenantId));
    return NextResponse.json(await emanetOzeti(tenantId, { yonetici: yoneticiMi(user) }));
  } catch (e) {
    return authErrorResponse(e);
  }
}

/** İmzalı herkese açık tutanak bağlantısı; anahtar yoksa bağlantı verilmez. */
function tutanakImzasi(id: string): string | null {
  try { return docToken('emanet', id); } catch { return null; }
}

/**
 * POST /api/emanet — { islem: 'birak'|'iade'|'kayip'|'sayim', customerId, kalemler: [{ partId, adet | sayilan }], bosAdet?, deviceId?, not? }
 *
 * Kurallar lib/emanet.ts, işlem lib/emanet-veri.ts (tek işlem + müşteri
 * kilidi). Hata KOD olarak döner, cümleyi uc-hata isteğin dilinde kurar.
 * Ortak demoda bu uç kapalı (lib/demo-yazma DEMO_VITRIN).
 */
export async function POST(req: Request) {
  try {
    const { tenantId, user } = await requireTenantUser();
    const govde = await req.json().catch(() => null);
    const r = await emanetIslemi(tenantId, user.id, govde);
    if (!r.ok) return ucHatasi(r.hata, HATA_DURUMU[r.hata], r.deger ? { deger: r.deger } : undefined);
    // Defter değişti: kim, ne zaman, hangi müşteride — tek kayıt. Sayım "tuttu"
    // olsa da yazılır: deftere satır açmayan sayımın izi burada kalır.
    const customerId = String((govde as { customerId?: unknown } | null)?.customerId ?? '');
    await writeAudit({
      tenantId, userId: user.id,
      action: `EMANET_${r.islem === 'birak' ? 'BIRAKILDI' : r.islem === 'iade' ? 'IADE' : r.islem === 'kayip' ? 'KAYIP' : 'SAYIM'}`,
      entityType: 'Customer', entityId: customerId,
      newValue: r.islem === 'sayim'
        ? { tam: (r.sayim ?? []).every((s) => s.fark === 0), eksik: (r.sayim ?? []).reduce((t, s) => t + Math.max(0, -s.fark), 0), fazla: (r.sayim ?? []).reduce((t, s) => t + Math.max(0, s.fark), 0), kalem: r.sayim?.length ?? 0 }
        : { adet: r.adet, hareketler: r.hareketler.slice(0, 30) },
      ipAddress: istekIp(req),
    });
    return NextResponse.json({ ...r, tutanakImza: r.tutanakId ? tutanakImzasi(r.tutanakId) : null });
  } catch (e) {
    return authErrorResponse(e);
  }
}
