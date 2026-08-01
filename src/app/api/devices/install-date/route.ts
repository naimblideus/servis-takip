import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Cihaz kurulum tarihi — toplu görüntüleme ve kaydetme.
 *
 * Neden ayrı ekran: kurulum tarihi teknisyenin sahada bilmediği ama bayi
 * sahibinin bildiği bir bilgi. Fiş akışına eklemek sahadaki hızı bozar —
 * bu yüzden isteğe bağlı, tek oturumda bitirilebilen ayrı bir yere konuldu.
 */

// GET: kurulum tarihi eksik cihazlar + genel kapsam
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const take = Math.min(parseInt(searchParams.get('take') || '60'), 200);
  const q = (searchParams.get('q') || '').trim();

  const [toplam, dolu] = await Promise.all([
    prisma.device.count({ where: { tenantId: user.tenantId } }),
    prisma.device.count({ where: { tenantId: user.tenantId, installedAt: { not: null } } }),
  ]);

  const devices = await prisma.device.findMany({
    where: {
      tenantId: user.tenantId,
      installedAt: null,
      ...(q ? {
        OR: [
          { brand: { contains: q, mode: 'insensitive' } },
          { model: { contains: q, mode: 'insensitive' } },
          { serialNo: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
        ],
      } : {}),
    },
    select: {
      id: true, brand: true, model: true, serialNo: true,
      customer: { select: { name: true } },
    },
    // Aynı müşterinin cihazları yan yana gelsin — bayi tek tarihi seri girebilsin
    orderBy: [{ customerId: 'asc' }, { brand: 'asc' }],
    take,
  });

  return NextResponse.json({ toplam, dolu, eksik: toplam - dolu, devices });
}

// PATCH: { ids: string[], installedAt: string|null } — toplu tarih ata
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : [];
    if (!ids.length) return NextResponse.json({ error: 'Cihaz seçilmedi' }, { status: 400 });

    let tarih: Date | null = null;
    if (body.installedAt) {
      tarih = new Date(body.installedAt);
      if (Number.isNaN(tarih.getTime())) return NextResponse.json({ error: 'Geçersiz tarih' }, { status: 400 });
      // Gelecek tarih kabul edilmez — cihaz henüz kurulmamışsa boş kalmalı, tahmin yazılmaz
      if (tarih.getTime() > Date.now()) return NextResponse.json({ error: 'Kurulum tarihi gelecekte olamaz' }, { status: 400 });
    }

    // IDOR koruması: yalnızca bu tenant'ın cihazları
    const res = await prisma.device.updateMany({
      where: { id: { in: ids }, tenantId: user.tenantId },
      data: { installedAt: tarih },
    });

    const [toplam, dolu] = await Promise.all([
      prisma.device.count({ where: { tenantId: user.tenantId } }),
      prisma.device.count({ where: { tenantId: user.tenantId, installedAt: { not: null } } }),
    ]);

    return NextResponse.json({ guncellenen: res.count, toplam, dolu });
  } catch (e: any) {
    console.error('INSTALL DATE PATCH ERROR:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
