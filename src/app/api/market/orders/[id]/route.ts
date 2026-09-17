import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import { marketAuth } from '@/lib/market';
import { completeOrder } from '@/lib/market-settle';

// PATCH /api/market/orders/[id] { action } — durum geçişi (rol + mevcut-durum CAS). complete → Faz 2 settle (alıcı).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await marketAuth();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const me = a.user!.tenantId;

  const o = await prisma.marketOrder.findFirst({
    where: { id, OR: [{ sellerTenantId: me }, { buyerTenantId: me }] },
    select: { id: true, sellerTenantId: true, buyerTenantId: true, status: true },
  });
  if (!o) return ucHatasi('SIPARIS_BULUNAMADI', 404);

  let b: any;
  try { b = await req.json(); } catch { return ucHatasi('GECERSIZ_ISTEK', 400); }
  const role: 'seller' | 'buyer' = o.sellerTenantId === me ? 'seller' : 'buyer';
  const action = b.action;

  // ── complete: yalnız ALICI, atomik claim + iki taraflı settle (market-settle) ──
  if (action === 'complete') {
    if (role !== 'buyer') return ucHatasi('SIPARISI_YALNIZ_ALICI_TAMAMLAYABILIR', 403);
    try {
      const r = await completeOrder(o.id, me);
      if (!r.ok) return ucHatasi('SIPARIS_DURUMU_DEGISMIS_SAYFAYI_YENILEYIN', 409);
      return NextResponse.json({ ok: true, status: 'COMPLETED', settled: r.settled });
    } catch (e: any) {
      console.error('MARKET COMPLETE/SETTLE ERROR:', e?.message);
      if (e?.message === 'SETTLE_INSUFFICIENT_STOCK') return ucHatasi('SATICININ_STOGU_YETERSIZ_TAMAMLANAMADI_SATICIYLA', 409);
      return ucHatasi('TAMAMLAMA_SIRASINDA_HATA_OLUSTU_TEKRAR', 500);
    }
  }

  // ── Diğer geçişler: rol + mevcut-durum CAS (updateMany WHERE guard) ──
  let from: string[]; let to: string; let allowedRole: 'seller' | 'buyer' | 'any';
  switch (action) {
    case 'accept': from = ['REQUESTED']; to = 'ACCEPTED'; allowedRole = 'seller'; break;
    case 'reject': from = ['REQUESTED']; to = 'REJECTED'; allowedRole = 'seller'; break;
    case 'ship': from = ['ACCEPTED']; to = 'SHIPPED'; allowedRole = 'seller'; break;
    case 'cancel': from = ['REQUESTED', 'ACCEPTED']; to = 'CANCELLED'; allowedRole = 'any'; break;
    default: return ucHatasi('GECERSIZ_ISLEM', 400);
  }
  if (allowedRole !== 'any' && role !== allowedRole) return ucHatasi('BU_ISLEM_ICIN_YETKIN_YOK', 403);

  const where: any = { id: o.id, status: { in: from } };
  if (allowedRole === 'seller') where.sellerTenantId = me;
  else where.OR = [{ sellerTenantId: me }, { buyerTenantId: me }];

  const upd = await prisma.marketOrder.updateMany({ where, data: { status: to } });
  if (upd.count === 0) return ucHatasi('BU_ISLEM_SU_AN_YAPILAMAZ', 409);
  return NextResponse.json({ ok: true, status: to });
}
