import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { modelStats } from '@/lib/reliability';

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
