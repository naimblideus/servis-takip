import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { counterOverage } from '@/lib/invoicing';
import { oturumKullanicisi } from '@/lib/api-auth';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// GET /api/revenue-risk — bu dönem KAZANILMIŞ ama HENÜZ FATURALANMAMIŞ gelir:
//  (a) okundu ama faturalanmamış sayaç (aşım tutarı)  (b) bu dönem kirası kesilmemiş kiralık cihazlar
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await oturumKullanicisi(session);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { pricePerBlack: true, pricePerColor: true },
  });
  if (!tenant) return NextResponse.json({ error: 'Tenant bulunamadı' }, { status: 404 });

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const devices = await prisma.device.findMany({
    where: { tenantId: user.tenantId, isRental: true },
    include: { customer: { select: { id: true, name: true, phone: true, address: true } } },
  });
  const ids = devices.map((d) => d.id);

  // Bu dönem faturalanmamış okumalar (tek sorgu, JS'te grupla)
  const readings = ids.length
    ? await prisma.counterReading.findMany({
        where: { tenantId: user.tenantId, deviceId: { in: ids }, billed: false, readingDate: { gte: start, lt: end } },
        select: { deviceId: true, deltaBlack: true, deltaColor: true },
      })
    : [];
  const sums = new Map<string, { b: number; c: number }>();
  for (const r of readings) {
    const s = sums.get(r.deviceId) || { b: 0, c: 0 };
    s.b += r.deltaBlack; s.c += r.deltaColor;
    sums.set(r.deviceId, s);
  }

  // Bu dönemde daha önce faturalanmış sayfalar — dahil paketin kümülatif (mükerrer indirimsiz) hesabı için
  const billedReadings = ids.length
    ? await prisma.counterReading.findMany({
        where: { tenantId: user.tenantId, deviceId: { in: ids }, billed: true, readingDate: { gte: start, lt: end } },
        select: { deviceId: true, deltaBlack: true, deltaColor: true },
      })
    : [];
  const prevSums = new Map<string, { b: number; c: number }>();
  for (const r of billedReadings) {
    const s = prevSums.get(r.deviceId) || { b: 0, c: 0 };
    s.b += r.deltaBlack; s.c += r.deltaColor;
    prevSums.set(r.deviceId, s);
  }

  const items: any[] = [];
  let counterTotal = 0;
  let rentTotal = 0;
  const affectedCustomers = new Set<string>();

  for (const d of devices) {
    const s = sums.get(d.id) || { b: 0, c: 0 };
    const prev = prevSums.get(d.id) || { b: 0, c: 0 };
    const ch = counterOverage(d, s.b, s.c, tenant, prev.b, prev.c);
    const counterAmount = ch.total; // aşım tutarı (dahil paket düşülmüş)
    const rentUncut = Number(d.monthlyRent) > 0 && d.lastInvoicedPeriod !== period;
    const rentAmount = rentUncut ? round2(Number(d.monthlyRent)) : 0;
    if (counterAmount <= 0 && rentAmount <= 0) continue;

    counterTotal += counterAmount;
    rentTotal += rentAmount;
    if (d.customer) affectedCustomers.add(d.customer.id);
    items.push({
      id: d.id, brand: d.brand, model: d.model, serialNo: d.serialNo, location: d.location,
      customer: d.customer,
      counterAmount: round2(counterAmount),
      billBlack: ch.billB, billColor: ch.billC,
      rentAmount,
      total: round2(counterAmount + rentAmount),
    });
  }

  items.sort((a, b) => b.total - a.total);

  // ── GEÇMİŞ DÖNEMDE UNUTULMUŞ OKUMALAR ─────────────────────────────────
  // Her iki para yolu da (invoicing.ts ve period-charges.ts) okumaları
  // [dönem başı, dönem sonu) ile süzüyor. Doğru bir kural: kapanmış ayın
  // parası o ayın faturasına yazılır. Ama bir okuma o ay faturalanmadan
  // kaldıysa (sunucu kapalıydı, bayi o ay hiç faturalamadı, cihaz yeni
  // bağlandı) BİR DAHA hiçbir turun kapsamına girmiyor: sonraki aylar
  // yalnız kendi dönemlerine bakıyor. Sessiz ve KALICI kayıp.
  //
  // Ölçüldü: gerçek bir bayide 2026-02'den kalmış ₺2.900'lük iki okuma
  // vardı; ekran "bu dönem" gösterdiği için görünmüyordu bile.
  //
  // Burada faturalamıyoruz — dönem muhasebesini bozmamak için. Geçmiş ayın
  // sayfaları o ayın dahil paketiyle hesaplanmalı; bu ayın faturasına
  // eklemek hem kendi ayının paketini yer hem de tutarı kaydırır.
  // Yapılan şey: bayiye GÖSTERMEK. Faturalama ucu zaten dönem alıyor, o
  // dönemi tek düğmeyle kesebiliyor.
  const gecmisOkumalar = ids.length
    ? await prisma.counterReading.findMany({
        where: { tenantId: user.tenantId, deviceId: { in: ids }, billed: false, readingDate: { lt: start } },
        select: { readingDate: true, calculatedCost: true, deviceId: true },
      })
    : [];
  const gecmisHarita = new Map<string, { okuma: number; tutar: number; cihazlar: Set<string> }>();
  for (const r of gecmisOkumalar) {
    const dnm = `${r.readingDate.getFullYear()}-${String(r.readingDate.getMonth() + 1).padStart(2, '0')}`;
    const g = gecmisHarita.get(dnm) ?? { okuma: 0, tutar: 0, cihazlar: new Set<string>() };
    g.okuma++;
    g.tutar += Number(r.calculatedCost);
    g.cihazlar.add(r.deviceId);
    gecmisHarita.set(dnm, g);
  }
  const gecmisDonemler = [...gecmisHarita.entries()]
    .map(([donem, g]) => ({ donem, okuma: g.okuma, cihaz: g.cihazlar.size, tutar: round2(g.tutar) }))
    .sort((a, b) => (a.donem < b.donem ? 1 : -1));   // en yeni ay önce

  return NextResponse.json({
    period,
    items,
    gecmisDonemler,
    gecmisToplam: round2(gecmisDonemler.reduce((a, g) => a + g.tutar, 0)),
    summary: {
      counterTotal: round2(counterTotal),
      rentTotal: round2(rentTotal),
      grandTotal: round2(counterTotal + rentTotal),
      deviceCount: items.length,
      customerCount: affectedCustomers.size,
    },
  });
}
