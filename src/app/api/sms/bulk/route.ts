import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { resolveRecipients, fmtTLm } from '@/lib/reminders';
import { sendBulkSms, smsConfigured, netgsmPhone } from '@/lib/sms';

// POST /api/sms/bulk — Seçili müşterilere TEK TIKLA toplu (kişiselleştirilmiş) SMS.
// Güvenlik: müşteriler TENANT-scoped; mesaj SUNUCUDA şablondan üretilir ({ad}/{borç}/{telefon}).
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

    const recipients = await resolveRecipients(tenantId, customerIds);
    const items = recipients
      .filter(r => netgsmPhone(r.phone))
      .map(r => ({
        phone: r.phone,
        message: template
          .replace(/{ad}/g, r.name)
          .replace(/{borç}/g, fmtTLm(r.balance))
          .replace(/{telefon}/g, r.phone),
      }));
    const skipped = recipients.length - items.length;

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
