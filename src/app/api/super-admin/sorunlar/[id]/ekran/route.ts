import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { sorunEkrani } from '@/lib/sorun-veri';

/**
 * GET /api/super-admin/sorunlar/[id]/ekran — tek bildirimin ekran görüntüsü.
 * Listeye gömülmüyor: yüz bildirimlik liste yüz görüntü taşımasın, müşterinin
 * ekranı yalnız bakan biri tıklayınca gelsin. Görüntü YALNIZ süper admin'de.
 * Yanıt ham JPEG (önbelleğe alınmaz).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const veri = await sorunEkrani(id);
  const m = veri?.match(/^data:image\/jpeg;base64,(.+)$/);
  if (!m) return ucHatasi('SORUN_BULUNAMADI', 404);

  return new NextResponse(new Uint8Array(Buffer.from(m[1], 'base64')), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
