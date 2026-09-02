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

    // ── Cihaz önerisi ────────────────────────────────────────────────────
    // Seri eşleşmediğinde bayi, yüzlerce cihaz arasından doğrusunu ARAMAK
    // zorunda kalıyordu; kiralık filoda bu iş yapılmıyor, kayıt kuyrukta
    // kalıyor. Eşleşmeme sebebi neredeyse her zaman TEK KARAKTER: O/0, I/1,
    // S/5, B/8. Karışan karakterleri aynı sayıya indirip karşılaştırıyoruz.
    const seriliVar = kayitlar.some((k) => k.serial && !k.deviceId);
    const cihazlar = seriliVar
      ? await prisma.device.findMany({
          where: { tenantId },
          select: { id: true, serialNo: true, brand: true, model: true, customer: { select: { name: true } } },
        })
      : [];

    /** Karışan karakterleri tek biçime indirger — O ve 0 aynı sayılır. */
    const sadelestir = (s: string) => s.toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/[O]/g, '0').replace(/[IL]/g, '1').replace(/[S]/g, '5')
      .replace(/[B]/g, '8').replace(/[Z]/g, '2').replace(/[G]/g, '6');

    const oneriBul = (seri: string | null) => {
      if (!seri || cihazlar.length === 0) return null;
      const hedef = sadelestir(seri);
      for (const c of cihazlar) {
        if (sadelestir(c.serialNo) === hedef) {
          return {
            deviceId: c.id, serialNo: c.serialNo,
            etiket: `${c.brand} ${c.model}`.trim(), musteri: c.customer?.name ?? null,
            neden: c.serialNo === seri ? 'seri birebir aynı' : 'karışan karakter farkı (O/0, I/1, S/5)',
          };
        }
      }
      return null;
    };

    return NextResponse.json({
      items: kayitlar.map((k) => ({
        oneri: k.deviceId ? null : oneriBul(k.serial),
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
    const cihaz = await prisma.device.findFirst({
      where: { id: deviceId, tenantId },
      select: { id: true, serialNo: true, reportedSerial: true },
    });
    if (!cihaz) return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });

    try {
      const r = await createReading({
        tenantId,
        deviceId,
        counterBlack: Number(counterBlack) || 0,
        counterColor: Number(counterColor) || 0,
        reset: !!reset,
        // Bayi elle eşleştirdi ama SAYI cihazın kendi raporundan geliyor.
        source: 'CIHAZ_EPOSTA',
      });
      await prisma.counterEmail.update({
        where: { id: kayit.id },
        data: { status: 'ISLENDI', readingId: r.reading.id, deviceId, tenantId, hata: null },
      });

      // ── ÖĞREN: bir daha elle eşleştirilmesin ──────────────────────────
      // E-postadaki seri cihazın kaydından farklıysa fark kalıcıdır: ya seri
      // yanlış girilmiştir ya da cihaz iç serisini yazıyor. Öğrenmezsek bayi
      // AYNI cihazı her ay elle eşleştirir — kiralık filoda bu, otomasyonun
      // hiç olmaması demek. serialNo'ya dokunmuyoruz; o etiketteki değer ve
      // teknisyen sahada onu okuyor.
      let ogrenildi: string | null = null;
      if (kayit.serial && kayit.serial !== cihaz.serialNo && kayit.serial !== cihaz.reportedSerial) {
        await prisma.device.update({ where: { id: cihaz.id }, data: { reportedSerial: kayit.serial } });
        ogrenildi = kayit.serial;
      }

      return NextResponse.json({ ok: true, uyari: r.warning ?? null, ogrenildi });
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
