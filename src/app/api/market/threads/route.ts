import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketAuth, sellerDisplayMap } from '@/lib/market';

// GET /api/market/threads — kendi konuşmalarım (alıcı + satıcı), son mesajla
export async function GET() {
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const me = a.user!.tenantId;

  const msgs = await prisma.marketMessage.findMany({
    where: { OR: [{ sellerTenantId: me }, { buyerTenantId: me }] },
    orderBy: { createdAt: 'desc' },
    take: 400,
  });

  // (listingId + buyerTenantId) = thread; en yeni mesaj öne geldiği için ilk görülen = son mesaj
  const seen = new Set<string>();
  const threads: any[] = [];
  for (const m of msgs) {
    const key = `${m.listingId}|${m.buyerTenantId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const role: 'seller' | 'buyer' = m.sellerTenantId === me ? 'seller' : 'buyer';
    const counterpartyId = role === 'seller' ? m.buyerTenantId : m.sellerTenantId;
    threads.push({
      listingId: m.listingId, buyerTenantId: m.buyerTenantId, role, counterpartyId,
      lastBody: m.body, lastAt: m.createdAt, mineLast: m.senderTenantId === me,
    });
  }

  const sellers = await sellerDisplayMap(threads.map((t) => t.counterpartyId));
  const listings = await prisma.marketListing.findMany({
    where: { id: { in: Array.from(new Set(threads.map((t) => t.listingId))) } },
    select: { id: true, title: true, status: true },
  });
  const lmap = new Map(listings.map((l) => [l.id, l]));

  return NextResponse.json({
    threads: threads.map((t) => ({
      ...t,
      counterpartyName: sellers.get(t.counterpartyId)?.name || 'Bayi',
      listingTitle: lmap.get(t.listingId)?.title || 'İlan',
      listingStatus: lmap.get(t.listingId)?.status || 'REMOVED',
    })),
  });
}
