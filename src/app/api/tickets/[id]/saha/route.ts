import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { sahaIslemi } from '@/lib/saha-suresi-veri';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/<id>/saha — { islem: 'vardim' | 'ciktim' | 'geriAl' | 'ustlen' }
 *
 * Teknisyen müşteriye varınca "Vardım", çıkarken "Çıktım". Konum ALINMAZ,
 * yalnız saat. Tekrar basmak zararsız (ilk saat kalır). "geriAl" yalnız
 * yönetici: yanlış basılan son adımı siler. "ustlen": atanmamış işi kendine al.
 * Kurallar lib/saha-suresi.ts'te.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireTenantUser();
    const { id } = await params;
    const govde = await req.json().catch(() => null) as { islem?: unknown } | null;
    const s = await sahaIslemi(tenantId, id, { id: user.id, role: String(user.role) }, String(govde?.islem ?? ''));
    if (s.durum === 'YOK') return ucHatasi('FIS_BULUNAMADI', 404);
    if (s.durum === 'HATA') return ucHatasi(s.kod, s.http);
    return NextResponse.json({
      degisti: s.degisti,
      status: s.fis.status,
      varisAt: s.fis.varisAt?.toISOString() ?? null,
      ayrilisAt: s.fis.ayrilisAt?.toISOString() ?? null,
      assignedUserId: s.fis.assignedUserId,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
