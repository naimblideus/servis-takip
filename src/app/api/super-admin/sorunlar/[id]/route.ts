import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { writeAudit } from '@/lib/audit';
import { ayiklamaKur } from '@/lib/sorun';
import { sorunBul, sorunGuncelle } from '@/lib/sorun-veri';

/**
 * PATCH /api/super-admin/sorunlar/[id] — ayıklama.
 * Gövde (hepsi isteğe bağlı): { durum, kutu, yoneticiNotu, bildirildi }.
 * Geçiş kuralları lib/sorun.ts ayiklamaKur'da (COZULDU → cozulduAt,
 * "bildirildi" yalnız COZULDU'da). Her değişiklik denetim kaydına yazılır.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const mevcut = await sorunBul(id);
  if (!mevcut) return ucHatasi('SORUN_BULUNAMADI', 404);

  let govde: Record<string, unknown>;
  try {
    govde = await req.json();
  } catch {
    return ucHatasi('SORUN_GECERSIZ_ISTEK', 400);
  }

  const k = ayiklamaKur(mevcut, govde, new Date());
  if (!k.ok) return ucHatasi(k.kod, 400);
  if (Object.keys(k.data).length === 0) return NextResponse.json({ ok: true, sorun: mevcut });

  const sorun = await sorunGuncelle(id, k.data);
  await writeAudit({
    tenantId: mevcut.tenantId,
    action: 'SORUN_AYIKLANDI',
    entityType: 'SorunBildirimi',
    entityId: id,
    oldValue: { durum: mevcut.durum, kutu: mevcut.kutu, yoneticiNotu: mevcut.yoneticiNotu, bildirildiAt: mevcut.bildirildiAt },
    newValue: k.data,
    actorType: 'SUPER_ADMIN',
    actorName: admin.email,
  });
  return NextResponse.json({ ok: true, sorun });
}
