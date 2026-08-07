import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSuperAdminSession } from '@/lib/super-admin-auth';

// GET /api/super-admin/leads — landing formundan gelen talepler (yenisi üstte)
export async function GET(req: NextRequest) {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hepsi = new URL(req.url).searchParams.get('hepsi') === '1';
  const leads = await prisma.lead.findMany({
    where: hepsi ? {} : { okundu: false },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const bekleyen = await prisma.lead.count({ where: { okundu: false } });
  return NextResponse.json({ leads, bekleyen });
}

// PATCH — okundu işaretle / geri al
export async function PATCH(req: NextRequest) {
  const admin = await getSuperAdminSession();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, okundu } = await req.json();
  if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 });

  await prisma.lead.update({ where: { id }, data: { okundu: okundu !== false } });
  return NextResponse.json({ ok: true });
}
