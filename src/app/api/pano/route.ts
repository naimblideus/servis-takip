import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { paylasimliWhatsappAcik } from '@/lib/whatsapp-inbound';
import { canliPanoVerisi, type CanliPanoVerisi } from '@/lib/canli-pano-veri';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pano — operasyon odasındaki televizyonun verisi.
 *
 * Her rol okuyabilir (TV çoğu zaman ön büro hesabıyla açık durur); cevapta
 * PARA YOK, bu yüzden yönetici kapısı gerekmiyor. Bayi oturumdan gelir.
 *
 * ── KISA ÖNBELLEK ────────────────────────────────────────────────────────
 * Ekran 15 saniyede bir soruyor. Aynı bayide üç televizyon ve beş masa
 * açıksa her biri aynı on beş sorguyu ayrı ayrı çalıştırırdı. Bayi başına
 * 10 saniyelik önbellek bunu teke indirir; cevaptaki `olusturuldu` verinin
 * GERÇEK anını taşır, ekran "son güncelleme"yi ondan yazar — yani önbellek
 * hiçbir zaman olduğundan taze görünmez. Aynı anda gelen istekler aynı
 * sorguyu bekler (söz paylaşılır), ikinci kez çalıştırmaz.
 */
const ONBELLEK_MS = 10_000;
const onbellek = new Map<string, { an: number; veri: Promise<CanliPanoVerisi | null> }>();

export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();
    const simdi = Date.now();
    let kayit = onbellek.get(tenantId);
    if (!kayit || simdi - kayit.an > ONBELLEK_MS) {
      kayit = { an: simdi, veri: canliPanoVerisi(tenantId, { paylasimliWhatsapp: paylasimliWhatsappAcik() }) };
      onbellek.set(tenantId, kayit);
      // Hata önbellekte kalmasın: bir sonraki istek yeniden denesin.
      kayit.veri.catch(() => { if (onbellek.get(tenantId) === kayit) onbellek.delete(tenantId); });
      // Silinmiş/eski bayiler birikmesin.
      if (onbellek.size > 500) {
        for (const [k, v] of onbellek) if (simdi - v.an > ONBELLEK_MS) onbellek.delete(k);
      }
    }
    const veri = await kayit.veri;
    if (!veri) return ucHatasi('TENANT_BULUNAMADI', 404);
    return NextResponse.json(veri, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return authErrorResponse(e);
  }
}
