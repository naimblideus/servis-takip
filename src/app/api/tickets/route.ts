import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Priority } from '@prisma/client';

async function generateTicketNumber(tenantId: string): Promise<string> {
  // TSK- ve SF- prefix'li tüm fişlerin en yüksek numarasını bul
  const allTickets = await prisma.serviceTicket.findMany({
    where: { tenantId },
    select: { ticketNumber: true },
  });

  let maxNum = 0;
  for (const t of allTickets) {
    // TSK-XXX veya SF-XXX formatını parse et
    const match = t.ticketNumber.match(/^(?:TSK|SF)-(\d+)$/);
    if (match) {
      const n = parseInt(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }

  let nextNum = maxNum + 1;
  if (nextNum < 1) nextNum = 1;

  // Collision retry: eğer bu numara zaten alınmışsa bir sonrakini dene
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `SF-${nextNum}`;
    const exists = await prisma.serviceTicket.findFirst({
      where: { tenantId, ticketNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    nextNum++;
  }

  // Fallback: timestamp bazlı benzersiz numara
  return `SF-${Date.now()}`;
}

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

    const device = await prisma.device.findUnique({ where: { id: body.deviceId } });
    if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

    // Sayaç güncellemesi
    if (body.counterBlack || body.counterColor) {
      const updateData: any = {};
      if (body.counterBlack) updateData.counterBlack = parseInt(body.counterBlack);
      if (body.counterColor) updateData.counterColor = parseInt(body.counterColor);
      await prisma.device.update({ where: { id: device.id }, data: updateData });
    }

    const ticketNumber = await generateTicketNumber(user.tenantId);

    const ticket = await prisma.serviceTicket.create({
      data: {
        tenantId: user.tenantId,
        deviceId: body.deviceId,
        customerId: device.customerId,
        ticketNumber,
        issueTemplate: body.issueTemplate || null,
        issueText: body.issueText,
        actionText: body.actionText || null,
        notes: body.notes || null,
        assignedUserId: body.assignedUserId || null,
        createdByUserId: user.id,
        totalCost: body.totalCost ? parseFloat(body.totalCost) : 0,
        priority: (body.priority || 'NORMAL') as Priority,
      },
    });

    return NextResponse.json(ticket);
  } catch (e: any) {
    console.error('TICKET CREATE ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
