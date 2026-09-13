import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import { alisKaydet, tedarikciKarsilastirmasi } from '@/lib/stok-maliyet';
import { prisma } from '@/lib/prisma';

/**
 * PARÇA ALIŞI.
 *
 * YALNIZ YÖNETİCİ: alış fiyatı bayinin kendi ticari bilgisi ve stok
 * artırmak para harcamak demek. Teknisyen fişe parça ekleyebiliyor (stok
 * düşüyor) ama stok ARTIRAMIYOR.
 */

export async function GET(req: NextRequest) {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const partId = req.nextUrl.searchParams.get('partId');
    if (!partId) return NextResponse.json({ error: 'Parça seçilmedi' }, { status: 400 });

    // IDOR: parça bu bayiye mi ait?
    const part = await prisma.part.findFirst({
      where: { id: partId, tenantId },
      select: { id: true, name: true, sku: true, stockQty: true, buyPrice: true, avgCost: true, sellPrice: true },
    });
    if (!part) return NextResponse.json({ error: 'Parça bulunamadı' }, { status: 404 });

    const alislar = await prisma.partPurchase.findMany({
      where: { tenantId, partId },
      orderBy: { purchasedAt: 'desc' },
      take: 50,
      select: {
        id: true, quantity: true, unitCost: true, supplier: true,
        invoiceNo: true, purchasedAt: true, avgAfter: true, note: true,
      },
    });

    return NextResponse.json({
      parca: {
        ...part,
        buyPrice: Number(part.buyPrice),
        sellPrice: Number(part.sellPrice),
        avgCost: part.avgCost === null ? null : Number(part.avgCost),
      },
      alislar: alislar.map((a) => ({
        ...a,
        unitCost: Number(a.unitCost),
        avgAfter: a.avgAfter === null ? null : Number(a.avgAfter),
      })),
      tedarikciler: await tedarikciKarsilastirmasi(tenantId, partId),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const g = await req.json().catch(() => ({}));

    const adet = parseInt(g.adet, 10);
    const birimAlis = Number(g.birimAlis);
    if (!g.partId || typeof g.partId !== 'string') {
      return NextResponse.json({ error: 'Parça seçilmedi' }, { status: 400 });
    }
    if (!Number.isFinite(adet) || adet < 1) {
      return NextResponse.json({ error: 'Adet en az 1 olmalı' }, { status: 400 });
    }
    if (!Number.isFinite(birimAlis) || birimAlis < 0) {
      return NextResponse.json({ error: 'Birim alış fiyatı geçersiz' }, { status: 400 });
    }

    // Gelecek tarihli alış, ortalamanın geçmişini bozar ve raporda "bu ay
    // alınmış" görünür. Bugünü aşan tarih kabul edilmiyor.
    let tarih: Date | undefined;
    if (g.tarih) {
      const t = new Date(g.tarih);
      if (isNaN(t.getTime())) return NextResponse.json({ error: 'Tarih geçersiz' }, { status: 400 });
      if (t.getTime() > Date.now() + 86400000) {
        return NextResponse.json({ error: 'Alış tarihi gelecekte olamaz' }, { status: 400 });
      }
      tarih = t;
    }

    const sonuc = await alisKaydet({
      tenantId, partId: g.partId, adet, birimAlis, tarih,
      tedarikci: typeof g.tedarikci === 'string' ? g.tedarikci.trim() || null : null,
      faturaNo: typeof g.faturaNo === 'string' ? g.faturaNo.trim() || null : null,
      not: typeof g.not === 'string' ? g.not.trim() || null : null,
    });
    return NextResponse.json({ ok: true, ...sonuc });
  } catch (e) {
    if (e instanceof Error && /bulunamadı|en az|negatif/.test(e.message)) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return authErrorResponse(e);
  }
}
