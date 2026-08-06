import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { findCustomerByPhone } from '@/lib/whatsapp-inbound';

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
      orderBy: { receivedAt: 'desc' },
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
    const { action, messageId, name, handled } = await req.json();

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

    return NextResponse.json({ error: 'Bilinmeyen işlem' }, { status: 400 });
  } catch (e) {
    return authErrorResponse(e);
  }
}
