import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { kaydetAsama } from '@/lib/ticket-asama';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { findCustomerByPhone } from '@/lib/whatsapp-inbound';
import { createReading, ReadingError } from '@/lib/readings';
import { MIN_CONFIDENCE } from '@/lib/whatsapp-suggest';
import { faultLabel, parseFaultCategory } from '@/lib/fault-categories';
import { syncTicketToCari } from '@/lib/ticket-cari';

/**
 * GET /api/whatsapp/inbox — gelen WhatsApp mesajları + müşteri bağlamı.
 * Bekleyenler önce; her mesajda "kim yazdı, kaç cihazı var, açık fişi var mı".
 */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const showAll = new URL(req.url).searchParams.get('all') === '1';

    const messages = await prisma.whatsAppMessage.findMany({
      where: { tenantId, ...(showAll ? {} : { handled: false }) },
      // Arıza bildirimleri en üstte: bekleyen iş onlar.
      orderBy: [{ isFaultReport: 'desc' }, { receivedAt: 'desc' }],
      take: 200,
      include: { customer: { select: { id: true, name: true, phone: true } } },
    });

    // Eşleşen müşterilerin cihaz ve açık fiş sayıları — tek sorguda, N+1 yok
    const customerIds = [...new Set(messages.map(m => m.customerId).filter(Boolean) as string[])];
    const devices = customerIds.length
      ? await prisma.device.groupBy({
          by: ['customerId'],
          where: { tenantId, customerId: { in: customerIds } },
          _count: { _all: true },
        })
      : [];
    const openTickets = customerIds.length
      ? await prisma.serviceTicket.findMany({
          where: {
            tenantId, deletedAt: null,
            status: { notIn: ['DELIVERED', 'CANCELLED'] },
            device: { customerId: { in: customerIds } },
          },
          select: { device: { select: { customerId: true } } },
        })
      : [];

    // Önerilen cihazların etiketi — tek sorguda çözülür, satır satır sorgu yok
    const suggestedIds = [...new Set(messages.map(m => m.suggestedDeviceId).filter(Boolean) as string[])];
    const suggestedDevices = suggestedIds.length
      ? await prisma.device.findMany({
          where: { tenantId, id: { in: suggestedIds } },
          select: { id: true, brand: true, model: true, serialNo: true, location: true },
        })
      : [];
    const devById = new Map(suggestedDevices.map(d => [d.id, d]));

    const deviceCount = new Map(devices.map(d => [d.customerId, d._count._all]));
    const openCount = new Map<string, number>();
    for (const t of openTickets) {
      const cid = t.device.customerId;
      openCount.set(cid, (openCount.get(cid) || 0) + 1);
    }

    return NextResponse.json({
      items: messages.map(m => ({
        id: m.id,
        fromPhone: m.fromPhone,
        contactName: m.contactName,
        text: m.text,
        hasMedia: !!m.mediaId,
        mediaType: m.mediaType,
        receivedAt: m.receivedAt.toISOString(),
        handled: m.handled,
        isFaultReport: m.isFaultReport,
        autoReplied: m.autoReplied,
        readingId: m.readingId,
        ticketId: m.ticketId,
        // Öneri — yalnızca güven eşiği geçtiyse gönderilir.
        // Eşik altındaki öneriyi göstermek, bayiyi yanlış yönlendirmekten başka işe yaramaz.
        suggestion:
          m.suggestionConfidence !== null && m.suggestionConfidence >= MIN_CONFIDENCE
            ? {
                deviceId: m.suggestedDeviceId,
                device: m.suggestedDeviceId ? devById.get(m.suggestedDeviceId) ?? null : null,
                category: m.suggestedCategory,
                categoryLabel: m.suggestedCategory ? faultLabel(m.suggestedCategory) : null,
                confidence: m.suggestionConfidence,
                source: m.suggestionSource,
              }
            : null,
        customer: m.customer
          ? {
              ...m.customer,
              deviceCount: deviceCount.get(m.customer.id) || 0,
              openTickets: openCount.get(m.customer.id) || 0,
            }
          : null,
      })),
      pendingCount: messages.filter(m => !m.handled).length,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

/**
 * POST /api/whatsapp/inbox — tek dokunuşluk aksiyonlar.
 *  - addCustomer : tanınmayan numarayı müşteri olarak ekler ve AYNI numaradan gelen
 *                  tüm geçmiş mesajları da o müşteriye bağlar
 *  - handled     : ilgilenildi olarak işaretle (geri alınabilir)
 */
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const body = await req.json();
    const { action, messageId, name, handled } = body;

    const msg = await prisma.whatsAppMessage.findFirst({ where: { id: messageId, tenantId } });
    if (!msg) return NextResponse.json({ error: 'Mesaj bulunamadı' }, { status: 404 });

    if (action === 'handled') {
      await prisma.whatsAppMessage.update({ where: { id: msg.id }, data: { handled: handled !== false } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'addCustomer') {
      const customerName = (name || msg.contactName || '').trim();
      if (!customerName) return NextResponse.json({ error: 'Müşteri adı gerekli' }, { status: 400 });

      // Yarış durumu: iki kullanıcı aynı anda eklerse ikinci kayıt patlamasın
      const existing = await findCustomerByPhone(tenantId, msg.fromPhone);
      const customer = existing
        ? existing
        : await prisma.customer.create({
            // Telefonu 0'lı yerel biçimde yaz — sistemdeki diğer kayıtlarla aynı görünsün
            data: { tenantId, name: customerName, phone: '0' + msg.fromPhone.slice(-10) },
            select: { id: true, name: true },
          });

      // Bu numaradan gelen TÜM mesajları müşteriye bağla (geçmiş dahil)
      const last10 = msg.fromPhone.slice(-10);
      await prisma.whatsAppMessage.updateMany({
        where: { tenantId, customerId: null, fromPhone: { endsWith: last10 } },
        data: { customerId: customer.id },
      });

      return NextResponse.json({ ok: true, customerId: customer.id, created: !existing });
    }

    // Fotoğraftaki sayacı cihaza işle. OCR yok — bayi rakamı okuyup yazar, çünkü
    // yanlış okunan tek bir sayaç yanlış fatura demektir. createReading zaten
    // düşüş kontrolü ve dönem/aşım hesabını yapıyor; o mantığı burada tekrarlamıyoruz.
    if (action === 'saveReading') {
      const { deviceId, counterBlack, counterColor, reset } = body;
      if (!deviceId) return NextResponse.json({ error: 'Cihaz seçilmedi' }, { status: 400 });
      try {
        const r = await createReading({
          tenantId,
          deviceId,
          counterBlack: Number(counterBlack) || 0,
          counterColor: Number(counterColor) || 0,
          reset: !!reset,
        });
        await prisma.whatsAppMessage.update({
          where: { id: msg.id },
          data: { readingId: r.reading.id, handled: true },
        });
        return NextResponse.json({ ok: true, warning: r.warning ?? null });
      } catch (e: any) {
        if (e instanceof ReadingError) {
          return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
        }
        throw e;
      }
    }

    /**
     * Mesajdan FİŞ AÇ — önerinin onaylandığı (veya düzeltildiği) an.
     *
     * Bayi ne seçerse fiş onu taşır; öneri mesajda olduğu gibi kalır.
     * İkisinin farkı = ücretsiz, doğrulanmış eval verisi. Ayrıca "kabul edildi mi"
     * diye ikinci bir doğruluk kaynağı TUTULMAZ — çelişme riski doğurur.
     */
    if (action === 'createTicket') {
      const { deviceId, faultCategory, issueText } = body;
      if (!deviceId) return NextResponse.json({ error: 'Cihaz seçilmedi' }, { status: 400 });
      if (msg.ticketId) return NextResponse.json({ error: 'Bu mesajdan zaten fiş açılmış' }, { status: 409 });

      // IDOR: cihaz bu bayiye ait olmalı
      const device = await prisma.device.findFirst({
        where: { id: deviceId, tenantId },
        select: { id: true, customerId: true, brand: true, model: true },
      });
      if (!device) return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });

      const cat = parseFaultCategory(faultCategory);
      if (!cat) return NextResponse.json({ error: 'Arıza kategorisi seçin' }, { status: 400 });

      // Fiş numarası — mevcut mantıkla aynı biçim (SF-N)
      const all = await prisma.serviceTicket.findMany({ where: { tenantId }, select: { ticketNumber: true } });
      let maxNum = 0;
      for (const t of all) {
        const mm = t.ticketNumber.match(/^(?:TSK|SF)-(\d+)$/);
        if (mm) maxNum = Math.max(maxNum, parseInt(mm[1]));
      }
      const user = await prisma.user.findFirst({ where: { tenantId }, select: { id: true } });

      const ticket = await prisma.serviceTicket.create({
        data: {
          tenantId,
          deviceId: device.id,
          customerId: device.customerId,
          ticketNumber: `SF-${maxNum + 1}`,
          faultCategory: cat,
          issueTemplate: faultLabel(cat),
          // Müşterinin kendi cümlesi kayda geçer — teknisyen bağlamı görsün
          issueText: (issueText || msg.text || faultLabel(cat)).slice(0, 2000),
          notes: `WhatsApp: ${msg.fromPhone}`,
          createdByUserId: user!.id,
        },
        select: { id: true, ticketNumber: true },
      });

      await kaydetAsama({
        tenantId, ticketId: ticket.id, status: 'NEW',
        kaynak: 'PORTAL', notu: 'WhatsApp mesajından açıldı',
      });

      await prisma.whatsAppMessage.update({
        where: { id: msg.id },
        data: { ticketId: ticket.id, handled: true },
      });

      try { await syncTicketToCari(ticket.id, tenantId); } catch { /* tutar 0 ise zaten no-op */ }

      return NextResponse.json({ ok: true, ticketId: ticket.id, ticketNumber: ticket.ticketNumber });
    }

    return NextResponse.json({ error: 'Bilinmeyen işlem' }, { status: 400 });
  } catch (e) {
    return authErrorResponse(e);
  }
}
