import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/devices/[id]/toner — toner verimini ayarla ve/veya "toner değişti" referansını kaydet.
// body: { tonerYieldBlack?, tonerYieldColor?, markChangedBlack?, markChangedColor?, markChanged? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // IDOR: cihaz bu tenant'a mı ait?
    const device = await prisma.device.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!device) return NextResponse.json({ error: 'Cihaz bulunamadı' }, { status: 404 });

    const body = await req.json();
    const data: any = {};

    if (body.tonerYieldBlack !== undefined)
      data.tonerYieldBlack = body.tonerYieldBlack === '' || body.tonerYieldBlack === null ? null : Math.max(0, parseInt(body.tonerYieldBlack) || 0) || null;
    if (body.tonerYieldColor !== undefined)
      data.tonerYieldColor = body.tonerYieldColor === '' || body.tonerYieldColor === null ? null : Math.max(0, parseInt(body.tonerYieldColor) || 0) || null;

    const changeBlack = body.markChanged === true || body.markChangedBlack === true;
    const changeColor = body.markChanged === true || body.markChangedColor === true;
    if (changeBlack) data.tonerResetBlack = device.counterBlack ?? 0;
    if (changeColor) data.tonerResetColor = device.counterColor ?? 0;
    if (changeBlack || changeColor) data.tonerChangedAt = new Date();

    const updated = await prisma.device.update({ where: { id }, data });
    return NextResponse.json({
      ok: true,
      tonerYieldBlack: updated.tonerYieldBlack,
      tonerYieldColor: updated.tonerYieldColor,
      tonerResetBlack: updated.tonerResetBlack,
      tonerResetColor: updated.tonerResetColor,
      tonerChangedAt: updated.tonerChangedAt,
    });
  } catch (e: any) {
    console.error('TONER UPDATE ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
