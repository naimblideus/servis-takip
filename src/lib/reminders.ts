// Toplu hatırlatma alıcıları — SMS ve WhatsApp route'larının ORTAK kaynağı (tek doğruluk noktası).
// Müşteriler TENANT-scoped çekilir, bakiye (borç) AccountEntry SALE-PAYMENT'tan hesaplanır.
import { prisma } from '@/lib/prisma';

export interface Recipient { id: string; name: string; phone: string; balance: number; }

export async function resolveRecipients(tenantId: string, customerIds: string[]): Promise<Recipient[]> {
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds }, tenantId }, // tenant guard
    select: { id: true, name: true, phone: true },
  });
  if (!customers.length) return [];

  const grouped = await prisma.accountEntry.groupBy({
    by: ['customerId', 'type'],
    where: { tenantId, customerId: { in: customers.map(c => c.id) } },
    _sum: { amount: true },
  });
  const bal = new Map<string, number>();
  for (const g of grouped) {
    if (!g.customerId) continue;
    const amt = Number(g._sum.amount || 0);
    bal.set(g.customerId, (bal.get(g.customerId) || 0) + (g.type === 'SALE' ? amt : -amt));
  }

  return customers.map(c => ({ id: c.id, name: c.name || '', phone: c.phone || '', balance: bal.get(c.id) || 0 }));
}

export const fmtTLm = (n: number) =>
  Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
