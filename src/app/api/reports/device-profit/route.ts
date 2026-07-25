import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';

// CİHAZ KÂRLILIĞI — kiralık cihaz başına gelir vs. maliyet (son N ay).
// GELİR  : o cihaza ait fatura satırları (kira + sayaç aşımı)
// MALİYET: o cihaza açılan fişlerde kullanılan parçaların ALIŞ fiyatı (satış değil!)
// NOT: ziyaret/işçilik maliyeti için uydurma sabit KOYULMAZ — veri yoksa gösterilmez.
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const months = Math.min(24, Math.max(1, Number(new URL(req.url).searchParams.get('months')) || 6));

    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1, 0, 0, 0, 0);

    const devices = await prisma.device.findMany({
      where: { tenantId, isRental: true },
      select: {
        id: true, brand: true, model: true, serialNo: true, location: true, monthlyRent: true,
        customer: { select: { id: true, name: true } },
      },
    });
    if (devices.length === 0) {
      return NextResponse.json({ months, since: since.toISOString(), devices: [], warnings: { zeroBuyPrice: 0 }, totals: { revenue: 0, cost: 0, net: 0 } });
    }
    const deviceIds = devices.map((d) => d.id);

    // GELİR: fatura satırları (silinmemiş faturalar, dönem içinde)
    const revenueRows = await prisma.invoiceLine.groupBy({
      by: ['deviceId'],
      where: {
        tenantId,
        deviceId: { in: deviceIds },
        kind: { in: ['RENTAL', 'COUNTER'] },
        invoice: { deletedAt: null, invoiceDate: { gte: since } },
      },
      _sum: { lineTotal: true },
    });
    const revenueMap = new Map(revenueRows.map((r) => [r.deviceId!, Number(r._sum.lineTotal || 0)]));

    // MALİYET: cihaza açılan fişlerdeki parçalar — ALIŞ fiyatı üzerinden
    const parts = await prisma.ticketPart.findMany({
      where: {
        tenantId,
        ticket: { deviceId: { in: deviceIds }, deletedAt: null, createdAt: { gte: since } },
      },
      select: {
        quantity: true,
        ticket: { select: { deviceId: true } },
        part: { select: { buyPrice: true } },
      },
    });

    const costMap = new Map<string, number>();
    let zeroBuyPrice = 0;
    for (const p of parts) {
      const did = p.ticket?.deviceId;
      if (!did) continue;
      const buy = Number(p.part?.buyPrice || 0);
      if (buy <= 0) zeroBuyPrice++;
      costMap.set(did, (costMap.get(did) || 0) + buy * p.quantity);
    }

    // Ziyaret sayısı (bilgi amaçlı — maliyete DAHİL EDİLMEZ)
    const visits = await prisma.serviceTicket.groupBy({
      by: ['deviceId'],
      where: { tenantId, deviceId: { in: deviceIds }, deletedAt: null, createdAt: { gte: since } },
      _count: { _all: true },
    });
    const visitMap = new Map(visits.map((v) => [v.deviceId, v._count._all]));

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const rows = devices.map((d) => {
      const revenue = r2(revenueMap.get(d.id) || 0);
      const cost = r2(costMap.get(d.id) || 0);
      return {
        id: d.id,
        device: `${d.brand} ${d.model}`,
        serialNo: d.serialNo,
        location: d.location || null,
        customerId: d.customer?.id || null,
        customerName: d.customer?.name || '—',
        monthlyRent: Number(d.monthlyRent || 0),
        revenue,
        cost,
        net: r2(revenue - cost),
        visits: visitMap.get(d.id) || 0,
      };
    }).sort((a, b) => a.net - b.net); // zarar edenler ÜSTTE

    return NextResponse.json({
      months,
      since: since.toISOString(),
      devices: rows,
      warnings: { zeroBuyPrice },
      totals: {
        revenue: r2(rows.reduce((s, x) => s + x.revenue, 0)),
        cost: r2(rows.reduce((s, x) => s + x.cost, 0)),
        net: r2(rows.reduce((s, x) => s + x.net, 0)),
        losing: rows.filter((x) => x.net < 0).length,
      },
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
