import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { siradakiTeklifNo } from '@/lib/teklif';

/**
 * TEKLİFLER.
 *
 * YALNIZ YÖNETİCİ: teklifin içinde maliyet ve marj var. Teknisyen
 * ekranında görünmesi gereken bir şey değil.
 */

export async function GET() {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const teklifler = await prisma.teklif.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, teklifNo: true, musteriAdi: true, durum: true,
        createdAt: true, gecerlilikGun: true,
        customer: { select: { id: true, name: true } },
        _count: { select: { satirlar: true } },
      },
    });
    return NextResponse.json({
      teklifler: teklifler.map((t) => ({
        id: t.id, teklifNo: t.teklifNo, musteriAdi: t.musteriAdi, durum: t.durum,
        createdAt: t.createdAt.toISOString(), gecerlilikGun: t.gecerlilikGun,
        musteri: t.customer?.name ?? null, customerId: t.customer?.id ?? null,
        satirSayisi: t._count.satirlar,
      })),
      siradakiNo: await siradakiTeklifNo(tenantId),
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

    const musteriAdi = typeof g.musteriAdi === 'string' ? g.musteriAdi.trim() : '';
    if (!musteriAdi) return NextResponse.json({ error: 'Müşteri adı gerekli' }, { status: 400 });

    // Mevcut müşteriye bağlanıyorsa IDOR kontrolü.
    let customerId: string | null = null;
    if (g.customerId) {
      const m = await prisma.customer.findFirst({ where: { id: g.customerId, tenantId }, select: { id: true } });
      if (!m) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });
      customerId = m.id;
    }

    // Numara çakışması: iki teklif aynı anda açılırsa veritabanı
    // engelliyor (@@unique). Tekrar deneyip bir sonrakini alıyoruz.
    for (let deneme = 0; deneme < 5; deneme++) {
      const teklifNo = await siradakiTeklifNo(tenantId);
      try {
        const t = await prisma.teklif.create({
          data: {
            tenantId, teklifNo, musteriAdi, customerId,
            yetkili: typeof g.yetkili === 'string' ? g.yetkili.trim() || null : null,
            telefon: typeof g.telefon === 'string' ? g.telefon.trim() || null : null,
            eposta: typeof g.eposta === 'string' ? g.eposta.trim() || null : null,
            notlar: typeof g.notlar === 'string' ? g.notlar.trim() || null : null,
          },
          select: { id: true, teklifNo: true },
        });
        return NextResponse.json({ ok: true, ...t });
      } catch (e: any) {
        if (!/Unique constraint/i.test(e?.message || '')) throw e;
      }
    }
    return NextResponse.json({ error: 'Teklif numarası üretilemedi, tekrar deneyin' }, { status: 409 });
  } catch (e) {
    return authErrorResponse(e);
  }
}
