import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// POST /api/sales — Barkodlu satış: stok düşümü + muhasebe (cari) kaydı, atomik.
// body: { customerId, paid: boolean, method, date?, items: [{ kind:'PART'|'PRINTER', id, qty, unitPrice, name }] }
//  - paid=true (peşin): AccountEntry SALE + PAYMENT (net borç 0, kasaya tahsilat)
//  - paid=false (açık hesap): yalnız AccountEntry SALE (cari borç)
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }); }

  const { customerId, paid, method, date } = body;
  const items: any[] = Array.isArray(body.items) ? body.items : [];
  if (!customerId) return NextResponse.json({ error: 'Müşteri seçilmeli' }, { status: 400 });
  if (items.length === 0) return NextResponse.json({ error: 'En az bir ürün okutun' }, { status: 400 });

  // Müşteri bu tenant'a ait mi (IDOR)
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId: user.tenantId } });
  if (!customer) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });

  // Satışı yapan teknisyen: elle girilebilir; geçerli kullanıcı seçildiyse id'si de tutulur, yoksa giriş yapan.
  let sellerUserId = user.id;
  if (body.sellerUserId) {
    const u = await prisma.user.findFirst({ where: { id: body.sellerUserId, tenantId: user.tenantId }, select: { id: true } });
    if (u) sellerUserId = u.id;
  }
  const sellerName = (typeof body.sellerName === 'string' && body.sellerName.trim()) ? body.sellerName.trim().slice(0, 80) : user.name;

  const when = date ? new Date(date) : new Date();
  const saleMethod = paid ? (method || 'CASH') : 'OPEN_ACCOUNT';

  try {
    const result = await prisma.$transaction(async (tx) => {
      let total = 0;
      const lines: { name: string; qty: number; amount: number }[] = [];

      for (const it of items) {
        const qty = Math.max(1, parseInt(it.qty) || 1);
        const unitPrice = Math.max(0, parseFloat(it.unitPrice) || 0);
        const amount = round2(qty * unitPrice);

        if (it.kind === 'PART') {
          const part = await tx.part.findFirst({ where: { id: it.id, tenantId: user.tenantId } });
          if (!part) throw new Error(`Parça bulunamadı: ${it.name || it.id}`);
          // Atomik koşullu düşüm: stockQty>=qty değilse hiç güncellemez — yarış koşulunda bile negatif stok imkansız
          const dec = await tx.part.updateMany({
            where: { id: part.id, tenantId: user.tenantId, stockQty: { gte: qty } },
            data: { stockQty: { decrement: qty } },
          });
          if (dec.count === 0) throw new Error(`Yetersiz stok: ${part.name} (mevcut ${part.stockQty}, istenen ${qty})`);
          lines.push({ name: part.name, qty, amount });
          total += amount;
        } else if (it.kind === 'PRINTER') {
          const ps = await tx.printerStock.findFirst({ where: { id: it.id, tenantId: user.tenantId } });
          if (!ps) throw new Error(`Stok bulunamadı: ${it.name || it.id}`);
          const psName = [ps.brand, ps.model, ps.color].filter(Boolean).join(' ');
          const dec = await tx.printerStock.updateMany({
            where: { id: ps.id, tenantId: user.tenantId, quantity: { gte: qty } },
            data: { quantity: { decrement: qty } },
          });
          if (dec.count === 0) throw new Error(`Yetersiz stok: ${psName} (mevcut ${ps.quantity}, istenen ${qty})`);
          // Stok 0'a indiyse kalemi emekliye ayır (satış/etiket/stok listelerinden düşsün)
          const after = await tx.printerStock.findFirst({ where: { id: ps.id }, select: { quantity: true } });
          if (after && after.quantity <= 0) await tx.printerStock.update({ where: { id: ps.id }, data: { soldAt: when, soldTo: customer.name } });
          lines.push({ name: psName, qty, amount });
          total += amount;
        } else {
          throw new Error('Geçersiz ürün türü');
        }
      }

      total = round2(total);

      // Her kalem için cari SATIŞ kaydı (muhasebe ile aynı AccountEntry modeli)
      for (const l of lines) {
        await tx.accountEntry.create({
          data: {
            tenantId: user.tenantId,
            customerId,
            type: 'SALE',
            product: l.qty > 1 ? `${l.name} ×${l.qty}` : l.name,
            amount: l.amount,
            method: saleMethod,
            notes: 'Barkodlu satış',
            createdByUserId: sellerUserId,
            createdByName: sellerName,
            date: when,
          },
        });
      }

      // Peşin ise eş zamanlı tahsilat (PAYMENT) — borç net 0 kalır
      if (paid) {
        await tx.accountEntry.create({
          data: {
            tenantId: user.tenantId,
            customerId,
            type: 'PAYMENT',
            product: null,
            amount: total,
            method: method || 'CASH',
            notes: 'Peşin satış tahsilatı',
            createdByUserId: sellerUserId,
            createdByName: sellerName,
            date: when,
          },
        });
      }

      return { total, count: lines.length };
    }, { timeout: 20000, maxWait: 10000 });

    return NextResponse.json({ ok: true, ...result, paid: !!paid });
  } catch (e: any) {
    console.error('SALE ERROR:', e?.message);
    return NextResponse.json({ error: e?.message || 'Satış kaydedilemedi' }, { status: 400 });
  }
}
