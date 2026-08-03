import { NextResponse } from 'next/server';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { prisma } from '@/lib/prisma';
import { MIN_TENANTS_FOR_OEM } from '@/lib/reliability';

/**
 * VERİ KAPSAMI — ağın veri üretip üretmediğini gösteren panel.
 *
 * Neden süper-adminde: veri katmanının değeri cihaz sayısıyla değil KAPSAMLA büyür.
 * 100.000 cihaz × %5 kategori = çöp; 30.000 cihaz × %80 = ürün.
 * Bu panel "hangi bayi veri üretiyor, hangisi üretmiyor" sorusunu cevaplar ve
 * üretici ürününün ne zaman mümkün olacağını (k-anonimlik) ölçer.
 */
export async function GET() {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const satirlar = await Promise.all(tenants.map(async (t) => {
      const [cihaz, yasli, bilinmeyenYas, fis, kategorili, parca, oemli, sayacliGrup, fissizCihaz] = await Promise.all([
        prisma.device.count({ where: { tenantId: t.id } }),
        prisma.device.count({ where: { tenantId: t.id, installedAt: { not: null } } }),
        prisma.device.count({ where: { tenantId: t.id, installDateUnknown: true } }),
        prisma.serviceTicket.count({ where: { tenantId: t.id, deletedAt: null, createdAt: { gte: since } } }),
        prisma.serviceTicket.count({ where: { tenantId: t.id, deletedAt: null, createdAt: { gte: since }, faultCategory: { not: null } } }),
        prisma.part.count({ where: { tenantId: t.id } }),
        prisma.part.count({ where: { tenantId: t.id, oemCode: { not: null } } }),
        prisma.counterReading.groupBy({ by: ['deviceId'], where: { tenantId: t.id } }),
        // Hiç fişi olmayan cihaz — PAYDA sağlığı. Yüksekse cihazlar arızadan
        // bağımsız kaydediliyor demektir ve arıza oranı hesaplanabilir.
        prisma.device.count({ where: { tenantId: t.id, serviceTickets: { none: {} } } }),
      ]);

      const oran = (n: number, t2: number) => (t2 ? Math.round((n / t2) * 100) : 0);
      // Kategori kapsamı en kritik olan; ağırlıklı basit skor
      const skor = Math.round(
        oran(kategorili, fis) * 0.4 +
        oran(yasli + bilinmeyenYas, cihaz) * 0.3 +
        oran(sayacliGrup.length, cihaz) * 0.2 +
        oran(oemli, parca) * 0.1,
      );

      return {
        id: t.id,
        ad: t.name,
        katilim: t.createdAt,
        cihaz,
        fis12Ay: fis,
        kategoriPct: oran(kategorili, fis),
        // "bilmiyorum" işaretlenenler de cevaplanmış sayılır (soru kapandı)
        yasPct: oran(yasli + bilinmeyenYas, cihaz),
        sayacPct: oran(sayacliGrup.length, cihaz),
        oemPct: oran(oemli, parca),
        paydaPct: oran(fissizCihaz, cihaz),
        skor,
      };
    }));

    // ── Ağ geneli + üretici ürünü hazırlığı (k-anonimlik) ──
    const tumCihaz = await prisma.device.findMany({ select: { brand: true, model: true, tenantId: true } });
    const modelBayi = new Map<string, Set<string>>();
    tumCihaz.forEach((d) => {
      const k = `${d.brand}|||${d.model}`;
      if (!modelBayi.has(k)) modelBayi.set(k, new Set());
      modelBayi.get(k)!.add(d.tenantId);
    });
    const esigiGecen = [...modelBayi.values()].filter((s) => s.size >= MIN_TENANTS_FOR_OEM).length;

    const topla = (f: (r: typeof satirlar[number]) => number, w: (r: typeof satirlar[number]) => number) => {
      const agirlik = satirlar.reduce((s, r) => s + w(r), 0);
      return agirlik ? Math.round(satirlar.reduce((s, r) => s + f(r) * w(r), 0) / agirlik) : 0;
    };

    return NextResponse.json({
      ag: {
        bayi: tenants.length,
        cihaz: tumCihaz.length,
        fis12Ay: satirlar.reduce((s, r) => s + r.fis12Ay, 0),
        // ağırlıklı ortalamalar (büyük bayi daha çok etkiler)
        kategoriPct: topla((r) => r.kategoriPct, (r) => r.fis12Ay),
        yasPct: topla((r) => r.yasPct, (r) => r.cihaz),
        sayacPct: topla((r) => r.sayacPct, (r) => r.cihaz),
        model: modelBayi.size,
        esigiGecenModel: esigiGecen,
        kEsigi: MIN_TENANTS_FOR_OEM,
      },
      satirlar: satirlar.sort((a, b) => b.cihaz - a.cihaz),
    });
  } catch (e: any) {
    console.error('DATA COVERAGE ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
