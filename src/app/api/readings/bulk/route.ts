import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { createReading, ReadingError } from '@/lib/readings';

// GET /api/readings/bulk?customerId=... — Sayaç Turu listesi:
// müşterinin KİRALIK cihazları, kat/oda (location) sırasına dizili, son sayaç + bu dönem okundu mu.
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const customerId = new URL(req.url).searchParams.get('customerId');
    if (!customerId) return NextResponse.json({ error: 'customerId zorunlu' }, { status: 400 });

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, name: true, phone: true },
    });
    if (!customer) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });

    const devices = await prisma.device.findMany({
      where: { tenantId, customerId, isRental: true },
      select: {
        id: true, brand: true, model: true, serialNo: true, location: true,
        counterBlack: true, counterColor: true,
        includedColor: true, pricePerColor: true, overagePriceColor: true,
      },
    });

    // Bu dönem (ay) okunmuş cihazlar — TOPLU (N+1 yok)
    const now = new Date();
    const pStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const pEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const readThisPeriod = devices.length
      ? await prisma.counterReading.groupBy({
          by: ['deviceId'],
          where: { tenantId, deviceId: { in: devices.map((d) => d.id) }, readingDate: { gte: pStart, lt: pEnd } },
          _max: { readingDate: true },
        })
      : [];
    const readMap = new Map(readThisPeriod.map((r) => [r.deviceId, r._max.readingDate]));

    // Kat/oda sırasına diz (konumu olmayanlar sona), sonra marka/model
    const coll = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });
    const rows = devices
      .map((d) => ({
        id: d.id,
        brand: d.brand,
        model: d.model,
        serialNo: d.serialNo,
        location: d.location || '',
        lastBlack: d.counterBlack,
        lastColor: d.counterColor,
        // Renkli sütunu yalnız renkli fiyatı/paketi tanımlı cihazlarda göster (gereksiz alan = kafa karışıklığı)
        hasColor: (d.includedColor ?? 0) > 0 || d.pricePerColor != null || d.overagePriceColor != null || (d.counterColor ?? 0) > 0,
        readAt: readMap.get(d.id) ?? null,
      }))
      .sort((a, b) => {
        if (!a.location && b.location) return 1;
        if (a.location && !b.location) return -1;
        const byLoc = coll.compare(a.location, b.location);
        return byLoc !== 0 ? byLoc : coll.compare(`${a.brand} ${a.model}`, `${b.brand} ${b.model}`);
      });

    return NextResponse.json({
      customer,
      devices: rows,
      alreadyRead: rows.filter((r) => r.readAt).length,
      total: rows.length,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// POST /api/readings/bulk — Sayaç Turu kaydet.
// SATIR BAZLI KISMİ BAŞARI: bir satır patlarsa (ör. sayaç düşük) diğerleri kaydedilmeye devam eder.
// Tek transaction KULLANILMAZ — 59 doğru okuma, 1 hatalı yüzünden iptal olmamalı.
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const { rows, includeMonthlyRent } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Kaydedilecek satır yok' }, { status: 400 });
    }
    if (rows.length > 300) {
      return NextResponse.json({ error: 'Tek seferde en fazla 300 cihaz' }, { status: 400 });
    }

    // Tenant'ı BİR KEZ çek, her satıra geçir (N+1 önle)
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: 'Tenant bulunamadı' }, { status: 404 });

    const results: any[] = [];
    let saved = 0, failed = 0, totalCost = 0;

    for (const r of rows) {
      const deviceId = r?.deviceId;
      try {
        const out = await createReading({
          tenantId,
          deviceId,
          counterBlack: Number(r.counterBlack),
          counterColor: Number(r.counterColor ?? 0),
          source: 'TOPLU',
          includeMonthlyRent: !!includeMonthlyRent,
          reset: !!r.reset,
          // Sebep istemciden gelir; gelmezse createReading güvenli tarafı
          // (CIHAZ_DEGISTI → delta 0) seçer.
          resetTur: r.resetTur,
        }, tenant);
        saved++;
        totalCost += out.calculatedCost || 0;
        results.push({
          deviceId, ok: true,
          deltaBlack: out.deltaBlack, deltaColor: out.deltaColor,
          cost: out.calculatedCost, warning: out.warning,
        });
      } catch (e: any) {
        failed++;
        const isKnown = e instanceof ReadingError;
        if (!isKnown) console.error('BULK READING ERROR:', deviceId, e?.message);
        results.push({
          deviceId, ok: false,
          code: isKnown ? e.code : 'ERROR',
          error: isKnown ? e.message : 'Kaydedilemedi',
        });
      }
    }

    return NextResponse.json({ ok: failed === 0, saved, failed, totalCost: Math.round(totalCost * 100) / 100, results });
  } catch (e) {
    return authErrorResponse(e);
  }
}
