import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { kaydetAsama } from '@/lib/ticket-asama';
import { Priority } from '@prisma/client';
import { syncTicketToCari } from '@/lib/ticket-cari';
import { parseFaultCategory, faultCategoryFromLegacyText } from '@/lib/fault-categories';
import { createReading, ReadingError } from '@/lib/readings';
import { generateTicketNumber } from '@/lib/ticket-number';


export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  const tickets = await prisma.serviceTicket.findMany({
    where: { tenantId: user!.tenantId },
    include: { device: { include: { customer: true } }, assignedUser: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(tickets);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json();

    // IDOR koruması: cihaz bu tenant'a ait olmalı (yoksa başka bayinin cihazına fiş açılabilirdi)
    const device = await prisma.device.findFirst({ where: { id: body.deviceId, tenantId: user.tenantId } });
    if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

    const ticketNumber = await generateTicketNumber(user.tenantId);

    // Arıza kategorisi: önce gönderilen kod, olmazsa eski şablon metninden eşle.
    // Hiçbiri tutmuyorsa null bırakılır — rastgele bir kategori YAZILMAZ.
    const faultCategory =
      parseFaultCategory(body.faultCategory) ??
      faultCategoryFromLegacyText(body.issueTemplate);

    const ticket = await prisma.serviceTicket.create({
      data: {
        tenantId: user.tenantId,
        deviceId: body.deviceId,
        customerId: device.customerId,
        ticketNumber,
        issueTemplate: body.issueTemplate || null,
        faultCategory,
        issueText: body.issueText,
        actionText: body.actionText || null,
        notes: body.notes || null,
        assignedUserId: body.assignedUserId || null,
        createdByUserId: user.id,
        totalCost: body.totalCost ? parseFloat(body.totalCost) : 0,
        priority: (body.priority || 'NORMAL') as Priority,
      },
    });

    // AŞAMA GEÇMİŞİ: fişin ilk adımı. Bu satır yazılmazsa çizelge "ne zaman
    // açıldı" bilgisini fişin createdAt'inden türetmek zorunda kalır.
    await kaydetAsama({
        tenantId: user.tenantId, ticketId: ticket.id, status: ticket.status,
        changedByUserId: user.id, kaynak: 'PANEL',
    });

    // ── SAYAÇ OKUMASI ──
    // ÖNCEDEN: Device.counterBlack/Color'ın ÜZERİNE YAZILIYOR, geçmiş kaydı
    // oluşturulmuyordu → önceki sayaç kalıcı olarak kayboluyordu. Teknisyenler de
    // eski değeri kaybetmemek için arıza açıklamasına yazıyordu.
    // ARTIK: tek kaynak olan createReading() kullanılıyor — CounterReading kaydı
    // oluşur (fişe bağlı), delta/ücret hesaplanır, cihaz sayacı da güncellenir.
    let counterWarning: string | null = null;
    let counterError: { code: string; message: string } | null = null;
    const cb = body.counterBlack !== undefined && body.counterBlack !== '' ? parseInt(body.counterBlack) : null;
    const cc = body.counterColor !== undefined && body.counterColor !== '' ? parseInt(body.counterColor) : null;
    if (cb !== null || cc !== null) {
      try {
        const { warning } = await createReading({
          tenantId: user.tenantId,
          deviceId: device.id,
          // Girilmeyen sayaç için son bilinen değer korunur (0 yazmak düşüş sayılırdı)
          counterBlack: cb ?? device.counterBlack ?? 0,
          counterColor: cc ?? device.counterColor ?? 0,
          ticketId: ticket.id,
          photo: body.counterPhoto ?? null,
          reset: !!body.counterReset,
        });
        counterWarning = warning ?? null;
      } catch (e: any) {
        // Fiş açmayı ENGELLEME — sahadaki teknisyen kilitlenmemeli.
        // Ama sessizce de yutma: kullanıcıya bildir ki sayacı doğru yerden girsin.
        if (e instanceof ReadingError) counterError = { code: e.code, message: e.message };
        else { console.error('TICKET COUNTER READING ERROR:', e?.message); counterError = { code: 'UNKNOWN', message: 'Sayaç kaydedilemedi' }; }
      }
    }

    // Fiş kesilir kesilmez Muhasebe/Cari'ye borç olarak yansıt (tutarı>0 ise)
    try { await syncTicketToCari(ticket.id, user.tenantId); } catch (e: any) { console.error('TICKET CREATE CARI SYNC ERROR:', e?.message); }

    return NextResponse.json({ ...ticket, counterWarning, counterError });
  } catch (e: any) {
    console.error('TICKET CREATE ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
