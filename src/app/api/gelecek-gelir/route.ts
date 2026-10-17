import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { requireAdminUser, authErrorResponse, AuthError } from '@/lib/api-auth';
import { gelecekGelirVerisi } from '@/lib/gelecek-gelir-veri';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gelecek-gelir — önümüzdeki 60 ayın geliri (sözleşmeli /
 * yenilenirse / sözleşmesiz) + riskteki sözleşmeler (lib/gelecek-gelir.ts).
 *
 * YALNIZ YÖNETİCİ: bayinin bütün kira ve sözleşme gelirini tutarıyla
 * gösteriyor. Yetki hatası okuyanın dilinde döner.
 */
export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await requireAdminUser());
  } catch (e) {
    if (e instanceof AuthError && e.status === 403) return ucHatasi('BU_EKRAN_ICIN_YONETICI_YETKISI', 403);
    return authErrorResponse(e);
  }
  try {
    const veri = await gelecekGelirVerisi(tenantId);
    if (!veri) return ucHatasi('TENANT_BULUNAMADI', 404);
    return NextResponse.json(veri, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return authErrorResponse(e);
  }
}
