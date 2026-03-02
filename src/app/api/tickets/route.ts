import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function generateTicketNumber(tenantId: string) {
  // TSK-XXX formatındaki en yüksek numarayı bul
  const lastTicket = await prisma.serviceTicket.findFirst({
    where: {
      tenantId,
      ticketNumber: { startsWith: 'TSK-' },
    },
    orderBy: { ticketNumber: 'desc' },
  });

  let nextNum = 1;
  if (lastTicket) {
    const match = lastTicket.ticketNumber.match(/TSK-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  // Toplam fiş sayısından da büyük olmasını garanti et
  const totalCount = await prisma.serviceTicket.count({
    where: { tenantId },
  });
  if (totalCount >= nextNum) nextNum = totalCount + 1;

  return `TSK-${nextNum}`;
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
        priority: body.priority || 'NORMAL',
      },
    });

    return NextResponse.json(ticket);
  } catch (e: any) {
    console.error('TICKET CREATE ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
