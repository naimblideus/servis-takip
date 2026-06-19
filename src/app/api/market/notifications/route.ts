import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketAuth } from '@/lib/market';

// GET /api/market/notifications — aksiyon bekleyen sayıları (rozet için). Pazara katılmamışsa 0.
export async function GET() {
  const a = await marketAuth(false); // enabled değilse 403 yerine sıfır dön
  if (a.error || !a.tenant?.marketEnabled) return NextResponse.json({ actionable: 0, incomingRequests: 0, toConfirm: 0 });
  const me = a.user!.tenantId;

  const [incomingRequests, toConfirm] = await Promise.all([
    prisma.marketOrder.count({ where: { sellerTenantId: me, status: 'REQUESTED' } }), // satıcı: onay bekleyen
    prisma.marketOrder.count({ where: { buyerTenantId: me, status: 'SHIPPED' } }),     // alıcı: teslim onayı verebilir
  ]);

  return NextResponse.json({ actionable: incomingRequests + toConfirm, incomingRequests, toConfirm });
}
