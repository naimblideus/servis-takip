import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { anomaliDegerlendir } from '@/lib/sayac-anomali';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sayac/supheli — FATURALANMAMIŞ okumalar içinde inandırıcı olmayanlar.
 *
 * ── NEDEN FATURADAN ÖNCE ─────────────────────────────────────────────────
 * Sayaç artık cihazın kendi e-postasından insansız geliyor. Yanlış bir sayı
 * girdiğinde onu durduracak hiçbir insan yok: okuma → delta → aşım → dönem
 * faturası → müşteri. Bu uç, o zincirin son insanlı noktasında duruyor:
 * bayi "fatura kes" demeden hemen önce "şu üç okuma tuhaf" diyor.
 *
 * Yanlış fatura teknik bir hata değil, GÜVEN kaybıdır — müşteri bir kez
 * fahiş fatura görürse sonraki her faturayı tartışır. Düzeltmenin maliyeti
 * burada bir tıklık, faturadan sonra bir müşteri.
 *
 * ── NEDEN VERİTABANINDA "ŞÜPHELİ" ALANI YOK ──────────────────────────────
 * Şüphe bir DURUM değil, o anki geçmişe göre verilen bir KARAR. Cihazın
 * geçmişi büyüdükçe aynı okuma normalleşebilir (ya da tersi). Alan olarak
 * saklansaydı, bayi bir okumayı düzelttikten sonra bile eski karar ekranda
 * kalırdı. Her seferinde yeniden hesaplanıyor.
 */
export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();

    // Faturalanmamış okumalar = bir sonraki faturaya girecek olanlar.
    // Faturalanmışa dokunmuyoruz: o para çoktan müşteriye gitti, burada
    // gösterilmesi bayiyi yapamayacağı bir iş için telaşlandırır.
    const bekleyen = await prisma.counterReading.findMany({
      where: { tenantId, billed: false, device: { isRental: true } },
      select: {
        id: true, deviceId: true, readingDate: true,
        counterBlack: true, counterColor: true,
        deltaBlack: true, deltaColor: true, calculatedCost: true, source: true,
        device: {
          select: {
            id: true, brand: true, model: true, serialNo: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { readingDate: 'desc' },
      take: 500,
    });
    if (bekleyen.length === 0) {
      return NextResponse.json({ toplam: 0, tutar: 0, okumalar: [] });
    }

    // Kıyas için geçmiş TEK sorguda — cihaz başına ayrı sorgu 1000'lik filoda
    // 1000 gidiş-geliş demek. Bir yıl yeterli: daha eskisi kararı değiştirmiyor.
    const cihazIds = [...new Set(bekleyen.map((o) => o.deviceId))];
    const birYilOnce = new Date(Date.now() - 400 * 86400000);
    const tumOkumalar = await prisma.counterReading.findMany({
      where: { tenantId, deviceId: { in: cihazIds }, readingDate: { gte: birYilOnce } },
      select: { deviceId: true, readingDate: true, counterBlack: true, counterColor: true },
      orderBy: { readingDate: 'asc' },
    });
    const cihazaGore = new Map<string, typeof tumOkumalar>();
    for (const o of tumOkumalar) {
      const l = cihazaGore.get(o.deviceId) ?? [];
      l.push(o);
      cihazaGore.set(o.deviceId, l);
    }

    const okumalar: {
      id: string; deviceId: string; brand: string; model: string; serialNo: string;
      musteriId: string | null; musteri: string; telefon: string;
      tarih: string; kaynak: string; sayfa: number; tutar: number;
      kat: number | null; gun: number; beklenen: number | null; aciklama: string;
    }[] = [];
    let tutar = 0;

    for (const o of bekleyen) {
      // Bu okumadan ÖNCEKİ noktalar — kıyas tabanı. Kendisi dahil edilirse
      // anomali kendi kendini normalleştirir.
      const hepsi = cihazaGore.get(o.deviceId) ?? [];
      const oncekiler = hepsi.filter((x) => x.readingDate < o.readingDate);
      const onceki = oncekiler[oncekiler.length - 1];
      const gecenGun = onceki
        ? (o.readingDate.getTime() - onceki.readingDate.getTime()) / 86400000
        : 1;

      const sonuc = anomaliDegerlendir(o.deltaBlack + o.deltaColor, gecenGun, oncekiler);
      if (!sonuc.supheli) continue;

      const okumaTutari = Number(o.calculatedCost);
      tutar += okumaTutari;
      okumalar.push({
        id: o.id, deviceId: o.deviceId,
        brand: o.device.brand, model: o.device.model, serialNo: o.device.serialNo,
        musteriId: o.device.customer?.id ?? null,
        musteri: o.device.customer?.name ?? 'Müşterisiz cihaz',
        telefon: o.device.customer?.phone ?? '',
        tarih: o.readingDate.toISOString(),
        kaynak: o.source,
        sayfa: sonuc.sayfa,
        tutar: Math.round(okumaTutari * 100) / 100,
        kat: sonuc.kat,
        // Beklenen sayfa AYNI süre üzerinden: aylık ortalamayla kıyaslamak
        // kısa aralıklı okumalarda kendi içinde tutarsız bir cümle üretiyordu.
        gun: sonuc.gun,
        beklenen: sonuc.beklenen,
        aciklama: sonuc.aciklama,
      });
    }

    // En çok para riski önce — bayi sırayla bakacak.
    okumalar.sort((a, b) => b.tutar - a.tutar);

    return NextResponse.json({
      toplam: okumalar.length,
      // Bu okumaların faturaya girecek tutarı. "Yanlış" demiyoruz — kontrol
      // edilmemiş diyoruz. Ayrım önemli: çoğu doğru çıkacak.
      tutar: Math.round(tutar * 100) / 100,
      okumalar,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
