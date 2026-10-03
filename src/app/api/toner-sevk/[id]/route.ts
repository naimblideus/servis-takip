import { NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { writeAudit, istekIp } from '@/lib/audit';
import { sevkIptal } from '@/lib/toner-sevk-veri';

export const dynamic = 'force-dynamic';

/** DELETE /api/toner-sevk/[id] — yolda olan sevki geri alır; stok geri gelir. Takılmış sevk iptal edilmez. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, user } = await requireTenantUser();
    const { id } = await params;
    const sonuc = await sevkIptal(tenantId, id);
    if (sonuc.durum === 'YOK') return NextResponse.json({ durum: sonuc.durum }, { status: 404 });
    if (sonuc.durum === 'KAPANMIS') return NextResponse.json({ durum: sonuc.durum }, { status: 409 });
    await writeAudit({
      tenantId, userId: user.id,
      action: 'TONER_SEVK_IPTAL',
      entityType: 'TonerSevki', entityId: id,
      ipAddress: istekIp(req),
    });
    return NextResponse.json(sonuc);
  } catch (e) {
    return authErrorResponse(e);
  }
}
