/**
 * Gelen WhatsApp mesajına OTOMATİK cevap.
 *
 * Neden güvenli/ücretsiz: müşteri bize yazdıktan sonraki 24 saatlik pencerede
 * serbest metin gönderilebilir ve Meta bunu ücretlendirmez (1 Tem 2025'ten beri).
 *
 * GÜVENLİK KURALLARI — bunlar pazarlık konusu değil:
 *  1. Yalnızca SİSTEMDE KAYITLI müşteriye cevap verilir. Tanımadığımız numaraya
 *     otomatik mesaj göndermek hem spam hem yanlış-numara riskidir.
 *  2. Fiş sorgusunda fiş, hem BAYİYE hem O MÜŞTERİYE ait olmak zorundadır.
 *     Aksi halde müşteri rastgele numara yazıp başkasının fişini okuyabilirdi.
 *  3. Bir mesaja en fazla BİR kez cevap verilir (autoReplied bayrağı).
 *  4. Fiyat/borç bilgisi otomatik gönderilmez — o bayinin kararıdır.
 */
import { prisma } from '@/lib/prisma';
import { sendText, waOutConfigured, extractTicketNumber } from '@/lib/whatsapp-out';

const STATUS_TR: Record<string, string> = {
  NEW: 'kaydınız alındı, sıraya girdi',
  IN_SERVICE: 'serviste, üzerinde çalışılıyor',
  WAITING_FOR_PART: 'parça bekleniyor',
  READY: 'hazır, teslim alabilirsiniz',
  DELIVERED: 'teslim edildi',
  CANCELLED: 'iptal edildi',
};

export type AutoReplyKind = 'status' | 'fault_ack' | 'none';

export async function handleAutoReply(opts: {
  tenantId: string;
  tenantName?: string | null;
  customerId: string | null;
  fromPhone: string;
  text?: string | null;
  isFaultReport: boolean;
}): Promise<{ replied: boolean; kind: AutoReplyKind }> {
  // Kural 1: tanımadığımız numaraya otomatik mesaj yok.
  if (!waOutConfigured() || !opts.customerId) return { replied: false, kind: 'none' };

  const imza = opts.tenantName ? `\n\n${opts.tenantName}` : '';

  // --- Fiş durumu sorgusu ---
  const num = extractTicketNumber(opts.text);
  if (num) {
    // Kural 2: fiş hem bu bayiye hem bu müşteriye ait olmalı (IDOR koruması).
    const ticket = await prisma.serviceTicket.findFirst({
      where: {
        tenantId: opts.tenantId,
        deletedAt: null,
        device: { customerId: opts.customerId },
        // Müşteri "SF-2026-0143" ya da "20260143" yazabilir; ikisini de yakala.
        OR: [
          { ticketNumber: { contains: num } },
          { ticketNumber: { contains: num.slice(0, 4) + '-' + num.slice(4) } },
        ],
      },
      include: { device: { select: { brand: true, model: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (ticket) {
      const durum = STATUS_TR[ticket.status] || 'güncellendi';
      const cihaz = `${ticket.device.brand} ${ticket.device.model}`;
      const body =
        `${ticket.ticketNumber} numaralı kaydınız:\n${cihaz} — ${durum}.` +
        (ticket.status === 'READY' ? '\nTeslim için mağazamıza uğrayabilirsiniz.' : '') +
        imza;
      const r = await sendText(opts.fromPhone, body);
      return { replied: r.ok, kind: 'status' };
    }
    // Fiş bulunamadıysa CEVAP VERME — "böyle bir fiş yok" demek, başkasının fiş
    // numarasını deneyen birine bilgi sızdırır ve gerçek müşteriyi de gereksiz korkutur.
  }

  // --- Arıza bildirimi teyidi ---
  if (opts.isFaultReport) {
    const body =
      'Mesajınız bize ulaştı, teşekkür ederiz. Servis ekibimiz en kısa sürede ' +
      'sizinle iletişime geçecek.' + imza;
    const r = await sendText(opts.fromPhone, body);
    return { replied: r.ok, kind: 'fault_ack' };
  }

  return { replied: false, kind: 'none' };
}
