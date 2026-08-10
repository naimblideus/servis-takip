import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { kaydetAsama } from '@/lib/ticket-asama';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { generateTicketNumber } from '@/lib/ticket-number';
import { createReading, ReadingError } from '@/lib/readings';

/**
 * POST /api/portal-talepleri/<id> — müşteri bildirimini işle.
 *   { islem: 'onayla' } → ARIZA ise fiş açar, SAYAC ise okuma kaydeder
 *   { islem: 'reddet', notu } → kuyruğu kapatır, müşteri portalında notu görür
 *
 * Onay ADIMI BİLEREK VAR: portaldan gelen veri güvenilmeyen girdidir. Müşteri
 * sayacı yanlış okuyabilir; doğrudan kaydedilseydi yanlış fatura kesilirdi.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, user } = await requireTenantUser();
    const { id } = await params;
    const { islem, notu } = (await req.json().catch(() => ({}))) as { islem?: string; notu?: string };

    const talep = await prisma.portalRequest.findFirst({
      where: { id, tenantId },
      include: { device: { select: { id: true, counterBlack: true, counterColor: true } } },
    });
    if (!talep) return NextResponse.json({ error: 'Bildirim bulunamadı' }, { status: 404 });
    if (talep.durum !== 'BEKLIYOR') return NextResponse.json({ error: 'Bu bildirim zaten işlenmiş' }, { status: 409 });

    if (islem === 'reddet') {
      await prisma.portalRequest.update({
        where: { id },
        data: { durum: 'REDDEDILDI', notu: (notu ?? '').trim().slice(0, 500) || null, islenenAt: new Date() },
      });
      return NextResponse.json({ ok: true, durum: 'REDDEDILDI' });
    }

    if (islem !== 'onayla') return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 });

    // ── ARIZA → servis fişi ──
    if (talep.tur === 'ARIZA') {
      if (!talep.deviceId) return NextResponse.json({ error: 'Cihazsız bildirimden fiş açılamaz' }, { status: 400 });
      const ticketNumber = await generateTicketNumber(tenantId);
      const fis = await prisma.serviceTicket.create({
        data: {
          tenantId,
          deviceId: talep.deviceId,
          customerId: talep.customerId,
          ticketNumber,
          createdByUserId: user.id,
          // Müşterinin kendi cümlesi olduğu gibi giriyor — yeniden yazmak
          // bilgi kaybettirir, teknisyen asıl ifadeyi görsün.
          issueText: talep.aciklama ?? 'Müşteri portalından bildirildi',
          notes: 'Müşteri panelinden gelen arıza bildirimi.',
        },
        select: { id: true, ticketNumber: true },
      });
      // AŞAMA GEÇMİŞİ: müşteri panelinden gelen bildirimle açıldığını kaynak
      // alanı söylüyor — bayi sonradan "bunu kim açtı" diye sormasın.
      await kaydetAsama({
        tenantId, ticketId: fis.id, status: 'NEW',
        changedByUserId: user.id, kaynak: 'PORTAL',
        notu: 'Müşteri panelinden gelen arıza bildirimi',
      });

      await prisma.portalRequest.update({
        where: { id },
        data: { durum: 'ISLENDI', ticketId: fis.id, islenenAt: new Date(), notu: `Servis fişi açıldı: ${fis.ticketNumber}` },
      });
      return NextResponse.json({ ok: true, durum: 'ISLENDI', ticketId: fis.id, ticketNumber: fis.ticketNumber });
    }

    // ── SAYAC → okuma ──
    if (!talep.deviceId || !talep.device) return NextResponse.json({ error: 'Sayaç bildiriminde cihaz yok' }, { status: 400 });
    if (talep.sayacBlack == null) return NextResponse.json({ error: 'Siyah/beyaz sayaç değeri yok' }, { status: 400 });

    // Müşteri renkliyi yazmadıysa SON BİLİNEN değeri kullanıyoruz: uydurma bir
    // artış yazmaktansa renkli fark 0 olsun. Sıfır yazmak sayaç düşüşü sayılır
    // ve mevcut düşüş kontrolüne takılırdı.
    const renkli = talep.sayacColor ?? talep.device.counterColor ?? 0;

    try {
      const { reading, warning } = await createReading({
        tenantId,
        deviceId: talep.deviceId,
        counterBlack: talep.sayacBlack,
        counterColor: renkli,
      });
      await prisma.portalRequest.update({
        where: { id },
        data: {
          durum: 'ISLENDI', readingId: reading.id, islenenAt: new Date(),
          notu: warning ? `Sayaç kaydedildi (${warning})` : 'Sayaç okuması kaydedildi.',
        },
      });
      return NextResponse.json({ ok: true, durum: 'ISLENDI', uyari: warning ?? null });
    } catch (e: any) {
      if (e instanceof ReadingError) {
        // Sayaç düşüşü / geçersiz değer: bildirim BEKLIYOR kalır, bayi elle
        // düzeltir. Sessizce kapatmak müşterinin bildirimini yutmak olurdu.
        return NextResponse.json({ error: e.message, kod: e.code }, { status: e.status });
      }
      throw e;
    }
  } catch (e) {
    return authErrorResponse(e);
  }
}
