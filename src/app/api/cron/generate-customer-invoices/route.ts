import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildInvoiceForCustomerPeriod } from '@/lib/invoicing';
import { tekSeferlik } from '@/lib/zamanlanmis-is';
import { gecerliDonem, kapananDonem, kesimGunu } from '@/lib/fatura-donemi';
import { kosuDonemiKapatir, kosuyuKaydet } from '@/lib/fatura-turu';

// Vercel function timeout (saniye) — büyük tenant'lar için
export const maxDuration = 300;

/**
 * KAPANMIŞ dönemi faturala — bugünün dönemini DEĞİL.
 *
 * Cron ayın 1'inde 06:00'da çalışıyor (`0 6 1 * *`). Varsayılan dönem
 * `periodOf()` yani BUGÜNÜN dönemiydi: 1 Ekim'de "2026-10" faturalanıyordu.
 * Fatura ise yalnız `readingDate >= 1 Ekim && < 1 Kasım` aralığındaki
 * okumaları alıyor (invoicing.ts periodRange) — o pencerede daha hiç okuma
 * yok. Sonuç: EYLÜL boyunca okunan bütün sayaçlar `billed:false` kalıyor ve
 * bir sonraki ay da kendi penceresine bakacağı için o gelir BİR DAHA HİÇ
 * faturalanmıyordu. Bayinin ayın tüm sayaç geliri sessizce kayboluyordu.
 *
 * Doğrusu: ay kapandığında KAPANAN ayı faturalamak. Kira da o döneme yazılır,
 * yani fatura "geçen ayın kirası + geçen ayın aşımı" olur — dönem sonu
 * faturalama. Elle tetikte `period` verilirse o kullanılır, bu yalnız
 * varsayılan.
 *
 * Kapanan dönem artık İSTANBUL saatine ve bayinin kesim gününe göre
 * (lib/fatura-donemi kapananDonem); bayi bayi hesaplanır. Koşu bitince
 * FaturaTuru'na yazılır: dönem TAMAM olur, o aya düşen geç okumalar bir
 * sonraki açık döneme kayar (kaybolmasın) ve müşteri başına hatalar sunucu
 * günlüğünde kaybolmaz.
 */

// CRON_SECRET ile koruma (Vercel Cron: Authorization: Bearer <secret>)
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // FAIL-CLOSED: CRON_SECRET yoksa erişimi REDDET (asla open)
  const header = req.headers.get('authorization');
  const qp = new URL(req.url).searchParams.get('secret');
  return header === `Bearer ${secret}` || qp === secret;
}

// Tüm otomatik-faturalama açık tenant'ların müşterileri için dönem faturası üret (idempotent)
async function run(elleDonem: string | null, tenantId?: string) {
  const tenants = await prisma.tenant.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      autoInvoiceEnabled: true,
      ...(tenantId ? { id: tenantId } : {}),
    },
    select: { id: true, name: true, invoiceDayOfMonth: true },
  });

  const results: {
    tenantId: string;
    tenantName: string;
    period: string;
    invoices: number;
    total: number;
    errors: number;
  }[] = [];

  for (const tenant of tenants) {
    const kesim = kesimGunu(tenant.invoiceDayOfMonth);
    const period = elleDonem ?? kapananDonem(new Date(), kesim);
    const customers = await prisma.customer.findMany({
      where: { tenantId: tenant.id },
      select: { id: true },
    });

    let invoices = 0;
    let total = 0;
    const hatalar: { customerId: string; hata: string }[] = [];

    for (const c of customers) {
      try {
        const inv = await buildInvoiceForCustomerPeriod(tenant.id, c.id, period, 'AUTO_MONTHLY');
        if (inv) {
          invoices++;
          total += Number(inv.totalAmount);
        }
      } catch (e: any) {
        hatalar.push({ customerId: c.id, hata: String(e?.message ?? e).slice(0, 300) });
        console.error(`INVOICE CRON ERROR tenant=${tenant.id} customer=${c.id}:`, e?.message);
      }
    }

    const toplam = Math.round(total * 100) / 100;
    try {
      await kosuyuKaydet(tenant.id, period, 'CRON',
        { faturaSayisi: invoices, toplam, hataSayisi: hatalar.length, hatalar },
        kosuDonemiKapatir(period, kesim));
    } catch (e: any) {
      console.error(`FATURA TURU KAYIT HATASI tenant=${tenant.id}:`, e?.message);
    }

    results.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      period,
      invoices,
      total: toplam,
      errors: hatalar.length,
    });
  }

  return results;
}

// Vercel Cron GET ile çağırır
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const verilen = new URL(req.url).searchParams.get('period');
  if (verilen && !gecerliDonem(verilen)) return NextResponse.json({ error: 'GECERSIZ_DONEM' }, { status: 400 });
  const elle = verilen || null;
  const calistir = async () => {
    const results = await run(elle);
    return NextResponse.json({ ok: true, period: elle ?? 'kapanan', tenants: results.length, results });
  };
  return elle ? calistir() : tekSeferlik(req, 'faturalar', 'aylik', calistir);
}

// Manuel tetik (admin) — body: { period?, tenantId? }
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* boş body */
  }
  if (body.period && !gecerliDonem(body.period)) return NextResponse.json({ error: 'GECERSIZ_DONEM' }, { status: 400 });
  const results = await run(body.period || null, body.tenantId);
  return NextResponse.json({ ok: true, period: body.period || 'kapanan', tenants: results.length, results });
}
