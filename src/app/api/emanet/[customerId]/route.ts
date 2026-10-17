import { NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse, yoneticiMi } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { docToken } from '@/lib/doc-token';
import { musteriDefteri } from '@/lib/emanet-veri';

export const dynamic = 'force-dynamic';

/**
 * GET /api/emanet/[customerId] — bir müşterinin emanet defteri: raftaki
 * kalemler, hareketler (en yeni önce), cihazlar ve uyan tonerler. Birim
 * maliyet ve değer yalnız yöneticiye. Bırakışın ilk satırı herkese açık
 * tutanak imzasını taşır (WhatsApp'tan gönderilebilsin).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    const { tenantId, user } = await requireTenantUser();
    const { customerId } = await params;
    const d = await musteriDefteri(tenantId, customerId, { yonetici: yoneticiMi(user) });
    if (!d) return ucHatasi('EMANET_MUSTERI_YOK', 404);
    const imza = (id: string) => { try { return docToken('emanet', id); } catch { return null; } };
    return NextResponse.json({
      ...d,
      hareketler: d.hareketler.map((h) => ({ ...h, tutanakImza: h.tutanak ? imza(h.id) : null })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
