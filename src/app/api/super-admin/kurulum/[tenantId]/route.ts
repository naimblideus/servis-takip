import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { writeAudit, istekIp } from '@/lib/audit';
import { takipGirdisi } from '@/lib/kurulum';
import { takipGuncelle } from '@/lib/kurulum-veri';

/**
 * PATCH /api/super-admin/kurulum/[tenantId] — takip: sorumlu ve sonraki temas.
 *
 * İki rol de (SAHIP, EKIP) yazabilir: kurulum ekibinin asıl işi bu. Hatalar
 * KOD döner ({ hata: 'KOD' }); cümleyi ekran kurar (kurulum-metin.ts → hata).
 * Her değişiklik denetime yazılır: "bu bayiyi kim, ne zaman üstlendi".
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const sa = await getSuperAdminSession();
  if (!sa) return NextResponse.json({ hata: 'OTURUM_YOK' }, { status: 401 });
  const { tenantId } = await params;

  const govde = await req.json().catch(() => null);
  const g = takipGirdisi(govde);
  if ('hata' in g) return NextResponse.json({ hata: g.hata }, { status: 400 });

  const s = await takipGuncelle(tenantId, g);
  if (!s.ok) return NextResponse.json({ hata: s.hata }, { status: s.hata === 'BAYI_YOK' ? 404 : 400 });

  await writeAudit({
    tenantId,
    action: 'KURULUM_TAKIP_DEGISTI',
    entityType: 'KurulumTakip',
    entityId: tenantId,
    oldValue: s.deger.once,
    newValue: { sorumluId: s.deger.sonra.sorumluId, sonrakiTemas: s.deger.sonra.sonrakiTemas },
    ipAddress: istekIp(req),
    actorType: 'SUPER_ADMIN',
    actorName: sa.email,
  });
  return NextResponse.json({ ok: true, takip: s.deger.sonra });
}
