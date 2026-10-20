import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { disariyaMesajKapali } from '@/lib/demo-koruma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { resolveRecipients, fmtTLm } from '@/lib/reminders';
import { sendOneWhatsApp, waConfigured, waApiPhone } from '@/lib/whatsapp';
import { prisma } from '@/lib/prisma';
import { borcParametreleri } from '@/lib/whatsapp-sablon';
import { BORC_KAYIT_ONEKI } from '@/lib/vade-hatirlatma';
import { retListesi, son10 } from '@/lib/whatsapp-inbound';

// POST /api/whatsapp/bulk — Seçili müşterilere TEK TIKLA toplu WhatsApp (Meta onaylı şablonla).
// Güvenlik: müşteriler TENANT-scoped; şablon değişkenleri SUNUCUDA üretilir ({{1}}=ad, {{2}}=bayi, {{3}}=borç).
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const bayi = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const mesajEngeli = await disariyaMesajKapali(tenantId);
    if (mesajEngeli) return ucHatasi(mesajEngeli, 403);
    if (!waConfigured()) {
      return ucHatasi('WHATSAPP_API_AYARLI_DEGIL_YONETICI', 503);
    }

    const { customerIds } = await req.json();
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: 'customerIds zorunlu' }, { status: 400 });
    }
    if (customerIds.length > 500) {
      return ucHatasi('TEK_SEFERDE_EN_FAZLA_500', 400);
    }

    const recipients = await resolveRecipients(tenantId, customerIds);
    // "DUR" yazmış müşteriye bayi elle de gönderemez (şikâyet numarayı herkes için yakar).
    const ret = await retListesi(tenantId);
    const durduran = recipients.filter(r => ret.has(son10(r.phone))).length;
    const items = recipients
      // Borcu olmayana "vadesi geçmiş 0,00 TL" hatırlatması gitmesin.
      .filter(r => waApiPhone(r.phone) && !ret.has(son10(r.phone)) && r.balance > 0.009)
      // Şablon değişkenleri tek yerde (lib/whatsapp-sablon): müşteri, bayi, tutar.
      .map(r => ({ phone: r.phone, ad: r.name, tutar: fmtTLm(r.balance), params: borcParametreleri(r.name, bayi?.name ?? '', fmtTLm(r.balance)) }));
    const skipped = recipients.length - items.length - durduran;

    if (items.length === 0) {
      return ucHatasi('SECILI_MUSTERILERDE_GECERLI_TELEFON_YOK', 400, { ek: { skipped, durduran } });
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
          sentAt: r.ok ? new Date() : null,
          error: r.ok ? null : (r.error ?? 'bilinmeyen hata'),
          waMessageId: r.ok ? (r.id ?? null) : null,
          message: `${BORC_KAYIT_ONEKI} — ${it.ad} · ${it.tutar} TL`,
        },
      }).catch(() => {}); // kayıt yazılamazsa gönderim yine de sürsün
    }

    return NextResponse.json({ ok: sent > 0, sent, failed, skipped, durduran, errors });
  } catch (e) {
    return authErrorResponse(e);
  }
}
