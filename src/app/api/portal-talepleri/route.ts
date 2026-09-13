import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { sonOkumalar } from '@/lib/readings';
import { gunFarki } from '@/lib/sozlesme';

/**
 * Müşteri talebi bu kadar gün beklerse GECİKMİŞ sayılıyor.
 *
 * Ekran bekleyeni yalnız SAYIYORDU: "3 bekliyor" yazıyor ama üçü de
 * dünkü mü, biri iki haftalık mı belli değildi. Müşteri portaldan
 * yazdığı ve dönülmediği için telefonla arıyor, bayi "bize ulaşmadı"
 * diyor — oysa kayıt ekranda duruyor.
 */
const GECIKME_GUN = 2;

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

    const bugun = new Date();
    // Bekleyenlerin KAÇI gecikmiş: sayı tek başına "acil mi" sorusunu
    // cevaplamıyordu.
    const bekleyenler = await prisma.portalRequest.findMany({
      where: { tenantId, durum: 'BEKLIYOR' },
      select: { createdAt: true },
    });
    const geciken = bekleyenler.filter((x) => gunFarki(x.createdAt, bugun) >= GECIKME_GUN).length;
    const enEski = bekleyenler.reduce<number>(
      (m, x) => Math.max(m, gunFarki(x.createdAt, bugun)), 0,
    );

    return NextResponse.json({
      bekleyen,
      gecikmeGun: GECIKME_GUN,
      geciken,
      enEskiGun: bekleyenler.length ? enEski : null,
      items: talepler.map((t) => ({
        id: t.id,
        tur: t.tur,
        durum: t.durum,
        tarih: t.createdAt.toISOString(),
        // Kaç gündür beklediği her satırda: bayi hangisine önce
        // döneceğini görsün.
        bekleyenGun: gunFarki(t.createdAt, bugun),
        gecikti: t.durum === 'BEKLIYOR' && gunFarki(t.createdAt, bugun) >= GECIKME_GUN,
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
