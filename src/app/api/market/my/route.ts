import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketAuth, publicListing } from '@/lib/market';

// GET /api/market/my — kendi ilanlarım (tüm durumlar, REMOVED hariç)
export async function GET() {
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });

  const listings = await prisma.marketListing.findMany({
    where: { sellerTenantId: a.user!.tenantId, status: { not: 'REMOVED' } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const seller = { name: a.tenant!.marketDisplayName || a.tenant!.name, city: a.tenant!.marketCity || null };
  return NextResponse.json({ listings: listings.map((l) => publicListing(l, seller, true, true)) });
}
