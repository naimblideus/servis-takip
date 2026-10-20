import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { saRol } from '@/lib/super-admin-rol';

export const dynamic = 'force-dynamic';

/**
 * EKİP HESAPLARI — yalnız SAHIP. Middleware ekip rolünü bu yola zaten
 * sokmuyor; burada ikinci kez denetleniyor (yetki tek kapıya bırakılmaz).
 * Hatalar KOD döner, cümleyi ekran kurar (lib/ekip-metin).
 */
async function sahip() {
  const sa = await getSuperAdminSession();
  if (!sa) return { yanit: NextResponse.json({ hata: 'YETKI' }, { status: 401 }) } as const;
  if (sa.rol !== 'SAHIP') return { yanit: NextResponse.json({ hata: 'YETKI' }, { status: 403 }) } as const;
  return { sa } as const;
}

const sahipSayisi = () => prisma.superAdmin.count({ where: { rol: 'SAHIP' } });

export async function GET() {
  const k = await sahip();
  if ('yanit' in k) return k.yanit;
  const hesaplar = await prisma.superAdmin.findMany({
    orderBy: [{ rol: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, email: true, rol: true, totpEnabled: true, lastLoginAt: true, createdAt: true },
  });
  return NextResponse.json({ hesaplar: hesaplar.map((h) => ({ ...h, rol: saRol(h.rol) })), benimId: k.sa.id });
}

export async function POST(req: NextRequest) {
  const k = await sahip();
  if ('yanit' in k) return k.yanit;
  const g = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ad = typeof g.ad === 'string' ? g.ad.trim().slice(0, 80) : '';
  const eposta = typeof g.eposta === 'string' ? g.eposta.trim().toLowerCase() : '';
  const sifre = typeof g.sifre === 'string' ? g.sifre : '';
  const rol = saRol(g.rol === 'SAHIP' ? 'SAHIP' : 'EKIP');
  if (ad.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta) || sifre.length < 10 || sifre.length > 200) {
    return NextResponse.json({ hata: 'GECERSIZ' }, { status: 400 });
  }
  const var_ = await prisma.superAdmin.findUnique({ where: { email: eposta }, select: { id: true } });
  if (var_) return NextResponse.json({ hata: 'VAR' }, { status: 409 });
  const h = await prisma.superAdmin.create({
    data: { name: ad, email: eposta, password: await bcrypt.hash(sifre, 12), rol },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: h.id });
}

/** PATCH { id, rol } — rol değiştir. Kendi rolünü düşüremez; son sahip korunur. */
export async function PATCH(req: NextRequest) {
  const k = await sahip();
  if ('yanit' in k) return k.yanit;
  const g = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof g.id === 'string' ? g.id : '';
  const rol = saRol(g.rol);
  const h = id ? await prisma.superAdmin.findUnique({ where: { id }, select: { id: true, rol: true } }) : null;
  if (!h) return NextResponse.json({ hata: 'YOK' }, { status: 404 });
  if (h.id === k.sa.id && rol !== 'SAHIP') return NextResponse.json({ hata: 'KENDINI' }, { status: 400 });
  if (saRol(h.rol) === 'SAHIP' && rol === 'EKIP' && (await sahipSayisi()) <= 1) return NextResponse.json({ hata: 'SON_SAHIP' }, { status: 400 });
  await prisma.superAdmin.update({ where: { id }, data: { rol } });
  return NextResponse.json({ ok: true });
}

/** DELETE ?id= — hesabı kaldır. Kendini kaldıramaz; son sahip korunur. */
export async function DELETE(req: NextRequest) {
  const k = await sahip();
  if ('yanit' in k) return k.yanit;
  const id = new URL(req.url).searchParams.get('id') || '';
  const h = id ? await prisma.superAdmin.findUnique({ where: { id }, select: { id: true, rol: true } }) : null;
  if (!h) return NextResponse.json({ hata: 'YOK' }, { status: 404 });
  if (h.id === k.sa.id) return NextResponse.json({ hata: 'KENDINI' }, { status: 400 });
  if (saRol(h.rol) === 'SAHIP' && (await sahipSayisi()) <= 1) return NextResponse.json({ hata: 'SON_SAHIP' }, { status: 400 });
  await prisma.superAdmin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
