import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { modelStats } from '@/lib/reliability';
import { csvMetni, csvSayi, csvBasliklari, csvDosyaAdi } from '@/lib/csv';

/**
 * MARKA / MODEL GÜVENİLİRLİĞİ.
 *
 * Bayi için: "hangi modeli almaya devam edeyim, hangisi başımı ağrıtıyor".
 * Aynı hesap, çok bayiye açıldığında ÜRETİCİYE satılan ürünün kendisidir —
 * bu yüzden tek bayide de aynı motorla çalışıyor (/api/oem/reliability).
 *
 * Yetersiz veride SAYI ÜRETİLMEZ; bunun yerine niçin üretilmediği yazılır.
 */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const months = Math.min(36, Math.max(3, Number(new URL(req.url).searchParams.get('months')) || 12));
    const { models } = await modelStats([tenantId], { months });

    const guvenilir = models.filter((m) => m.reliable);

    // CSV: "güvenilir mi" sütunu BİLEREK dışa da çıkıyor. Az cihazdan
    // çıkarılmış oran tabloya girince kaynağından koparılıyor ve kesin bilgi
    // gibi okunuyor — sütun, o satırın ne kadar taşıdığını söylüyor.
    if (new URL(req.url).searchParams.get('format') === 'csv') {
      const metin = csvMetni(
        ['Marka', 'Model', 'Cihaz', 'Yaşı bilinen', 'Ort. yaş (ay)', 'Cihaz başı yıllık arıza', 'Toplam arıza', 'Planlı bakım', 'Ort. parça maliyeti (₺)', 'İstatistik güvenilir mi', 'Not'],
        models.map((m) => [
          m.brand, m.model, m.deviceCount, m.withAge,
          m.avgAgeMonths === null ? '' : csvSayi(m.avgAgeMonths, 1),
          m.failuresPerDeviceYear === null ? '' : csvSayi(m.failuresPerDeviceYear, 2),
          m.totalFailures, m.totalPlanned,
          m.avgPartsCost === null ? '' : csvSayi(m.avgPartsCost),
          m.reliable ? 'evet' : 'hayır',
          m.note ?? '',
        ]),
      );
      return new NextResponse(metin, { headers: csvBasliklari(csvDosyaAdi('model-guvenilirlik', String(months) + 'ay')) });
    }

    return NextResponse.json({
      months,
      toplamModel: models.length,
      guvenilirModel: guvenilir.length,
      models,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
