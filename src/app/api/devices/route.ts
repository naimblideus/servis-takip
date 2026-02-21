import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

function generatePublicCode() {
  return 'DEV-' + randomBytes(3).toString('hex').toUpperCase();
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  const devices = await prisma.device.findMany({
    where: { tenantId: user!.tenantId },
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(devices);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const body = await req.json();
    const device = await prisma.device.create({
      data: {
        tenantId: user.tenantId,
        customerId: body.customerId,
        brand: body.brand,
        model: body.model,
        serialNo: body.serialNo,
        location: body.location || null,
        qrTokenHash: randomBytes(32).toString('hex'),
        publicCode: generatePublicCode(),
      },
    });
    return NextResponse.json(device);
  } catch (e: any) {
    console.error('DEVICE CREATE ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
