import { NextResponse } from 'next/server';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { siparisVerisi } from '@/lib/tedarik-siparisi-veri';

// GET — asgari stoğun altındaki kalemler, son tedarikçiye göre gruplu.
// Alış fiyatı ve tedarikçi mali veri: yalnız yönetici.
export async function GET() {
  let tenantId: string;
  try { ({ tenantId } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }
  const [veri, firma] = await Promise.all([
    siparisVerisi(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
  ]);
  return NextResponse.json({ ...veri, firma: firma?.name ?? '' });
}
