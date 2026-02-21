import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  const customers = await prisma.customer.findMany({
    where: { tenantId: user!.tenantId },
    include: { devices: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(customers);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const body = await req.json();
    const customer = await prisma.customer.create({
      data: {
        tenantId: user.tenantId,
        name: body.name,
        phone: body.phone,
        address: body.address || null,
        taxNo: body.taxNo || null,
        consent: body.consent ?? false,
      },
    });
    return NextResponse.json(customer);
  } catch (e: any) {
    console.error('CUSTOMER CREATE ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
