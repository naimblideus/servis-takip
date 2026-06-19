import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketAuth } from '@/lib/market';

// GET /api/market/profile — bayinin pazar profili (katıldı mı, görünen ad/şehir/telefon)
export async function GET() {
  const a = await marketAuth(false); // katılım gerekmez (katılmak için de bu uç kullanılır)
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  return NextResponse.json({
    enabled: a.tenant!.marketEnabled,
    displayName: a.tenant!.marketDisplayName || a.tenant!.name,
    city: a.tenant!.marketCity || '',
    contactPhone: a.tenant!.marketContactPhone || '',
    role: a.user!.role,
  });
}

// PATCH /api/market/profile — pazara katıl/ayrıl + profil güncelle (yalnız ADMIN)
export async function PATCH(req: Request) {
  const a = await marketAuth(false);
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  if (a.user!.role !== 'ADMIN' && a.user!.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Bu ayarı yalnızca yönetici değiştirebilir' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }); }

  const data: any = {};
  if (body.enabled !== undefined) data.marketEnabled = !!body.enabled;
  if (body.displayName !== undefined) data.marketDisplayName = body.displayName ? String(body.displayName).slice(0, 120) : null;
  if (body.city !== undefined) data.marketCity = body.city ? String(body.city).slice(0, 80) : null;
  if (body.contactPhone !== undefined) data.marketContactPhone = body.contactPhone ? String(body.contactPhone).slice(0, 40) : null;

  const ops: any[] = [prisma.tenant.update({ where: { id: a.user!.tenantId }, data })];
  // Pazardan ayrılınca aktif ilanları duraklat (hayalet ilan + cevapsız alıcı önle)
  if (body.enabled === false) {
    ops.push(prisma.marketListing.updateMany({ where: { sellerTenantId: a.user!.tenantId, status: 'ACTIVE' }, data: { status: 'PAUSED' } }));
  }
  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true });
}
