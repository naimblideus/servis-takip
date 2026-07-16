import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PaymentStatus, PaymentMethod, TransactionType, TransactionCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { syncTicketToCari } from '@/lib/ticket-cari';

type PayResult =
  | { ok: false; status: number; error: string }
  | { ok: true; payment: any; newStatus: PaymentStatus; totalPaid: number; totalCost: number; remaining: number };

// POST /api/accounting/debtors/pay — Borçluya ödeme al (tekli fiş)
// Güvenlik: ticket TENANT-scoped yüklenir (cross-tenant IDOR kapalı); tüm okuma+yazma
// Serializable transaction'da (eşzamanlı overpay race kapalı).
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const body = await req.json();
    const { ticketId, amount, method, notes } = body;

    const amt = parseFloat(amount);
    if (!ticketId || !amt || amt <= 0) {
      return NextResponse.json({ error: 'ticketId ve geçerli amount zorunlu' }, { status: 400 });
    }

    const runTxn = (): Promise<PayResult> => prisma.$transaction(async (tx) => {
      const ticket = await tx.serviceTicket.findFirst({
        where: { id: ticketId, tenantId, deletedAt: null, status: { not: 'CANCELLED' as any } }, // tenant + iptal/silinmiş guard
        include: { payments: { select: { amount: true } } },
      });
      if (!ticket) return { ok: false, status: 404, error: 'Fiş bulunamadı' };

      const currentPaid = ticket.payments.reduce((s, p) => s + Number(p.amount), 0);
      const totalCost = Number(ticket.totalCost) || 0;
      const maxPayable = totalCost - currentPaid;
      if (maxPayable <= 0) return { ok: false, status: 400, error: 'Bu fiş zaten tamamen ödenmiş' };

      const payAmount = Math.min(amt, maxPayable);
      const totalPaid = currentPaid + payAmount;
      const newStatus = (totalPaid >= totalCost ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID') as PaymentStatus;

      const payment = await tx.payment.create({
        data: {
          tenantId, ticketId, amount: payAmount,
          method: (method || 'CASH') as PaymentMethod,
          paymentDate: new Date(), notes: notes || null,
        },
      });
      await tx.serviceTicket.update({ where: { id: ticketId }, data: { paymentStatus: newStatus } });
      await tx.financialTransaction.create({
        data: {
          tenantId, type: 'INCOME' as TransactionType, category: 'SERVICE_FEE' as TransactionCategory,
          amount: payAmount, method: (method || 'CASH') as PaymentMethod,
          description: `Borç ödemesi: ${ticket.ticketNumber}${notes ? ` — ${notes}` : ''}`,
          customerId: ticket.customerId, ticketId: ticket.id, date: new Date(),
        },
      });
      return { ok: true, payment, newStatus, totalPaid, totalCost, remaining: Math.max(0, totalCost - totalPaid) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Serialization çakışmasında (P2034) kısa retry — overpay yerine güvenli yeniden dene.
    let result: PayResult | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { result = await runTxn(); break; }
      catch (e: any) { if (e?.code === 'P2034' && attempt < 2) continue; throw e; }
    }
    if (!result) return NextResponse.json({ error: 'İşlem çakışması, tekrar deneyin' }, { status: 409 });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    // Cari (AccountEntry) defterini bu ödemeye göre uzlaştır (idempotent).
    try { await syncTicketToCari(ticketId, tenantId); } catch (e: any) { console.error('DEBTOR PAY CARI SYNC ERROR:', e?.message); }

    return NextResponse.json({
      payment: result.payment,
      newPaymentStatus: result.newStatus,
      totalPaid: result.totalPaid,
      totalCost: result.totalCost,
      remaining: result.remaining,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
