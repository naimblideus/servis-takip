import { NextResponse } from 'next/server';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { writeAudit, istekIp } from '@/lib/audit';
import { ucHatasi } from '@/lib/uc-hata';
import { taramaOnayla } from '@/lib/sayac-tarama-veri';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sayac/tarayici/:id — bayi taramayı onaylar; uygun okumalar
 * sayaç olarak yazılır. Karar sistemdeki GÜNCEL sayaca göre yeniden
 * verilir (bkz. taramaOnayla); aynı tarama iki kez yazılmaz.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, user } = await requireAdminUser();
    const { id } = await params;
    const sonuc = await taramaOnayla(tenantId, id);
    if (sonuc.durum === 'YOK') return ucHatasi('TARAMA_BULUNAMADI', 404);
    if (sonuc.durum === 'ZATEN') return ucHatasi('TARAMA_ZATEN_ONAYLANDI', 409);
    await writeAudit({
      tenantId, userId: user.id,
      action: 'SAYAC_TARAMASI_ONAYLANDI',
      entityType: 'SayacTaramasi', entityId: id,
      newValue: { yazilan: sonuc.ozet.yazilan, durumlar: sonuc.ozet.durumlar },
      ipAddress: istekIp(req),
    });
    return NextResponse.json({ ok: true, ozet: sonuc.ozet });
  } catch (e) {
    return authErrorResponse(e);
  }
}
