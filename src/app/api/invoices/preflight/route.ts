import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { periodOf } from '@/lib/invoicing';

// GET /api/invoices/preflight?period=YYYY-MM
// FATURA ÖNCESİ SAYAÇ ÖN KONTROLÜ: bu dönem sayacı HİÇ okunmamış kiralık cihazlar.
// Amaç: eksik giden aşım faturasını (yanan para) faturalamadan ÖNCE yakalamak.
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const period = new URL(req.url).searchParams.get('period') || periodOf();

    const [y, m] = period.split('-').map(Number);
    if (!y || !m || m < 1 || m > 12) {
      return NextResponse.json({ error: 'Geçersiz dönem' }, { status: 400 });
    }
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0, 0);

    // Kiralık cihazlar (fatura yalnız bunlarda sayaç bekler)
    const devices = await prisma.device.findMany({
      where: { tenantId, isRental: true },
      select: {
        id: true, brand: true, model: true, location: true, serialNo: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
    if (devices.length === 0) {
      return NextResponse.json({ period, missingCount: 0, customerCount: 0, totalRental: 0, customers: [] });
    }

    // Bu dönemde okuması OLAN cihazlar — TOPLU (N+1 yok)
    const read = await prisma.counterReading.groupBy({
      by: ['deviceId'],
      where: { tenantId, deviceId: { in: devices.map((d) => d.id) }, readingDate: { gte: start, lt: end } },
    });
    const readSet = new Set(read.map((r) => r.deviceId));

    const missing = devices.filter((d) => !readSet.has(d.id));

    // Müşteriye göre grupla (bayi "kimde eksik" diye bakar)
    const byCustomer = new Map<string, { id: string; name: string; phone: string; devices: any[] }>();
    for (const d of missing) {
      const c = d.customer;
      if (!c) continue;
      if (!byCustomer.has(c.id)) byCustomer.set(c.id, { id: c.id, name: c.name, phone: c.phone || '', devices: [] });
      byCustomer.get(c.id)!.devices.push({
        id: d.id, brand: d.brand, model: d.model, serialNo: d.serialNo, location: d.location || null,
      });
    }

    const coll = new Intl.Collator('tr');
    const customers = Array.from(byCustomer.values()).sort((a, b) => coll.compare(a.name, b.name));

    return NextResponse.json({
      period,
      missingCount: missing.length,
      customerCount: customers.length,
      totalRental: devices.length,
      customers,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
