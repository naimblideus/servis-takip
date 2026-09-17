import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { resolveRecipients, fmtTLm } from '@/lib/reminders';
import { sendBulkSms, smsConfigured, netgsmPhone } from '@/lib/sms';
import { sablonDoldur } from '@/lib/mesaj-sablonu';
import { waConfigured } from '@/lib/whatsapp';

// GET /api/sms/bulk — kanal durumu (UI, kurulu olmayan kanalı hata vermeden gizler/pasifleştirir)
export async function GET() {
  try {
    await requireTenantUser();
    return NextResponse.json({ sms: smsConfigured(), whatsapp: waConfigured() });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// POST /api/sms/bulk — Seçili müşterilere TEK TIKLA toplu (kişiselleştirilmiş) SMS.
// Güvenlik: müşteriler TENANT-scoped; mesaj SUNUCUDA şablondan üretilir ({ad}/{borç}/{telefon}).
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    if (!smsConfigured()) {
      return ucHatasi('SMS_SAGLAYICI_AYARLI_DEGIL_YONETICI', 503);
    }

    const { customerIds, template } = await req.json();
    if (!Array.isArray(customerIds) || customerIds.length === 0 || typeof template !== 'string' || !template.trim()) {
      return NextResponse.json({ error: 'customerIds ve template zorunlu' }, { status: 400 });
    }
    if (customerIds.length > 500) {
      return ucHatasi('TEK_SEFERDE_EN_FAZLA_500', 400);
    }

    const recipients = await resolveRecipients(tenantId, customerIds);
    const items = recipients
      .filter(r => netgsmPhone(r.phone))
      .map(r => ({
        phone: r.phone,
        // Ekrandaki önizleme ile BU metin aynı kuraldan geçiyor (lib/mesaj-sablonu).
        message: sablonDoldur(template, { ad: r.name, borc: fmtTLm(r.balance), telefon: r.phone }),
      }));
    const skipped = recipients.length - items.length;

    if (items.length === 0) {
      return ucHatasi('SECILI_MUSTERILERDE_GECERLI_TELEFON_YOK', 400, { ek: { skipped } });
    }

    const result = await sendBulkSms(items);
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code, skipped }, { status: 502 });

    return NextResponse.json({ ok: true, sent: result.sent, skipped, jobId: result.jobId });
  } catch (e) {
    return authErrorResponse(e);
  }
}
