import { NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { aktarimGirdisi, teknisyenAktarabilir, DEPO_HATA_DURUMU } from '@/lib/depo';
import { aktar, kendiAraci } from '@/lib/depo-veri';
import { writeAudit, istekIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/depolar/aktar — { kaynak, hedef, partId, adet }; kaynak/hedef
 * 'ana' ya da depo kimliği. Toplam stok değişmez, yalnız yeri değişir.
 * Teknisyen yalnız KENDİ aracına giren ya da aracından çıkan aktarımı yapar.
 */
export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireTenantUser();
    const g = aktarimGirdisi(await req.json().catch(() => null));
    if (typeof g === 'string') return ucHatasi(g, DEPO_HATA_DURUMU[g]);
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      const arac = await kendiAraci(tenantId, user.id);
      if (!teknisyenAktarabilir(g.kaynak, g.hedef, arac?.id ?? null)) return ucHatasi('BU_ISLEM_ICIN_YONETICI_YETKISI', 403);
    }
    const s = await aktar(tenantId, g);
    if (!s.ok) return ucHatasi(s.hata, DEPO_HATA_DURUMU[s.hata], s.deger ? { deger: s.deger } : undefined);
    await writeAudit({ tenantId, action: 'DEPO_AKTARIM', entityType: 'Part', entityId: g.partId, userId: user.id, newValue: g, ipAddress: istekIp(req) });
    return NextResponse.json({ ok: true, kaynakKalan: s.kaynakKalan, parcaAdi: s.parcaAdi });
  } catch (e) {
    return authErrorResponse(e);
  }
}
