import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { monthlyAmount, PLAN_PRICING } from '@/lib/plan-pricing';
import { SAYFA_UCRETLI_CIHAZ } from '@/lib/invoicing';
import { denemeKalanGun, gosterilecekPaket, platformOdeme } from '@/lib/abonelik';

export const dynamic = 'force-dynamic';

/**
 * GET /api/abonelik — bayinin kendi aboneliği (yalnız yönetici).
 *
 * Paket, bu ayın tutarı, abonelik faturaları ve nasıl ödeneceği. Tutar,
 * faturayı kesen fonksiyondan (monthlyAmount) — ekrandaki ile kesilen aynı.
 * Kod ve sayı döner; cümleyi ekran kurar.
 */
export async function GET() {
  try {
    const { tenantId } = await requireAdminUser();
    const [tenant, faturali, faturalar, ayar] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, plan: true, trialEndsAt: true, planEndDate: true },
      }),
      // Fiyatın saydığı cihaz: kiralık + kopya başı anlaşmalı (faturası kesilen). Tek tanım lib/invoicing.
      prisma.device.count({ where: { tenantId, ...SAYFA_UCRETLI_CIHAZ } }),
      prisma.tenantInvoice.findMany({
        where: { tenantId, status: { not: 'cancelled' } },
        orderBy: { period: 'desc' },
        take: 12,
        select: { id: true, invoiceNumber: true, period: true, totalAmount: true, status: true, dueDate: true, paidDate: true },
      }),
      prisma.platformSettings.findFirst({ select: { odemeIban: true, odemeHesapAdi: true, satisWhatsapp: true } }).catch(() => null),
    ]);
    if (!tenant) return ucHatasi('BAYI_BULUNAMADI', 404);

    const paket = gosterilecekPaket(tenant.plan);
    return NextResponse.json({
      bayi: tenant.name,
      plan: tenant.plan,
      denemeKalanGun: denemeKalanGun(tenant.plan, tenant.trialEndsAt, new Date()),
      trialEndsAt: tenant.trialEndsAt,
      planEndDate: tenant.planEndDate,
      faturaliCihaz: faturali,
      // Denemedeki bayiye Profesyonel'in tutarı: "deneme bitince ne öderim".
      tutarPaketi: paket,
      aylik: monthlyAmount(paket, faturali),
      paketler: Object.fromEntries(Object.entries(PLAN_PRICING).map(([k, v]) => [k, { ...v, aylik: monthlyAmount(k, faturali).amount }])),
      faturalar,
      odeme: platformOdeme(ayar),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
