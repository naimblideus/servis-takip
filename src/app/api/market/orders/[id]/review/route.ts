import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketAuth } from '@/lib/market';

// POST /api/market/orders/[id]/review { score, comment } — alıcı, tamamlanan siparişte satıcıyı değerlendirir
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const me = a.user!.tenantId;

  const o = await prisma.marketOrder.findFirst({ where: { id, buyerTenantId: me } });
  if (!o) return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 });
  if (o.status !== 'COMPLETED') return NextResponse.json({ error: 'Yalnız tamamlanan siparişler değerlendirilebilir' }, { status: 400 });

  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }); }
  const score = Math.max(1, Math.min(5, parseInt(b.score) || 0));
  if (!score) return NextResponse.json({ error: 'Puan 1-5 olmalı' }, { status: 400 });

  const exists = await prisma.marketReview.findUnique({ where: { orderId: o.id } });
  if (exists) return NextResponse.json({ error: 'Bu sipariş zaten değerlendirildi' }, { status: 409 });

  await prisma.marketReview.create({
    data: { orderId: o.id, listingId: o.listingId, raterTenantId: me, ratedTenantId: o.sellerTenantId, score, comment: b.comment ? String(b.comment).slice(0, 1000) : null },
  });
  return NextResponse.json({ ok: true });
}
