import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildInvoiceForCustomerPeriod, periodOf } from '@/lib/invoicing';

// Vercel function timeout (saniye) — büyük tenant'lar için
export const maxDuration = 300;

// CRON_SECRET ile koruma (Vercel Cron: Authorization: Bearer <secret>)
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev ortamı: secret yoksa serbest
  const header = req.headers.get('authorization');
  const qp = new URL(req.url).searchParams.get('secret');
  return header === `Bearer ${secret}` || qp === secret;
}

// Tüm otomatik-faturalama açık tenant'ların müşterileri için dönem faturası üret (idempotent)
async function run(period: string, tenantId?: string) {
  const tenants = await prisma.tenant.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      autoInvoiceEnabled: true,
      ...(tenantId ? { id: tenantId } : {}),
    },
    select: { id: true, name: true },
  });

  const results: {
    tenantId: string;
    tenantName: string;
    invoices: number;
    total: number;
    errors: number;
  }[] = [];

  for (const tenant of tenants) {
    const customers = await prisma.customer.findMany({
      where: { tenantId: tenant.id },
      select: { id: true },
    });

    let invoices = 0;
    let total = 0;
    let errors = 0;

    for (const c of customers) {
      try {
        const inv = await buildInvoiceForCustomerPeriod(tenant.id, c.id, period, 'AUTO_MONTHLY');
        if (inv) {
          invoices++;
          total += Number(inv.totalAmount);
        }
      } catch (e: any) {
        errors++;
        console.error(`INVOICE CRON ERROR tenant=${tenant.id} customer=${c.id}:`, e?.message);
      }
    }

    results.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      invoices,
      total: Math.round(total * 100) / 100,
      errors,
    });
  }

  return results;
}

// Vercel Cron GET ile çağırır
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const period = new URL(req.url).searchParams.get('period') || periodOf();
  const results = await run(period);
  return NextResponse.json({ ok: true, period, tenants: results.length, results });
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
  const period = body.period || periodOf();
  const results = await run(period, body.tenantId);
  return NextResponse.json({ ok: true, period, tenants: results.length, results });
}
