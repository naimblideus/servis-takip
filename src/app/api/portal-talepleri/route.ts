import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { sonOkumalar } from '@/lib/readings';

export const dynamic = 'force-dynamic';

// GET /api/portal-talepleri?durum=BEKLIYOR — müşteri portalından gelen bildirimler.
export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantUser();
    const durum = new URL(req.url).searchParams.get('durum') || 'BEKLIYOR';

    const [talepler, bekleyen] = await Promise.all([
      prisma.portalRequest.findMany({
        where: { tenantId, ...(durum === 'HEPSI' ? {} : { durum }) },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          device: { select: { id: true, brand: true, model: true, serialNo: true, location: true } },
        },
      }),
      prisma.portalRequest.count({ where: { tenantId, durum: 'BEKLIYOR' } }),
    ]);

    // Karşılaştırma SON OKUMAYA göre: fatura farkı da ona göre hesaplanacak.
    // Device.counterBlack gösterseydik bayi başka bir sayıya bakıp onaylardı.
    const okuma = await sonOkumalar(
      tenantId,
      talepler.map((t) => t.deviceId).filter((d): d is string => Boolean(d)),
    );

    return NextResponse.json({
      bekleyen,
      items: talepler.map((t) => ({
        id: t.id,
        tur: t.tur,
        durum: t.durum,
        tarih: t.createdAt.toISOString(),
        aciklama: t.aciklama,
        sayacBlack: t.sayacBlack,
        sayacColor: t.sayacColor,
        notu: t.notu,
        ticketId: t.ticketId,
        musteri: t.customer ? { id: t.customer.id, ad: t.customer.name, telefon: t.customer.phone } : null,
        cihaz: t.device ? {
          id: t.device.id,
          ad: `${t.device.brand} ${t.device.model}`,
          seri: t.device.serialNo,
          yer: t.device.location,
          // Bayi "müşterinin yazdığı değer mantıklı mı" diye baksın diye son okuma
          sonBlack: okuma.get(t.device.id)?.counterBlack ?? null,
          sonColor: okuma.get(t.device.id)?.counterColor ?? null,
          sonTarih: okuma.get(t.device.id)?.readingDate.toISOString() ?? null,
        } : null,
      })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
