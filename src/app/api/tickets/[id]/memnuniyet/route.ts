import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { anketGonder } from '@/lib/memnuniyet-veri';
import { kanalMi } from '@/lib/memnuniyet';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/<id>/memnuniyet — "Memnuniyet sor" kartı açıldı ya da
 * anket gönderildi. Gövde: { kanal: 'YERINDE' | 'WHATSAPP' | null }.
 *
 * Anketin kendisi bir mesaj GÖNDERMEZ: QR teknisyenin ekranında, WhatsApp
 * mesajı teknisyenin kendi telefonundan gider (wa.me). Burası yalnız "bu
 * müşteriye soruldu" satırını açar — cevap oranı bununla ölçülür. Tekrar
 * çağrı yeni satır açmaz (fiş başına tek anket).
 *
 * Her rol çağırabilir: fişi teslim eden çoğu zaman teknisyendir. Fiş bu
 * bayinin değilse 404.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTenantUser();
    const { id } = await params;
    const govde = await req.json().catch(() => ({})) as { kanal?: unknown };
    const kanal = govde?.kanal == null ? null : kanalMi(govde.kanal) ? govde.kanal : undefined;
    if (kanal === undefined) return ucHatasi('GECERSIZ_ISTEK', 400);

    const s = await anketGonder(tenantId, id, kanal);
    if (s.durum === 'FIS_YOK') return ucHatasi('FIS_BULUNAMADI', 404);
    if (s.durum === 'DURUM_UYGUN_DEGIL') return ucHatasi('ANKET_KAPALI', 409);
    return NextResponse.json({ anket: s.anket });
  } catch (e) {
    return authErrorResponse(e);
  }
}
