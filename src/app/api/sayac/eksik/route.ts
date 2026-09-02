import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';

/**
 * GET /api/sayac/eksik — sayacı GELMEYEN kiralık cihazlar, müşteriye göre.
 *
 * Panel kartı ("Sayacı Gelmeyen Cihaz") buraya iner. Kart yalnız SAYI verir;
 * bayinin yapacağı iş "kimi arayacağım" — bu uç onu verir: müşteri, telefon,
 * hangi cihaz, en son ne zaman okunmuş.
 *
 * ÖLÇÜT panel kartıyla AYNI olmak zorunda: son okuması 35 günden eski ya da hiç
 * okunmamış kiralık cihaz. Kart 7 derken liste 12 gösterirse bayi ikisine de
 * güvenmez. Faturalama öncesi kontrol (invoices/preflight) farklı soruya cevap
 * verir ("bu dönem okundu mu"); o ölçüt ayın başında anlamsızdır, burada
 * kullanılmaz.
 */
// export DEGIL: Next.js route dosyasindan yalniz GET/POST/config disa aktarilabilir,
// baska export build'i kirar ("not a valid Route export field").
const ESIK_GUN = 35;

export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();
    const esik = new Date(Date.now() - ESIK_GUN * 24 * 60 * 60 * 1000);

    const cihazlar = await prisma.device.findMany({
      where: { tenantId, isRental: true },
      select: {
        id: true, brand: true, model: true, serialNo: true, location: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
    if (cihazlar.length === 0) {
      return NextResponse.json({ esikGun: ESIK_GUN, toplam: 0, kiralik: 0, musteriler: [] });
    }

    // Her cihazın SON okuması — tek sorgu, N+1 yok.
    const sonlar = await prisma.counterReading.groupBy({
      by: ['deviceId'],
      where: { tenantId, deviceId: { in: cihazlar.map((c) => c.id) } },
      _max: { readingDate: true },
    });
    const sonTarih = new Map(sonlar.map((s) => [s.deviceId, s._max.readingDate]));

    const eksik = cihazlar.filter((c) => {
      const t = sonTarih.get(c.id);
      return !t || t < esik;
    });

    // Müşteriye göre grupla: bayi "kimi arayacağım" diye bakar, cihaz cihaz değil.
    const harita = new Map<string, {
      id: string; name: string; phone: string;
      cihazlar: { id: string; ad: string; seri: string; yer: string | null; sonOkuma: string | null; gunOnce: number | null }[];
    }>();
    for (const c of eksik) {
      const m = c.customer;
      if (!m) continue;
      if (!harita.has(m.id)) harita.set(m.id, { id: m.id, name: m.name, phone: m.phone ?? '', cihazlar: [] });
      const t = sonTarih.get(c.id) ?? null;
      harita.get(m.id)!.cihazlar.push({
        id: c.id, ad: `${c.brand} ${c.model}`.trim(), seri: c.serialNo, yer: c.location ?? null,
        sonOkuma: t ? t.toISOString() : null,
        gunOnce: t ? Math.floor((Date.now() - t.getTime()) / 86_400_000) : null,
      });
    }

    // En çok eksik cihazı olan müşteri en üstte — aramaya oradan başlanır.
    const coll = new Intl.Collator('tr');
    const musteriler = [...harita.values()]
      .sort((a, b) => b.cihazlar.length - a.cihazlar.length || coll.compare(a.name, b.name));

    return NextResponse.json({ esikGun: ESIK_GUN, toplam: eksik.length, kiralik: cihazlar.length, musteriler });
  } catch (e) {
    return authErrorResponse(e);
  }
}
