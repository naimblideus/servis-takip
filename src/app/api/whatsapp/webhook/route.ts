import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  metaSignatureValid,
  parseWebhook,
  findCustomerByPhone,
  findTenantByPhoneNumberId,
} from '@/lib/whatsapp-inbound';

// Bu uç HERKESE AÇIK olmak zorunda (Meta çağırır). Tek koruma imza doğrulaması.
export const dynamic = 'force-dynamic';

/**
 * GET — Meta webhook doğrulaması.
 * Meta, uç noktayı kaydederken hub.challenge gönderir; verify token tutuyorsa
 * challenge'ı DÜZ METİN olarak geri döndürmek gerekir (JSON değil).
 */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token) return new NextResponse('verify token yok', { status: 503 });

  if (sp.get('hub.mode') === 'subscribe' && sp.get('hub.verify_token') === token) {
    return new NextResponse(sp.get('hub.challenge') ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return new NextResponse('forbidden', { status: 403 });
}

/**
 * POST — gelen mesaj.
 *
 * Meta, 200 dönmezse aynı mesajı tekrar tekrar gönderir. Bu yüzden:
 *  - imza geçersizse 403 (tekrar denemesi anlamsız, zaten sahte),
 *  - iş mantığında hata olsa bile 200 döneriz (sonsuz tekrar kuyruğu oluşmasın),
 *  - aynı mesaj iki kez gelirse waMessageId benzersiz olduğu için ikincisi sessizce atlanır.
 */
export async function POST(req: NextRequest) {
  // İmza ham gövde üzerinden hesaplanır — önce text(), sonra parse.
  const raw = await req.text();
  if (!metaSignatureValid(raw, req.headers.get('x-hub-signature-256'))) {
    return new NextResponse('invalid signature', { status: 403 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true, ignored: 'bozuk gövde' });
  }

  const messages = parseWebhook(body);
  let saved = 0;

  for (const m of messages) {
    try {
      const tenant = await findTenantByPhoneNumberId(m.phoneNumberId);
      // Bu numara hiçbir bayiye tanımlı değil → bizi ilgilendirmiyor, sessizce geç.
      if (!tenant) continue;

      const customer = await findCustomerByPhone(tenant.id, m.fromPhone);

      await prisma.whatsAppMessage.create({
        data: {
          tenantId: tenant.id,
          customerId: customer?.id ?? null,
          waMessageId: m.waMessageId,
          fromPhone: m.fromPhone,
          contactName: m.contactName ?? null,
          text: m.text ?? null,
          mediaId: m.mediaId ?? null,
          mediaType: m.mediaType ?? null,
          receivedAt: m.receivedAt,
        },
      });
      saved++;
    } catch (e: any) {
      // P2002 = aynı mesaj zaten kayıtlı (Meta tekrarı). Hata değil, beklenen durum.
      if (e?.code !== 'P2002') {
        console.error('[whatsapp-webhook] mesaj işlenemedi:', e?.message);
      }
    }
  }

  // Her koşulda 200 — aksi halde Meta aynı paketi saatlerce tekrar gönderir.
  return NextResponse.json({ ok: true, received: messages.length, saved });
}
