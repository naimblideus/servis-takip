import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketAuth, publicListing } from '@/lib/market';

const MAX_PHOTOS = 4;
const sanitizePhotos = (v: any): string[] =>
  (Array.isArray(v) ? v : []).filter((p) => typeof p === 'string' && p.startsWith('data:image/') && p.length < 700000).slice(0, MAX_PHOTOS);

// GET /api/market/listings/[id] — ACTIVE ise herkes (marketEnabled); değilse yalnız sahibi
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });

  const l = await prisma.marketListing.findUnique({ where: { id } });
  if (!l) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });

  const isOwner = l.sellerTenantId === a.user!.tenantId;
  if (l.status !== 'ACTIVE' && !isOwner) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });

  const sellerTenant = await prisma.tenant.findUnique({
    where: { id: l.sellerTenantId },
    select: { name: true, marketDisplayName: true, marketCity: true, marketEnabled: true },
  });
  // Satıcı pazardan ayrıldıysa ilan başkalarına görünmez (hayalet ilan önle)
  if (!isOwner && !sellerTenant?.marketEnabled) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });

  const seller = sellerTenant ? { name: sellerTenant.marketDisplayName || sellerTenant.name, city: sellerTenant.marketCity || null } : undefined;
  return NextResponse.json({ listing: publicListing(l, seller, isOwner) });
}

// PATCH /api/market/listings/[id] — yalnız sahibi (IDOR koruması)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });

  const existing = await prisma.marketListing.findFirst({ where: { id, sellerTenantId: a.user!.tenantId } });
  if (!existing) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }); }

  const data: any = {};
  if (body.title !== undefined) { const t = String(body.title).trim(); if (!t) return NextResponse.json({ error: 'Başlık zorunlu' }, { status: 400 }); data.title = t.slice(0, 160); }
  if (body.description !== undefined) data.description = body.description ? String(body.description).slice(0, 2000) : null;
  if (body.kind !== undefined && ['PART', 'PRINTER', 'MACHINE', 'OTHER'].includes(body.kind)) data.kind = body.kind;
  if (body.brand !== undefined) data.brand = body.brand ? String(body.brand).slice(0, 80) : null;
  if (body.model !== undefined) data.model = body.model ? String(body.model).slice(0, 80) : null;
  if (body.condition !== undefined) data.condition = ['SIFIR', 'IKINCI_EL'].includes(body.condition) ? body.condition : null;
  if (body.category !== undefined) data.category = body.category ? String(body.category).slice(0, 80) : null;
  if (body.price !== undefined) data.price = Math.max(0, parseFloat(body.price) || 0);
  if (body.quantity !== undefined) data.quantity = Math.max(1, parseInt(body.quantity) || 1);
  if (body.unit !== undefined) data.unit = body.unit ? String(body.unit).slice(0, 20) : null;
  if (body.city !== undefined) data.city = body.city ? String(body.city).slice(0, 80) : null;
  if (body.photos !== undefined) data.photos = sanitizePhotos(body.photos);
  if (body.status !== undefined && ['ACTIVE', 'PAUSED', 'SOLD', 'REMOVED'].includes(body.status)) data.status = body.status;

  await prisma.marketListing.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE /api/market/listings/[id] — yalnız sahibi (kaldır)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });

  const res = await prisma.marketListing.updateMany({
    where: { id, sellerTenantId: a.user!.tenantId },
    data: { status: 'REMOVED' },
  });
  if (res.count === 0) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
