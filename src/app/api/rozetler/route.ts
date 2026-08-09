import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rozetler — menüdeki bekleyen-iş sayıları, TEK istekte.
 *
 * NEDEN TEK UÇ: kenar menü ve alt menü ayrı ayrı yoklama yapıyordu; her
 * rozet için bir uç daha açmak dakikada 3-4 istek demekti. Hepsi tek sorgu
 * kümesinde toplandı.
 *
 * NEDEN ROZET GEREKLİ: bunların üçü de KUYRUK. Görünmeyen kuyruk birikir —
 * sayaç e-postası birikirse ay sonunda eksik fatura kesilir, müşteri
 * bildirimi birikirse müşteri cevap alamaz. Sayı menüde durmalı.
 */
export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();

    const [tenant, satici, alici, sayacEposta, musteriBildirim] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { marketEnabled: true } }),
      prisma.marketOrder.count({ where: { sellerTenantId: tenantId, status: 'REQUESTED' } }),
      prisma.marketOrder.count({ where: { buyerTenantId: tenantId, status: 'SHIPPED' } }),
      prisma.counterEmail.count({ where: { tenantId, status: 'BEKLIYOR' } }),
      prisma.portalRequest.count({ where: { tenantId, durum: 'BEKLIYOR' } }),
    ]);

    return NextResponse.json({
      // Pazara katılmamış bayide sipariş rozeti anlamsız
      market: tenant?.marketEnabled ? satici + alici : 0,
      sayacEposta,
      musteriBildirim,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
