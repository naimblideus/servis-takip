// Faz 2: Bir siparişi ALICI tamamlar → durum geçişi + İKİ tarafın stok+muhasebesi TEK transaction'da.
// Satıcı: stok düşer (kaynağa bağlıysa, yetersizse rollback) + gelir; Alıcı: stoğa girer + gider. Faz 3: komisyon kaydı.
// Çapraz-tenant YAZIM — yalnız siparişin ALICISI tetikler. Atomik claim (status+settledAt) ile çift settle imkânsız.
import { prisma } from '@/lib/prisma';
import { TransactionType, TransactionCategory, PaymentMethod } from '@prisma/client';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function incomeCategory(kind?: string | null): TransactionCategory {
  if (kind === 'PART') return 'PART_SALE';
  if (kind === 'PRINTER' || kind === 'MACHINE') return 'MACHINE_SALE';
  return 'OTHER_INCOME';
}
function expenseCategory(kind?: string | null): TransactionCategory {
  if (kind === 'PART') return 'PART_PURCHASE';
  if (kind === 'PRINTER' || kind === 'MACHINE') return 'MACHINE_PURCHASE';
  return 'OTHER_EXPENSE';
}

export type CompleteResult = { ok: boolean; settled: boolean; reason?: string };

/**
 * Siparişi tamamla + takası işle. ATOMİK: durum geçişi (ACCEPTED/SHIPPED→COMPLETED) ve settledAt
 * tek bir koşullu updateMany ile "claim" edilir; eşzamanlı/çift istekte yalnız biri kazanır (count===1).
 * Yan etkilerden biri patlarsa (ör. yetersiz satıcı stoğu) TÜM transaction geri alınır → sipariş
 * COMPLETED'e geçmez, tekrar denenebilir. Yalnız ALICI çağırabilir (buyerTenantId guard).
 */
export async function completeOrder(orderId: string, buyerTenantId: string): Promise<CompleteResult> {
  return prisma.$transaction(async (tx) => {
    // ── ATOMİK CLAIM: yalnız alıcı, yalnız ACCEPTED/SHIPPED, yalnız settledAt=null ──
    const claim = await tx.marketOrder.updateMany({
      where: { id: orderId, buyerTenantId, status: { in: ['ACCEPTED', 'SHIPPED'] }, settledAt: null },
      data: { status: 'COMPLETED', settledAt: new Date() },
    });
    if (claim.count === 0) return { ok: false, settled: false, reason: 'conflict' };

    const o = await tx.marketOrder.findUnique({ where: { id: orderId } });
    if (!o) return { ok: false, settled: false, reason: 'notfound' };

    const listing = await tx.marketListing.findUnique({ where: { id: o.listingId } });
    const kind = o.listingKind || listing?.kind || 'OTHER';
    const qty = o.quantity;
    const total = Number(o.totalPrice);
    const unit = Number(o.unitPrice);
    const title = o.listingTitle || listing?.title || 'Pazar ürünü';

    // ── SATICI: stok düş (kaynağa bağlıysa). Yetersizse THROW → tüm tx rollback (sahte stok/para önle) ──
    if (listing?.sourceKind === 'PART' && listing.sourceId) {
      const r = await tx.part.updateMany({ where: { id: listing.sourceId, tenantId: o.sellerTenantId, stockQty: { gte: qty } }, data: { stockQty: { decrement: qty } } });
      if (r.count === 0) throw new Error('SETTLE_INSUFFICIENT_STOCK');
    } else if (listing?.sourceKind === 'PRINTER' && listing.sourceId) {
      const r = await tx.printerStock.updateMany({ where: { id: listing.sourceId, tenantId: o.sellerTenantId, quantity: { gte: qty } }, data: { quantity: { decrement: qty } } });
      if (r.count === 0) throw new Error('SETTLE_INSUFFICIENT_STOCK');
    }
    if (listing) {
      const remaining = Math.max(0, listing.quantity - qty);
      await tx.marketListing.update({ where: { id: listing.id }, data: { quantity: remaining, ...(remaining <= 0 ? { status: 'SOLD' } : {}) } });
    }

    // ── SATICI geliri ──
    await tx.financialTransaction.create({
      data: {
        tenantId: o.sellerTenantId, type: 'INCOME' as TransactionType, category: incomeCategory(kind),
        amount: total, method: 'OTHER' as PaymentMethod,
        description: `Pazar satışı: ${title} × ${qty} → ${o.buyerName || 'bayi'}`, date: new Date(),
      },
    });

    // ── ALICI: stoğa gir ──
    if (kind === 'PART' || kind === 'OTHER') {
      await tx.part.create({
        data: { tenantId: o.buyerTenantId, sku: `PZR-${o.id}`, name: title, buyPrice: unit, sellPrice: 0, stockQty: qty, group: 'Pazar' },
      });
    } else {
      await tx.printerStock.create({
        data: { tenantId: o.buyerTenantId, category: kind === 'MACHINE' ? 'YAZICI' : 'TONER', brand: listing?.brand || title.slice(0, 60), model: listing?.model || '-', quantity: qty, buyPrice: unit, sellPrice: 0, notes: 'Bayi Pazarı alımı' },
      });
    }

    // ── ALICI gideri ──
    await tx.financialTransaction.create({
      data: {
        tenantId: o.buyerTenantId, type: 'EXPENSE' as TransactionType, category: expenseCategory(kind),
        amount: total, method: 'OTHER' as PaymentMethod,
        description: `Pazar alışı: ${title} × ${qty} ← ${o.sellerName || 'bayi'}`, date: new Date(),
      },
    });

    // ── Faz 3: komisyon kaydı (raporlama amaçlı; 0..100 clamp ile overflow önle) ──
    const ps = await tx.platformSettings.findFirst({ select: { marketCommissionPct: true } });
    const pct = ps ? Math.max(0, Math.min(100, Number(ps.marketCommissionPct))) : 0;
    const commission = round2((total * pct) / 100);
    await tx.marketOrder.update({ where: { id: o.id }, data: { commissionPct: pct, commissionAmount: commission } });

    return { ok: true, settled: true };
  }, { timeout: 20000, maxWait: 10000 });
}
