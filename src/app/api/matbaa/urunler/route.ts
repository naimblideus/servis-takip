import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { urunVerisi } from '@/lib/baski-urun';

export const dynamic = 'force-dynamic';

/** POST /api/matbaa/urunler — fiyat listesine yeni ürün. Fiyatı sahip belirler. */
export async function POST(req: Request) {
  try {
    const { tenantId } = await requireMatbaaUser(['ADMIN']);
    const veri = urunVerisi(((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>);
    if (!veri) return baskiHatasi('AD_GEREKLI');
    const son = await prisma.baskiUrunu.aggregate({ where: { tenantId }, _max: { sira: true } });
    const urun = await prisma.baskiUrunu.create({ data: { ...veri, tenantId, sira: (son._max.sira ?? 0) + 10 } });
    return NextResponse.json({ ok: true, urun }, { status: 201 });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
