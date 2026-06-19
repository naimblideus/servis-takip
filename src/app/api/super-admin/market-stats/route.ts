import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET — Bayi Pazarı platform istatistikleri (super-admin; tüm tenant'lar). middleware /api/super-admin korur.
export async function GET() {
  const [totalOrders, completed, activeListings, sellers, recent] = await Promise.all([
    prisma.marketOrder.count(),
    prisma.marketOrder.findMany({ where: { status: 'COMPLETED' }, select: { totalPrice: true, commissionAmount: true } }),
    prisma.marketListing.count({ where: { status: 'ACTIVE' } }),
    prisma.tenant.count({ where: { marketEnabled: true } }),
    prisma.marketOrder.findMany({
      where: { status: 'COMPLETED' }, orderBy: { updatedAt: 'desc' }, take: 20,
      select: { id: true, listingTitle: true, totalPrice: true, commissionAmount: true, commissionPct: true, buyerName: true, sellerName: true, updatedAt: true },
    }),
  ]);

  const gmv = completed.reduce((s, o) => s + Number(o.totalPrice), 0);
  const commission = completed.reduce((s, o) => s + Number(o.commissionAmount || 0), 0);

  return NextResponse.json({
    totalOrders, completedCount: completed.length, gmv, commission, activeListings, sellers,
    recent: recent.map((o) => ({
      id: o.id, title: o.listingTitle, total: Number(o.totalPrice), commission: Number(o.commissionAmount || 0),
      pct: Number(o.commissionPct || 0), buyer: o.buyerName, seller: o.sellerName, at: o.updatedAt,
    })),
  });
}
