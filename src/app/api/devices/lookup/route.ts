import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/devices/lookup?code=DEV-8F3A12  (veya seri no)
// Barkod okuyucu akışı: cihazı TENANT-SCOPED bul (publicCode veya serialNo).
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const code = (new URL(req.url).searchParams.get('code') || '').trim();
  if (!code) return NextResponse.json({ error: 'code gerekli' }, { status: 400 });

  const device = await prisma.device.findFirst({
    where: { tenantId: user.tenantId, OR: [{ publicCode: code }, { serialNo: code }] },
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });
  if (!device) return NextResponse.json({ error: `Cihaz bulunamadı: ${code}` }, { status: 404 });

  return NextResponse.json({
    id: device.id,
    brand: device.brand,
    model: device.model,
    serialNo: device.serialNo,
    publicCode: device.publicCode,
    location: device.location,
    counterBlack: device.counterBlack,
    counterColor: device.counterColor,
    customer: device.customer,
  });
}
