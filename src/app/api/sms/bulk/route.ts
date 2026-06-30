import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { sendBulkSms, smsConfigured, netgsmPhone } from '@/lib/sms';

// POST /api/sms/bulk — Seçili müşterilere TEK TIKLA toplu (kişiselleştirilmiş) SMS.
// Güvenlik: müşteriler TENANT-scoped çekilir, mesaj SUNUCUDA şablondan üretilir (istemci tamper edemez).
// Değişkenler: {ad} {borç} {telefon}
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    if (!smsConfigured()) {
      return NextResponse.json({ error: 'SMS sağlayıcı ayarlı değil. Yönetici NETGSM_USER/PASS/HEADER eklemeli.' }, { status: 503 });
    }

    const { customerIds, template } = await req.json();
    if (!Array.isArray(customerIds) || customerIds.length === 0 || typeof template !== 'string' || !template.trim()) {
      return NextResponse.json({ error: 'customerIds ve template zorunlu' }, { status: 400 });
    }
    if (customerIds.length > 500) {
      return NextResponse.json({ error: 'Tek seferde en fazla 500 alıcı' }, { status: 400 });
    }

    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds }, tenantId }, // tenant guard
      select: { id: true, name: true, phone: true },
    });

    // Bakiye (borç) = AccountEntry SALE - PAYMENT
    const grouped = await prisma.accountEntry.groupBy({
      by: ['customerId', 'type'],
      where: { tenantId, customerId: { in: customers.map(c => c.id) } },
      _sum: { amount: true },
    });
    const balance = new Map<string, number>();
    for (const g of grouped) {
      if (!g.customerId) continue;
      const amt = Number(g._sum.amount || 0);
      balance.set(g.customerId, (balance.get(g.customerId) || 0) + (g.type === 'SALE' ? amt : -amt));
    }

    const fmtTL = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const items = customers
      .filter(c => netgsmPhone(c.phone))
      .map(c => ({
        phone: c.phone,
        message: template
          .replace(/{ad}/g, c.name || '')
          .replace(/{borç}/g, fmtTL(balance.get(c.id) || 0))
          .replace(/{telefon}/g, c.phone || ''),
      }));
    const skipped = customers.length - items.length;

    if (items.length === 0) {
      return NextResponse.json({ error: 'Seçili müşterilerde geçerli telefon yok', skipped }, { status: 400 });
    }

    const result = await sendBulkSms(items);
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code, skipped }, { status: 502 });

    return NextResponse.json({ ok: true, sent: result.sent, skipped, jobId: result.jobId });
  } catch (e) {
    return authErrorResponse(e);
  }
}
