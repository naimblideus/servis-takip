import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import { demoBayiMi } from '@/lib/demo-koruma';
import { kaydetAsama } from '@/lib/ticket-asama';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { findCustomerByPhone, retListesi, son10 } from '@/lib/whatsapp-inbound';
import { sendText, waOutConfigured } from '@/lib/whatsapp-out';
import { randomBytes } from 'crypto';

/** WhatsApp'ın serbest mesaj penceresi: müşterinin son mesajından sonra 24 saat. */
const PENCERE_MS = 24 * 3_600_000;
import { createReading, ReadingError } from '@/lib/readings';
import { MIN_CONFIDENCE } from '@/lib/whatsapp-suggest';
import { parseFaultCategory } from '@/lib/fault-categories';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
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
      // Gelen kutusu müşteriden gelenler; bayinin cevapları (GIDEN) her mesajın altında.
      where: { tenantId, yon: 'GELEN', ...(showAll ? {} : { handled: false }) },
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

    // Sohbet: listedeki numaralara son 7 günde verilen cevaplar + numaranın son gelen
    // mesajı (24 saatlik cevap penceresi) + "DUR" yazmış mı.
    const telefonlar = [...new Set(messages.map(m => m.fromPhone))];
    const [cevaplar, sonGelenler, ret] = telefonlar.length
      ? await Promise.all([
          prisma.whatsAppMessage.findMany({
            where: { tenantId, yon: 'GIDEN', fromPhone: { in: telefonlar }, receivedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
            orderBy: { receivedAt: 'asc' },
            select: { id: true, fromPhone: true, text: true, receivedAt: true, durum: true, hata: true },
          }),
          prisma.whatsAppMessage.groupBy({ by: ['fromPhone'], where: { tenantId, yon: 'GELEN', fromPhone: { in: telefonlar } }, _max: { receivedAt: true } }),
          retListesi(tenantId),
        ])
      : [[], [], new Set<string>()] as const;
    const cevapByTel = new Map<string, typeof cevaplar[number][]>();
    for (const c of cevaplar) cevapByTel.set(c.fromPhone, [...(cevapByTel.get(c.fromPhone) ?? []), c]);
    const pencereByTel = new Map(sonGelenler.map(g => [g.fromPhone, g._max.receivedAt ? g._max.receivedAt.getTime() + PENCERE_MS : 0]));
    const cevapAcik = waOutConfigured();

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
        // Bu numaraya verilen cevaplar (en eskisi önce) ve cevap penceresinin bitişi.
        cevaplar: (cevapByTel.get(m.fromPhone) ?? []).filter(c => c.receivedAt >= m.receivedAt).map(c => ({
          id: c.id, text: c.text, zaman: c.receivedAt.toISOString(), durum: c.durum, hata: c.hata,
        })),
        pencereBitis: pencereByTel.get(m.fromPhone) ? new Date(pencereByTel.get(m.fromPhone)!).toISOString() : null,
        retli: ret.has(son10(m.fromPhone)),
        // Öneri — yalnızca güven eşiği geçtiyse gönderilir.
        // Eşik altındaki öneriyi göstermek, bayiyi yanlış yönlendirmekten başka işe yaramaz.
        suggestion:
          m.suggestionConfidence !== null && m.suggestionConfidence >= MIN_CONFIDENCE
            ? {
                deviceId: m.suggestedDeviceId,
                device: m.suggestedDeviceId ? devById.get(m.suggestedDeviceId) ?? null : null,
                // Yalnız KOD gönderiliyor; arıza adını ekran kendi dilinde yazar.
                // Buradan Türkçe etiket de gidiyordu ve ekran onu yedek olarak
                // tutuyordu — İngilizce arayüzde tek bir kayma, Türkçe kelime.
                category: m.suggestedCategory,
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
      cevapAcik,
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
 *  - cevap       : müşteriye platform numarasından cevap (24 saat penceresinde, ücretsiz)
 */
export async function POST(req: NextRequest) {
  try {
    const { tenantId, user: oturumKul } = await requireTenantUser();
    const body = await req.json();
    const { action, messageId, name, handled } = body;

    const msg = await prisma.whatsAppMessage.findFirst({ where: { id: messageId, tenantId } });
    if (!msg) return ucHatasi('MESAJ_BULUNAMADI', 404);

    // ── CEVAP ── Müşteri platform numarasına yazdı; bayi buradan cevaplar. Kendi
    // WhatsApp'ından yazsa müşteri başka numaradan mesaj alırdı (hatırlatma bu
    // numaradan gelmişti). Mesaj bayinin adıyla imzalanır: numara "Nextus Servis".
    if (action === 'cevap') {
      if (msg.yon !== 'GELEN') return ucHatasi('MESAJ_BULUNAMADI', 404);
      // Ortak demo: demo numaraları örnek; gerçek bir kişiye mesaj gitmesin.
      if (await demoBayiMi(tenantId)) return ucHatasi('DEMO_HESABINDA_KAPALI', 403);
      if (!waOutConfigured()) return ucHatasi('WHATSAPP_API_AYARLI_DEGIL_YONETICI', 503);
      const metin = typeof body.metin === 'string' ? body.metin.trim() : '';
      if (!metin || metin.length > 1000) return ucHatasi('WHATSAPP_CEVAP_BOS', 400);
      const sonGelen = await prisma.whatsAppMessage.findFirst({
        where: { tenantId, yon: 'GELEN', fromPhone: msg.fromPhone }, orderBy: { receivedAt: 'desc' }, select: { receivedAt: true },
      });
      if (!sonGelen || Date.now() - sonGelen.receivedAt.getTime() > PENCERE_MS) return ucHatasi('WHATSAPP_PENCERE_KAPALI', 409);
      const bayi = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      const r = await sendText(msg.fromPhone, `${metin}\n\n— ${bayi?.name ?? ''}`.trim());
      if (!r.ok) return NextResponse.json({ error: r.error ?? 'WhatsApp', kod: 'WHATSAPP_GONDERILEMEDI' }, { status: 502 });
      const giden = await prisma.whatsAppMessage.create({
        data: {
          tenantId, customerId: msg.customerId, yon: 'GIDEN',
          // Meta kimliği yoksa da benzersiz olsun (durum bildirimi bu kayda bağlanamaz, o kadar).
          waMessageId: r.id ?? `giden-${randomBytes(8).toString('hex')}`,
          fromPhone: msg.fromPhone, text: metin, receivedAt: new Date(), handled: true,
          durum: 'gonderildi', gonderenUserId: oturumKul.id,
        },
        select: { id: true, text: true, receivedAt: true, durum: true },
      });
      // Cevaplanan mesaj bekleyenlerden düşer (geri alınabilir).
      await prisma.whatsAppMessage.update({ where: { id: msg.id }, data: { handled: true } });
      return NextResponse.json({ ok: true, cevap: { id: giden.id, text: giden.text, zaman: giden.receivedAt.toISOString(), durum: giden.durum, hata: null } });
    }

    if (action === 'handled') {
      // Ortak demo: "ilgilenildi" örnek mesajı herkesin gelen kutusundan kaldırırdı.
      if (await demoBayiMi(tenantId)) return ucHatasi('DEMO_HESABINDA_KAPALI', 403);
      await prisma.whatsAppMessage.update({ where: { id: msg.id }, data: { handled: handled !== false } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'addCustomer') {
      const customerName = (name || msg.contactName || '').trim();
      if (!customerName) return ucHatasi('MUSTERI_ADI_GEREKLI', 400);

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
      const { deviceId, counterBlack, counterColor, reset, resetTur } = body;
      if (!deviceId) return ucHatasi('CIHAZ_SECILMEDI', 400);
      try {
        const r = await createReading({
          tenantId,
          deviceId,
          counterBlack: Number(counterBlack) || 0,
          counterColor: Number(counterColor) || 0,
          reset: !!reset,
          // Sebep geçmezse createReading CIHAZ_DEGISTI varsayar ve farkı sıfır
          // yazar. Ekranda ise "Sayaç sıfırlandı" yazan tek kutu vardı —
          // kutu bir şey vaat ediyor, sistem başkasını yapıyordu.
          resetTur,
          source: 'WHATSAPP_FOTO',
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
      // Fişe YAZILAN metin bayinin dilinde olmalı: fişi bayi okur, gerekirse
      // müşteriye basar. Ekranı açan kişinin dili değil, işletmenin dili.
      const { bayiSz } = await sunucuBicimi(oturumKul);
      if (!deviceId) return ucHatasi('CIHAZ_SECILMEDI', 400);
      if (msg.ticketId) return ucHatasi('BU_MESAJDAN_ZATEN_FIS_ACILMIS', 409);

      // IDOR: cihaz bu bayiye ait olmalı
      const device = await prisma.device.findFirst({
        where: { id: deviceId, tenantId },
        select: { id: true, customerId: true, brand: true, model: true },
      });
      if (!device) return ucHatasi('CIHAZ_BULUNAMADI', 404);

      const cat = parseFaultCategory(faultCategory);
      if (!cat) return ucHatasi('ARIZA_KATEGORISI_SECIN', 400);

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
          issueTemplate: bayiSz.ariza[cat],
          // Müşterinin kendi cümlesi kayda geçer — teknisyen bağlamı görsün
          issueText: (issueText || msg.text || bayiSz.ariza[cat]).slice(0, 2000),
          notes: `WhatsApp: ${msg.fromPhone}`,
          createdByUserId: user!.id,
        },
        select: { id: true, ticketNumber: true },
      });

      await kaydetAsama({
        tenantId, ticketId: ticket.id, status: 'NEW',
        kaynak: 'PORTAL', notu: bayiSz.wa.fistenAcildi,
      });

      await prisma.whatsAppMessage.update({
        where: { id: msg.id },
        data: { ticketId: ticket.id, handled: true },
      });

      try { await syncTicketToCari(ticket.id, tenantId); } catch { /* tutar 0 ise zaten no-op */ }

      return NextResponse.json({ ok: true, ticketId: ticket.id, ticketNumber: ticket.ticketNumber });
    }

    return ucHatasi('BILINMEYEN_ISLEM', 400);
  } catch (e) {
    return authErrorResponse(e);
  }
}
