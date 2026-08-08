import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendBulkWhatsApp, waConfigured, waApiPhone } from '@/lib/whatsapp';

export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL-CLOSED: CRON_SECRET yoksa erişimi REDDET
  const header = req.headers.get('authorization');
  const qp = new URL(req.url).searchParams.get('secret');
  return header === `Bearer ${secret}` || qp === secret;
}

/**
 * AYLIK SAYAÇ HATIRLATMA — faturalama döngüsünün başlangıcı.
 *
 * Sayacı okunmamış kiralık cihazı olan müşterilere WhatsApp'tan hatırlatma gider:
 * "sayaç fotoğrafını gönderir misiniz?". Gelen fotoğraf webhook'tan /whatsapp
 * gelen kutusuna düşer, bayi tek ekrandan cihaza işler. Böylece bayinin tek tek
 * gezmesi ya da telefonla kovalaması gerekmez.
 *
 * Bu PROAKTİF bir mesajdır → Meta ONAYLI ŞABLON zorunludur (serbest metin gidemez).
 * Şablon adı WHATSAPP_TEMPLATE_SAYAC ile verilir; yoksa iş sessizce atlanır.
 *
 * Şablon gövdesi şu değişkenleri beklemelidir:
 *   {{1}} müşteri adı   {{2}} okunmamış cihaz sayısı   {{3}} bayi adı
 */
async function run() {
  if (!waConfigured() || !process.env.WHATSAPP_TEMPLATE_SAYAC) {
    return { skipped: 'WhatsApp şablonu ayarlı değil (WHATSAPP_* / WHATSAPP_TEMPLATE_SAYAC)' };
  }

  // Bu ayın başı — dönem içinde okuma yapılmış mı diye bakacağız
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null, isActive: true, isSuspended: false },
    select: { id: true, name: true },
  });

  const results: { tenant: string; sent: number; failed: number; customers: number }[] = [];

  for (const t of tenants) {
    // Bu dönemde okuması OLMAYAN kiralık cihazlar
    const devices = await prisma.device.findMany({
      where: {
        tenantId: t.id,
        isRental: true,
        counterReadings: { none: { readingDate: { gte: periodStart } } },
      },
      select: { customerId: true },
    });
    if (devices.length === 0) continue;

    // Müşteri başına kaç cihaz bekliyor
    const perCustomer = new Map<string, number>();
    for (const d of devices) perCustomer.set(d.customerId, (perCustomer.get(d.customerId) || 0) + 1);

    const customers = await prisma.customer.findMany({
      where: { tenantId: t.id, id: { in: [...perCustomer.keys()] } },
      select: { id: true, name: true, phone: true },
    });

    const items = customers
      .filter(c => waApiPhone(c.phone))
      .map(c => ({
        phone: c.phone,
        params: [c.name, String(perCustomer.get(c.id) || 0), t.name],
      }));
    if (items.length === 0) continue;

    // Şablon adı AÇIKÇA veriliyor. Verilmezse borç hatırlatma şablonu giderdi.
    const r = await sendBulkWhatsApp(items, process.env.WHATSAPP_TEMPLATE_SAYAC);
    results.push({ tenant: t.name, sent: r.sent, failed: r.failed, customers: items.length });
  }

  return { period: periodStart.toISOString().slice(0, 7), results };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await run()) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Hata' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
