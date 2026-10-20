import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSuperAdminSession } from '@/lib/super-admin-auth';

export const dynamic = 'force-dynamic';

/** GET — kendi hesabı. PATCH { mevcut, yeni } — kendi şifresini değiştir (her rol). */
export async function GET() {
  const sa = await getSuperAdminSession();
  if (!sa) return NextResponse.json({ hata: 'YETKI' }, { status: 401 });
  const h = await prisma.superAdmin.findUnique({ where: { id: sa.id }, select: { name: true, email: true, totpEnabled: true, recoveryCodes: true } });
  if (!h) return NextResponse.json({ hata: 'YOK' }, { status: 404 });
  return NextResponse.json({ ad: h.name, eposta: h.email, rol: sa.rol, ikiAdim: h.totpEnabled, kurtarmaKalan: h.recoveryCodes.length });
}

export async function PATCH(req: NextRequest) {
  const sa = await getSuperAdminSession();
  if (!sa) return NextResponse.json({ hata: 'YETKI' }, { status: 401 });
  const g = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mevcut = typeof g.mevcut === 'string' ? g.mevcut : '';
  const yeni = typeof g.yeni === 'string' ? g.yeni : '';
  if (yeni.length < 10 || yeni.length > 200) return NextResponse.json({ hata: 'SIFRE_KISA' }, { status: 400 });
  const h = await prisma.superAdmin.findUnique({ where: { id: sa.id }, select: { password: true } });
  if (!h) return NextResponse.json({ hata: 'YOK' }, { status: 404 });
  if (!(await bcrypt.compare(mevcut, h.password))) return NextResponse.json({ hata: 'SIFRE_HATALI' }, { status: 400 });
  await prisma.superAdmin.update({ where: { id: sa.id }, data: { password: await bcrypt.hash(yeni, 12) } });
  return NextResponse.json({ ok: true });
}
