import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { createReading, ReadingError } from '@/lib/readings';
import { SAYFA_UCRETLI_CIHAZ } from '@/lib/invoicing';
import { acikDonem, donemOkumaKosulu, kesimGunu } from '@/lib/fatura-donemi';

/** Tek istekte en çok satır. Ekran 150'lik parçalarla gönderir; 1.000 cihazlı hastane de tek turda biter. */
const TEK_ISTEK_SATIR = 300;

// GET /api/readings/bulk?customerId=... — Sayaç Turu listesi:
// müşterinin SAYFA BAŞI ÜCRETLİ cihazları (kiralık + kopya başı anlaşmalı müşteri
// makinesi; faturayla aynı kural, lib/invoicing SAYFA_UCRETLI_CIHAZ), kat/oda
// (location) sırasına dizili, son sayaç + bu FATURA DÖNEMİNDE okundu mu.
// Eskiden yalnız kiralık listeleniyordu: kopya başı anlaşmalı makine faturalanıyor
// ama turda hiç çıkmıyordu, sayacı ancak tek tek girilebiliyordu.
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const customerId = new URL(req.url).searchParams.get('customerId');
    if (!customerId) return NextResponse.json({ error: 'customerId zorunlu' }, { status: 400 });

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, name: true, phone: true },
    });
    if (!customer) return ucHatasi('MUSTERI_BULUNAMADI', 404);

    const devices = await prisma.device.findMany({
      where: { tenantId, customerId, ...SAYFA_UCRETLI_CIHAZ },
      select: {
        id: true, brand: true, model: true, serialNo: true, location: true,
        counterBlack: true, counterColor: true,
        includedColor: true, pricePerColor: true, overagePriceColor: true,
      },
    });

    // Bu FATURA DÖNEMİNDE okunmuş cihazlar — TOPLU (N+1 yok). Dönem İstanbul saati
    // ve bayinin kesim günüyle (lib/fatura-donemi); eskiden sunucunun takvim ayıydı:
    // kesim günü 3 olan bayide 1-2'sinde okunan sayaç "okunmadı" görünüyordu.
    // Zincirin başı (cihaz eklenirken ya da aktarımda yazılan başlangıç sayacı:
    // kapalı, fark 0) okuma sayılmaz; ay ortasında eklenen cihaz "okundu" görünüyordu.
    const ayar = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { invoiceDayOfMonth: true } });
    const donem = acikDonem(new Date(), kesimGunu(ayar?.invoiceDayOfMonth));
    const readThisPeriod = devices.length
      ? await prisma.counterReading.groupBy({
          by: ['deviceId'],
          where: { tenantId, deviceId: { in: devices.map((d) => d.id) }, NOT: { billed: true, deltaBlack: 0, deltaColor: 0 }, AND: [donemOkumaKosulu(donem)] },
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
      return ucHatasi('KAYDEDILECEK_SATIR_YOK', 400);
    }
    if (rows.length > TEK_ISTEK_SATIR) {
      return NextResponse.json({ error: `Tek seferde en fazla ${TEK_ISTEK_SATIR} cihaz` }, { status: 400 });
    }

    // Tenant'ı BİR KEZ çek, her satıra geçir (N+1 önle). Yalnız okumanın
    // kullandığı alanlar: satırın tamamı logoyu da taşır (2 MB'a kadar).
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, pricePerBlack: true, pricePerColor: true, invoiceDayOfMonth: true },
    });
    if (!tenant) return ucHatasi('TENANT_BULUNAMADI', 404);

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
