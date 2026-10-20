import { NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse, yoneticiMi } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { kurulumSatiri } from '@/lib/kurulum-veri';

/**
 * GET /api/kurulum — bayinin KENDİ kurulum durumu (panel kartı için).
 *
 * Yalnız yönetici: kurulum adımları fiyat ve fatura gibi ofis işleri;
 * teknisyenin panelinde "fatura kesin" demek yanlış kişiye iş vermektir.
 * Bayi kimliği oturumdan gelir; başka bayinin durumu sorulamaz.
 * Demo bayide kart çizilmez (veri hazır, kurulum yok): goster=false.
 */
export async function GET() {
  try {
    const { user, tenantId } = await requireTenantUser();
    if (!yoneticiMi(user)) return ucHatasi('BU_EKRAN_ICIN_YONETICI_YETKISI', 403);
    const s = await kurulumSatiri(tenantId);
    if (!s) return NextResponse.json({ goster: false });
    const k = s.kurulum;
    return NextResponse.json({
      goster: !k.hazir,
      hazir: k.hazir,
      tamam: k.zorunluTamam,
      toplam: k.zorunluToplam,
      musteri: s.musteri,
      sonraki: k.sonrakiAdim && k.sonrakiAdim.zorunlu ? { kod: k.sonrakiAdim.kod, yol: k.sonrakiAdim.yol } : null,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
