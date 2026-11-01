import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { urunVerisi } from '@/lib/baski-urun';

export const dynamic = 'force-dynamic';

/** PUT /api/matbaa/urunler/:id — ürünü günceller. Açık işlerin tutarı dondurulmuştur, etkilenmez. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireMatbaaUser(['ADMIN']);
    const { id } = await params;
    const veri = urunVerisi(((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>);
    if (!veri) return baskiHatasi('AD_GEREKLI');
    const r = await prisma.baskiUrunu.updateMany({ where: { id, tenantId }, data: veri });
    if (r.count !== 1) return baskiHatasi('URUN_YOK');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return matbaaYaniti(e);
  }
}

/** DELETE /api/matbaa/urunler/:id — listeden kaldırır (aktif=false); eski işlerin kalemi ürünsüz kalmaz. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireMatbaaUser(['ADMIN']);
    const { id } = await params;
    const r = await prisma.baskiUrunu.updateMany({ where: { id, tenantId }, data: { aktif: false } });
    if (r.count !== 1) return baskiHatasi('URUN_YOK');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
