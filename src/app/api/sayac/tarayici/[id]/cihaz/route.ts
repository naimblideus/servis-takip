import { NextResponse } from 'next/server';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { writeAudit, istekIp } from '@/lib/audit';
import { ucHatasi } from '@/lib/uc-hata';
import { taramadanCihazEkle } from '@/lib/sayac-tarama-veri';

export const dynamic = 'force-dynamic';

/** Bir istekte eklenebilecek en fazla yazıcı: tek taramanın bol üst sınırı. */
const AZAMI_SERI = 500;

/**
 * POST /api/sayac/tarayici/:id/cihaz — taramada bulunan ama sistemde kayıtlı
 * olmayan yazıcıları seçilen müşteriye cihaz olarak ekler.
 *
 * Gövde yalnız SEÇİMİ taşır: { customerId, seriler }. Marka, model ve sayaç
 * sunucudaki taramadan okunur (bkz. taramadanCihazEkle); istemci bir cihazın
 * sayacını kendisi yazdıramaz.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, user } = await requireAdminUser();
    const { id } = await params;
    const govde = await req.json().catch(() => null);
    const customerId = typeof govde?.customerId === 'string' ? govde.customerId.trim() : '';
    const seriler: string[] = Array.isArray(govde?.seriler)
      ? govde.seriler.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0 && s.length <= 100)
      : [];
    if (!customerId || customerId.length > 64 || !seriler.length || seriler.length > AZAMI_SERI) {
      return ucHatasi('TARAMA_SECIM_GECERSIZ', 400);
    }

    const sonuc = await taramadanCihazEkle(tenantId, id, customerId, seriler);
    if (sonuc.durum === 'YOK') return ucHatasi('TARAMA_BULUNAMADI', 404);
    if (sonuc.durum === 'MUSTERI_YOK') return ucHatasi('MUSTERI_BULUNAMADI', 404);
    if (sonuc.eklenen) {
      await writeAudit({
        tenantId, userId: user.id,
        action: 'TARAMADAN_CIHAZ_EKLENDI',
        entityType: 'SayacTaramasi', entityId: id,
        newValue: { customerId, eklenen: sonuc.eklenen, zatenVar: sonuc.zatenVar },
        ipAddress: istekIp(req),
      });
    }
    return NextResponse.json({ ok: true, eklenen: sonuc.eklenen, zatenVar: sonuc.zatenVar });
  } catch (e) {
    return authErrorResponse(e);
  }
}
