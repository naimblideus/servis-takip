import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { resolveRecipients, fmtTLm } from '@/lib/reminders';
import { sendBulkWhatsApp, waConfigured, waApiPhone } from '@/lib/whatsapp';

// POST /api/whatsapp/bulk — Seçili müşterilere TEK TIKLA toplu WhatsApp (Meta onaylı şablonla).
// Güvenlik: müşteriler TENANT-scoped; şablon değişkenleri SUNUCUDA üretilir ({{1}}=ad, {{2}}=borç).
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    if (!waConfigured()) {
      return NextResponse.json({ error: 'WhatsApp API ayarlı değil. Yönetici WHATSAPP_TOKEN/PHONE_ID/TEMPLATE eklemeli.' }, { status: 503 });
    }

    const { customerIds } = await req.json();
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: 'customerIds zorunlu' }, { status: 400 });
    }
    if (customerIds.length > 500) {
      return NextResponse.json({ error: 'Tek seferde en fazla 500 alıcı' }, { status: 400 });
    }

    const recipients = await resolveRecipients(tenantId, customerIds);
    const items = recipients
      .filter(r => waApiPhone(r.phone))
      .map(r => ({ phone: r.phone, params: [r.name, fmtTLm(r.balance)] }));
    const skipped = recipients.length - items.length;

    if (items.length === 0) {
      return NextResponse.json({ error: 'Seçili müşterilerde geçerli telefon yok', skipped }, { status: 400 });
    }

    const result = await sendBulkWhatsApp(items);
    return NextResponse.json({
      ok: result.ok, sent: result.sent, failed: result.failed,
      skipped: skipped + result.skippedInvalid, errors: result.errors,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
