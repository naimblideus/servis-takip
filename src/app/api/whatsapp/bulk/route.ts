import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { resolveRecipients, fmtTLm } from '@/lib/reminders';
import { sendOneWhatsApp, waConfigured, waApiPhone } from '@/lib/whatsapp';
import { prisma } from '@/lib/prisma';

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

    // Tek tek gönderiliyor ki HER ALICI için ayrı kayıt tutulabilsin.
    // Eskiden toplu gönderiliyordu ve hiçbir kayıt yazılmıyordu: "kime ne gönderdim,
    // gitti mi" sorusunun cevabı yoktu. Hacim düşük (en fazla 500), maliyeti önemsiz.
    let sent = 0, failed = 0;
    const errors: string[] = [];
    for (const it of items) {
      const r = await sendOneWhatsApp(it.phone, it.params, process.env.WHATSAPP_TEMPLATE);
      if (r.ok) sent++;
      else { failed++; if (r.error && errors.length < 5) errors.push(r.error); }
      await prisma.notificationLog.create({
        data: {
          tenantId,
          recipient: it.phone,
          channel: 'WHATSAPP',
          status: r.ok ? 'SENT' : 'FAILED',
          error: r.ok ? null : (r.error ?? 'bilinmeyen hata'),
          message: `Borç hatırlatma — ${it.params[0]} · ${it.params[1]}`,
        },
      }).catch(() => {}); // kayıt yazılamazsa gönderim yine de sürsün
    }

    return NextResponse.json({ ok: sent > 0, sent, failed, skipped, errors });
  } catch (e) {
    return authErrorResponse(e);
  }
}
