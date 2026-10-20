import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { writeAudit, istekIp } from '@/lib/audit';
import { notGirdisi } from '@/lib/kurulum';
import { notEkle } from '@/lib/kurulum-veri';

/**
 * POST /api/super-admin/kurulum/[tenantId]/not — temas notu (ARAMA | ZIYARET | NOT).
 *
 * Yazan adı OTURUMDAN gelir; istemcinin gönderdiği ad yok sayılır (not başka
 * biri adına yazılamasın). Denetime metnin kendisi değil türü ve uzunluğu
 * yazılır: not zaten kendi tablosunda, aynı metni iki yerde tutmanın faydası yok.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const sa = await getSuperAdminSession();
  if (!sa) return NextResponse.json({ hata: 'OTURUM_YOK' }, { status: 401 });
  const { tenantId } = await params;

  const govde = await req.json().catch(() => null);
  const g = notGirdisi(govde);
  if ('hata' in g) return NextResponse.json({ hata: g.hata }, { status: 400 });

  const s = await notEkle(tenantId, { yazanId: sa.id, yazanAd: sa.name || sa.email, tur: g.tur, metin: g.metin });
  if (!s.ok) return NextResponse.json({ hata: s.hata }, { status: 404 });

  await writeAudit({
    tenantId,
    action: 'KURULUM_NOTU_EKLENDI',
    entityType: 'KurulumNotu',
    entityId: s.deger.id,
    newValue: { tur: g.tur, uzunluk: g.metin.length },
    ipAddress: istekIp(req),
    actorType: 'SUPER_ADMIN',
    actorName: sa.email,
  });
  return NextResponse.json({ ok: true, id: s.deger.id }, { status: 201 });
}
