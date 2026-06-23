// Servis fişini Muhasebe/Cari (AccountEntry) defterine otomatik yansıt.
// Tek kaynak + idempotent: her çağrıda fişin cari kayıtlarını (SATIŞ + TAHSİLAT) gerçek duruma göre
// yeniden uzlaştırır. Fiş kesilir kesilmez (tutarı>0 + müşterisi var + İPTAL/silinmemiş) cariye
// BORÇ olarak yazılır; ödeme girilince TAHSİLAT düşülür; iptal/silinince cari kaydı temizlenir.
import { prisma } from '@/lib/prisma';

export async function syncTicketToCari(ticketId: string, tenantId: string): Promise<{ synced: boolean; amount: number }> {
  return prisma.$transaction(async (tx) => {
    // Tenant-scoped (savunma derinliği): yalnız bu tenant'ın fişi
    const t = await tx.serviceTicket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        payments: { select: { amount: true, method: true, paymentDate: true } },
        assignedUser: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });
    if (!t) return { synced: false, amount: 0 };

    const existing = await tx.accountEntry.findMany({ where: { tenantId: t.tenantId, ticketId: t.id } });
    const total = Number(t.totalCost) || 0;
    const shouldHave = t.status !== 'CANCELLED' && !t.deletedAt && total > 0 && !!t.customerId;

    if (!shouldHave) {
      if (existing.length) await tx.accountEntry.deleteMany({ where: { tenantId: t.tenantId, ticketId: t.id } });
      return { synced: false, amount: 0 };
    }

    const who = t.assignedUser?.name || t.createdBy?.name || null;
    const product = `Servis ${t.ticketNumber}`;
    const saleDate = t.createdAt ?? t.statusUpdatedAt ?? new Date(); // SATIŞ = fiş tarihi (kesildiği an)
    const sale = existing.find((e) => e.type === 'SALE');
    const pay = existing.find((e) => e.type === 'PAYMENT');

    // SATIŞ (borç) — fişin toplam tutarı, teslim tarihiyle
    if (sale) {
      if (Number(sale.amount) !== total || sale.product !== product || +new Date(sale.date) !== +saleDate) {
        await tx.accountEntry.update({ where: { id: sale.id }, data: { amount: total, product, createdByName: who, date: saleDate } });
      }
    } else {
      await tx.accountEntry.create({
        data: { tenantId: t.tenantId, customerId: t.customerId, ticketId: t.id, type: 'SALE', product, amount: total, method: 'OPEN_ACCOUNT', notes: 'Servis fişi', createdByName: who, date: saleDate },
      });
    }

    // TAHSİLAT — ödenen tutar + gerçek ödeme tarihi (en son ödeme); yoksa PAID ise teslim tarihi
    const paidSum = t.payments.reduce((s, p) => s + Number(p.amount), 0);
    const paid = paidSum > 0 ? paidSum : (t.paymentStatus === 'PAID' ? total : 0);
    const lastPayDate = t.payments.length
      ? t.payments.reduce((m, p) => (p.paymentDate > m ? p.paymentDate : m), t.payments[0].paymentDate)
      : saleDate;
    const payMethod = t.payments.length ? String(t.payments[t.payments.length - 1].method) : 'CASH';
    if (paid > 0) {
      if (pay) {
        if (Number(pay.amount) !== paid || +new Date(pay.date) !== +lastPayDate) {
          await tx.accountEntry.update({ where: { id: pay.id }, data: { amount: paid, method: payMethod, createdByName: who, date: lastPayDate } });
        }
      } else {
        await tx.accountEntry.create({
          data: { tenantId: t.tenantId, customerId: t.customerId, ticketId: t.id, type: 'PAYMENT', product: null, amount: paid, method: payMethod, notes: 'Servis tahsilatı', createdByName: who, date: lastPayDate },
        });
      }
    } else if (pay) {
      await tx.accountEntry.delete({ where: { id: pay.id } });
    }

    return { synced: true, amount: total };
  });
}
