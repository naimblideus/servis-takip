import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { aradimIsaretle } from '@/lib/memnuniyet-veri';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/memnuniyet/<anket> — { arandi: true }: 0–6 veren müşteri arandı.
 *
 * YALNIZ YÖNETİCİ: memnuniyet panosu bir teknisyenin müşterisinin ne dediğini
 * gösteriyor; menüde gizli olması yetmez, uç da kapalı.
 * Demoda kapalı (lib/demo-yazma.ts): bir ziyaretçi "Aradım"a basınca liste
 * herkese boşalırdı.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireAdminUser();
    const { id } = await params;
    const govde = await req.json().catch(() => null) as { arandi?: unknown } | null;
    if (govde?.arandi !== true) return ucHatasi('GECERSIZ_ISTEK', 400);
    if ((await aradimIsaretle(tenantId, id)) === 'YOK') return ucHatasi('KAYIT_BULUNAMADI', 404);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
