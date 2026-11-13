import { SAYFA_UCRETLI_CIHAZ } from '@/lib/invoicing';
import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import { acikDonem, donemOkumaKosulu, gecerliDonem, kapananDonem, kesimGunu, varsayilanElleDonem } from '@/lib/fatura-donemi';
import { kiraSartiEksik, KIRA_EKSIK_LISTE_AZAMI } from '@/lib/kira-sarti';

// GET /api/invoices/preflight?period=YYYY-MM
// FATURA ÖNCESİ SAYAÇ ÖN KONTROLÜ: bu dönem sayacı HİÇ okunmamış kiralık cihazlar.
// Amaç: eksik giden aşım faturasını (yanan para) faturalamadan ÖNCE yakalamak.
export async function GET(req: NextRequest) {
  // MALI VERI: yalniz yonetici. Menude gizlemek yetkilendirme degildir;
  // teknisyen adresi elle yazip butun musterilerin borcunu okuyabiliyordu.
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    // Dönem faturalama ucuyla AYNI kuraldan (lib/fatura-donemi): ekran hangi ayı
    // keseceğini gösterir, bayi kapanan ay ile bu ay arasında seçebilir.
    const ayar = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { invoiceDayOfMonth: true } });
    const kesim = kesimGunu(ayar?.invoiceDayOfMonth);
    const simdi = new Date();
    const secenekler = { kapanan: kapananDonem(simdi, kesim), acik: acikDonem(simdi, kesim) };
    const period = new URL(req.url).searchParams.get('period') || varsayilanElleDonem(simdi, kesim);
    if (!gecerliDonem(period)) {
      return ucHatasi('GECERSIZ_DONEM', 400);
    }

    // Sayfa başı ücretli cihazlar (kiralık + kopya başı anlaşmalı müşteri makinesi):
    // fatura bunlarda sayaç bekler (lib/invoicing SAYFA_UCRETLI_CIHAZ). Eskiden
    // yalnız kiralık bakılıyordu; kopya başı makinenin okunmayan sayacı uyarısız kalıyordu.
    const devices = await prisma.device.findMany({
      where: { tenantId, ...SAYFA_UCRETLI_CIHAZ },
      select: {
        id: true, brand: true, model: true, location: true, serialNo: true,
        monthlyRent: true, pricePerBlack: true, pricePerColor: true, overagePriceBlack: true, overagePriceColor: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
    if (devices.length === 0) {
      return NextResponse.json({ period, secenekler, missingCount: 0, customerCount: 0, totalRental: 0, customers: [], kiraEksik: [], kiraEksikSayisi: 0 });
    }

    // KİRA BİLGİSİ EKSİK kiralık cihazlar (lib/kira-sarti): sahada "kiralık"
    // diye tanımlanmış ama kirası girilmemiş cihazdan sabit kira çıkmaz.
    // Faturalar ekranı bunları yerinde doldurtur.
    const kiraEksikHepsi = devices.filter(kiraSartiEksik);
    const kiraEksik = kiraEksikHepsi.slice(0, KIRA_EKSIK_LISTE_AZAMI).map((d) => ({
      id: d.id, brand: d.brand, model: d.model, serialNo: d.serialNo, musteri: d.customer?.name ?? '',
    }));

    // Bu dönemde okuması OLAN cihazlar — TOPLU (N+1 yok)
    const read = await prisma.counterReading.groupBy({
      by: ['deviceId'],
      where: {
        tenantId, deviceId: { in: devices.map((d) => d.id) },
        // Zincirin başı (cihaz eklenirken / aktarımda yazılan başlangıç sayacı:
        // kapalı, fark 0) okuma sayılmaz: ay ortasında eklenen cihaz "okundu" görünüyordu.
        NOT: { billed: true, deltaBlack: 0, deltaColor: 0 },
        AND: [donemOkumaKosulu(period)],
      },
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
      secenekler,
      missingCount: missing.length,
      customerCount: customers.length,
      totalRental: devices.length,
      customers,
      kiraEksik,
      kiraEksikSayisi: kiraEksikHepsi.length,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
