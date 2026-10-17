import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  metaSignatureValid,
  parseWebhook,
  parseStatuses,
  durumIsle,
  retKomutu,
  retUygula,
  numaraninBayileri,
  son10,
  findCustomerByPhone,
  findTenantByPhoneNumberId,
  paylasimliNumaraBayisi,
} from '@/lib/whatsapp-inbound';
import { looksLikeFaultReport, sendText } from '@/lib/whatsapp-out';
import { handleAutoReply } from '@/lib/whatsapp-autoreply';
import { buildAndSaveSuggestion } from '@/lib/whatsapp-suggest';

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

  // Giden mesajların durumu (teslim / okundu / iletilemedi) — gönderim kaydına işlenir.
  const durumlar = parseStatuses(body);
  for (const d of durumlar) {
    try { await durumIsle(d); } catch (e: any) { console.error('[whatsapp-webhook] durum işlenemedi:', e?.message); }
  }

  const messages = parseWebhook(body);
  let saved = 0;

  for (const m of messages) {
    try {
      // Meta tekrarı: bu mesaj işlendiyse hiçbir şey yapma (onay/otomatik cevap ikinci kez gitmesin).
      if (await prisma.whatsAppMessage.findUnique({ where: { waMessageId: m.waMessageId }, select: { id: true } })) continue;
      // Önce bayinin KENDİ numarası; değilse platformun paylaşımlı numarası →
      // gönderen hangi bayinin müşterisiyse ona (emin olunamazsa hiçbirine).
      const komut = retKomutu(m.text);
      const kendiBayisi = await findTenantByPhoneNumberId(m.phoneNumberId);
      const tenant = kendiBayisi ?? (await paylasimliNumaraBayisi(m.phoneNumberId, m.fromPhone));
      // "DUR" / "BAŞLA": hatırlatma şablonları bu numaraya gitmez / yeniden gider.
      // Kendi numarası olan bayide yalnız o bayi; paylaşımlı numarada bu numaraya
      // yazabilecek BÜTÜN bayiler (hangisini kastettiği belli olmasa da işlenir;
      // istemeyen kişiye yazmaya devam etmek numarayı herkes için yakar).
      // Onay mesajı 24 saat penceresinde ücretsiz.
      if (komut) {
        const bayiler = kendiBayisi
          ? [kendiBayisi.id]
          : m.phoneNumberId === process.env.WHATSAPP_PHONE_ID ? (await numaraninBayileri(son10(m.fromPhone))).map((b) => b.id) : [];
        if (bayiler.length) {
          try {
            await retUygula(bayiler, m.fromPhone, komut);
            await sendText(m.fromPhone, komut === 'DUR'
              ? 'Hatırlatma mesajları durduruldu. Yeniden almak isterseniz BAŞLA yazabilirsiniz.'
              : 'Hatırlatma mesajları yeniden açıldı. Durdurmak için DUR yazabilirsiniz.');
          } catch (e: any) {
            console.error('[whatsapp-webhook] DUR/BAŞLA işlenemedi:', e?.message);
          }
        }
      }
      if (!tenant) continue;

      const customer = await findCustomerByPhone(tenant.id, m.fromPhone);
      const isFaultReport = !komut && looksLikeFaultReport(m.text);

      const created = await prisma.whatsAppMessage.create({
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
          isFaultReport,
        },
      });
      saved++;

      // Komut mesajı gelen kutusunda görünür (bayi müşterisinin durdurduğunu bilsin);
      // otomatik cevap / fiş önerisi yok, onay yukarıda gitti.
      if (komut) {
        await prisma.whatsAppMessage.update({ where: { id: created.id }, data: { autoReplied: true } }).catch(() => {});
        continue;
      }

      // Fiş önerisi — "hangi cihaz, hangi arıza". Fiş AÇMAZ, yalnızca önerir.
      // Kayıttan sonra denenir; öneri üretilemezse mesaj yine de kaydedilmiş olur.
      if (isFaultReport) {
        try {
          await buildAndSaveSuggestion({
            tenantId: tenant.id,
            messageId: created.id,
            customerId: customer?.id ?? null,
            text: m.text,
          });
        } catch (e: any) {
          console.error('[whatsapp-webhook] öneri üretilemedi:', e?.message);
        }
      }

      // Otomatik cevap — 24 saatlik pencerede ücretsiz. Kayıt BAŞARILI olduktan
      // sonra denenir; cevap gönderilemezse mesaj yine de kaydedilmiş olur.
      try {
        const r = await handleAutoReply({
          tenantId: tenant.id,
          tenantName: tenant.name,
          customerId: customer?.id ?? null,
          fromPhone: m.fromPhone,
          text: m.text,
          isFaultReport,
        });
        if (r.replied) {
          await prisma.whatsAppMessage.update({ where: { id: created.id }, data: { autoReplied: true } });
        }
      } catch (e: any) {
        console.error('[whatsapp-webhook] otomatik cevap hatası:', e?.message);
      }
    } catch (e: any) {
      // P2002 = aynı mesaj zaten kayıtlı (Meta tekrarı). Hata değil, beklenen durum.
      if (e?.code !== 'P2002') {
        console.error('[whatsapp-webhook] mesaj işlenemedi:', e?.message);
      }
    }
  }

  // Her koşulda 200 — aksi halde Meta aynı paketi saatlerce tekrar gönderir.
  return NextResponse.json({ ok: true, received: messages.length, saved, durum: durumlar.length });
}
