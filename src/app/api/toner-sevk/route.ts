import { NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { writeAudit, istekIp } from '@/lib/audit';
import { sevkEt } from '@/lib/toner-sevk-veri';

export const dynamic = 'force-dynamic';

/**
 * POST /api/toner-sevk — { sevkler: [{ deviceId, channel, partId?, adet? }] }
 *
 * Bitmek üzere olan cihazlara toner gönderir: her satır için sevk kaydı +
 * stok düşüşü tek işlemde. Satırlar BAĞIMSIZ: biri reddedilirse (stok bitti,
 * zaten yolda) diğerleri gönderilir; sonuç satır satır KOD olarak döner,
 * cümleyi ekran kurar.
 */
export async function POST(req: Request) {
  try {
    const { tenantId, user } = await requireTenantUser();
    const govde = await req.json().catch(() => null);
    const sevkler = Array.isArray(govde?.sevkler) ? govde.sevkler : null;
    if (!sevkler || sevkler.length === 0 || sevkler.length > 200) {
      return ucHatasi('SEVK_LISTESI_GECERSIZ', 400);
    }
    const sonuc = await sevkEt(tenantId, user.id, sevkler);
    const gonderilen = sonuc.filter((s) => s.ok);
    if (gonderilen.length) {
      // Stok değişti: kim, ne zaman, hangi cihazlara — tek kayıt.
      await writeAudit({
        tenantId, userId: user.id,
        action: 'TONER_SEVK',
        entityType: 'TonerSevki', entityId: gonderilen.length === 1 && gonderilen[0].ok ? gonderilen[0].id : tenantId,
        newValue: { adet: gonderilen.length, sevkler: gonderilen.slice(0, 50).map((s) => (s.ok ? { id: s.id, deviceId: s.deviceId, kanal: s.channel } : null)) },
        ipAddress: istekIp(req),
      });
    }
    return NextResponse.json({ sonuc, gonderilen: gonderilen.length, reddedilen: sonuc.length - gonderilen.length });
  } catch (e) {
    return authErrorResponse(e);
  }
}
