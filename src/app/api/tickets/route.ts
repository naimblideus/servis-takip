import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function generateTicketNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `SF-${year}-${random}`;
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

    const ticket = await prisma.serviceTicket.create({
      data: {
        tenantId: user.tenantId,
        deviceId: body.deviceId,
        customerId: device.customerId,
        ticketNumber: generateTicketNumber(),
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

    return NextResponse.json({ id: ticket.id, ...ticket });
  } catch (e: any) {
    console.error('TICKET CREATE ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}