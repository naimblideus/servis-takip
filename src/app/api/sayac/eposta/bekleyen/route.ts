import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { createReading, ReadingError } from '@/lib/readings';

/**
 * GET — otomatik işlenemeyen sayaç e-postaları.
 *
 * Kapsam bilinçli olarak GENİŞ: tenantId'si NULL olanlar da listelenir. Seri
 * eşleşmediğinde e-postanın hangi bayiye ait olduğu bilinmiyor; onları gizlersek
 * hiç kimse görmez ve sessizce birikirler. Ham metin kırpılarak gönderilir.
 */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const hepsi = new URL(req.url).searchParams.get('hepsi') === '1';

    const kayitlar = await prisma.counterEmail.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        ...(hepsi ? {} : { status: { in: ['BEKLIYOR', 'HATA'] } }),
      },
      orderBy: { receivedAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({
      items: kayitlar.map((k) => ({
        id: k.id,
        konu: k.subject,
        gonderen: k.fromAddress,
        seri: k.serial,
        siyah: k.parsedBlack,
        renkli: k.parsedColor,
        durum: k.status,
        hata: k.hata,
        tarih: k.receivedAt.toISOString(),
        // Ham metinden yalnızca bir parça: bayi "doğru yeri mi okumuş" diye bakabilsin
        onizleme: k.rawText.replace(/\s+/g, ' ').slice(0, 400),
      })),
      bekleyen: kayitlar.filter((k) => k.status === 'BEKLIYOR' || k.status === 'HATA').length,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

/** POST — elle işle: bayi cihazı seçip sayacı yazar. */
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const { id, deviceId, counterBlack, counterColor, reset, yoksay } = await req.json();

    const kayit = await prisma.counterEmail.findFirst({
      where: { id, OR: [{ tenantId }, { tenantId: null }] },
    });
    if (!kayit) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

    if (yoksay) {
      await prisma.counterEmail.update({ where: { id: kayit.id }, data: { status: 'ATLANDI' } });
      return NextResponse.json({ ok: true });
    }

    if (!deviceId) return NextResponse.json({ error: 'Cihaz seçilmedi' }, { status: 400 });
    // IDOR: cihaz bu bayiye mi ait?
    const cihaz = await prisma.device.findFirst({ where: { id: deviceId, tenantId }, select: { id: true } });
    if (!cihaz) return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });

    try {
      const r = await createReading({
        tenantId,
        deviceId,
        counterBlack: Number(counterBlack) || 0,
        counterColor: Number(counterColor) || 0,
        reset: !!reset,
      });
      await prisma.counterEmail.update({
        where: { id: kayit.id },
        data: { status: 'ISLENDI', readingId: r.reading.id, deviceId, tenantId, hata: null },
      });
      return NextResponse.json({ ok: true, uyari: r.warning ?? null });
    } catch (e: any) {
      if (e instanceof ReadingError) {
        return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      }
      throw e;
    }
  } catch (e) {
    return authErrorResponse(e);
  }
}
