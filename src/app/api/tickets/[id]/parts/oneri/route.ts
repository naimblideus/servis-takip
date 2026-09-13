import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { modelAnahtari } from '@/lib/toner-verimi';

/**
 * GET /api/tickets/[id]/parts/oneri
 *
 * BU MODELDE EN ÇOK KULLANILAN PARÇALAR.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Ölçüldü (2026-09-14): 8.188 parça kullanımının %41'i her cihaz modelinin
 * ilk 3 parçasında toplanıyor; 205 modelin 128'inde ilk 3 parça o modeldeki
 * kullanımın yarısından fazlası. Yani teknisyenin arayacağı parça çoğu
 * zaman belli — ama 688 parçalık listede aratıyoruz.
 *
 * Sahada bu fark büyük: teknisyen makinenin başında, telefonuyla, elleri
 * kirli. Üç dokunuşluk arama yerine tek dokunuş.
 *
 * ── ÖNERİ DEĞİL GEÇMİŞ ───────────────────────────────────────────────────
 * Burada hiçbir katalog ya da uyumluluk tablosu yok; bayinin KENDİ
 * geçmişinde o modele ne taktığı sayılıyor. Uyumluluk tablosu uydurmak,
 * yanlış parçayı önermek demek olurdu.
 */

const PENCERE_AY = 24;
const EN_AZ_KULLANIM = 3;
const TAVAN = 6;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // IDOR: fiş bu bayiye mi ait?
    const ticket = await prisma.serviceTicket.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { deviceId: true, device: { select: { brand: true, model: true } } },
    });
    if (!ticket) return NextResponse.json({ error: 'Fiş bulunamadı' }, { status: 404 });

    const anahtar = modelAnahtari(ticket.device?.brand, ticket.device?.model);

    // Aynı modeldeki cihazlar. Marka/model normalleştirmesi SQL'de
    // tekrarlanamıyor (ters kayıtlar, yazım farkları) — kiracı kapsamında
    // çekip burada eşleştiriyoruz.
    const cihazlar = await prisma.device.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, brand: true, model: true },
    });
    const ayniModel = cihazlar.filter((d) => modelAnahtari(d.brand, d.model) === anahtar).map((d) => d.id);
    if (!ayniModel.length) return NextResponse.json({ model: anahtar, parcalar: [] });

    const since = new Date(Date.now() - PENCERE_AY * 30.44 * 24 * 3600 * 1000);
    const kullanimlar = await prisma.ticketPart.groupBy({
      by: ['partId'],
      where: {
        tenantId: user.tenantId,
        ticket: { deviceId: { in: ayniModel }, deletedAt: null, createdAt: { gte: since } },
      },
      _count: { _all: true },
      _sum: { quantity: true },
      orderBy: { _count: { partId: 'desc' } },
      take: TAVAN * 2,
    });

    // Az kullanılmış parça ÖNERİLMİYOR: tek seferlik bir kullanım
    // "bu modelde bu takılır" demek değil ve yanlış parça önermek,
    // hiç önermemekten kötü.
    const yeterli = kullanimlar.filter((k) => k._count._all >= EN_AZ_KULLANIM).slice(0, TAVAN);
    if (!yeterli.length) return NextResponse.json({ model: anahtar, parcalar: [] });

    const parcalar = await prisma.part.findMany({
      where: { tenantId: user.tenantId, id: { in: yeterli.map((k) => k.partId) } },
      select: { id: true, sku: true, name: true, stockQty: true, sellPrice: true, group: true },
    });
    const harita = new Map(parcalar.map((p) => [p.id, p]));

    return NextResponse.json({
      model: anahtar,
      cihazSayisi: ayniModel.length,
      parcalar: yeterli
        .map((k) => {
          const p = harita.get(k.partId);
          if (!p) return null;
          return {
            id: p.id, sku: p.sku, name: p.name, group: p.group,
            stockQty: p.stockQty, sellPrice: Number(p.sellPrice),
            kullanim: k._count._all,
          };
        })
        .filter(Boolean),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
