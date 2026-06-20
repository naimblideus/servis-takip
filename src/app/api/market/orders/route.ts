import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketAuth } from '@/lib/market';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// POST /api/market/orders { listingId, quantity, note } — alıcı sipariş/teklif oluşturur
export async function POST(req: Request) {
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const me = a.user!.tenantId;

  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }); }
  if (!b.listingId) return NextResponse.json({ error: 'listingId zorunlu' }, { status: 400 });

  const listing = await prisma.marketListing.findUnique({ where: { id: b.listingId } });
  if (!listing || listing.status !== 'ACTIVE') return NextResponse.json({ error: 'İlan aktif değil' }, { status: 400 });
  if (listing.sellerTenantId === me) return NextResponse.json({ error: 'Kendi ilanına sipariş veremezsin' }, { status: 400 });

  // Satıcı hâlâ pazara açık mı
  const seller = await prisma.tenant.findUnique({ where: { id: listing.sellerTenantId }, select: { marketEnabled: true, name: true, marketDisplayName: true } });
  if (!seller?.marketEnabled) return NextResponse.json({ error: 'Satıcı şu an pazarda değil' }, { status: 400 });

  // Spam koruması: son 1 saatte 30 sipariş
  const since = new Date(Date.now() - 3600 * 1000);
  const recent = await prisma.marketOrder.count({ where: { buyerTenantId: me, createdAt: { gte: since } } });
  if (recent >= 30) return NextResponse.json({ error: 'Çok fazla sipariş, biraz bekleyin' }, { status: 429 });

  const quantity = Math.max(1, Math.min(listing.quantity, parseInt(b.quantity) || 1));
  const unitPrice = Number(listing.price);
  const totalPrice = round2(unitPrice * quantity);

  const order = await prisma.marketOrder.create({
    data: {
      listingId: listing.id, sellerTenantId: listing.sellerTenantId, buyerTenantId: me,
      quantity, unitPrice, totalPrice, status: 'REQUESTED',
      note: b.note ? String(b.note).slice(0, 1000) : null,
      buyerName: a.tenant!.marketDisplayName || a.tenant!.name,
      sellerName: seller.marketDisplayName || seller.name,
      listingTitle: listing.title, listingKind: listing.kind,
    },
  });
  return NextResponse.json({ ok: true, id: order.id });
}

// GET /api/market/orders — kendi siparişlerim (alım + satım)
export async function GET() {
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const me = a.user!.tenantId;

  const orders = await prisma.marketOrder.findMany({
    where: { OR: [{ sellerTenantId: me }, { buyerTenantId: me }] },
    orderBy: { createdAt: 'desc' }, take: 200,
  });

  // Hangi siparişleri değerlendirdim (alıcı olarak)
  const myReviews = await prisma.marketReview.findMany({ where: { raterTenantId: me, orderId: { in: orders.map((o) => o.id) } }, select: { orderId: true } });
  const reviewed = new Set(myReviews.map((r) => r.orderId));

  return NextResponse.json({
    orders: orders.map((o) => {
      const role: 'seller' | 'buyer' = o.sellerTenantId === me ? 'seller' : 'buyer';
      return {
        id: o.id, listingId: o.listingId, listingTitle: o.listingTitle, listingKind: o.listingKind,
        role, counterparty: role === 'seller' ? o.buyerName : o.sellerName,
        quantity: o.quantity, unitPrice: Number(o.unitPrice), totalPrice: Number(o.totalPrice),
        status: o.status, note: o.note, createdAt: o.createdAt, settled: !!o.settledAt,
        canReview: role === 'buyer' && o.status === 'COMPLETED' && !reviewed.has(o.id),
      };
    }),
  });
}
