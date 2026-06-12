// Sıfır-dokunuş muhasebe çekirdeği
// Tek kaynak fatura üretici + FIFO tahsilat mahsubu.
// Kullanıcı hiç hesap/onay yapmaz; bu modül olay-tetikli + cron ile çalışır.
import { prisma } from '@/lib/prisma';
import {
  Prisma,
  PaymentMethod,
  InvoiceLineKind,
  InvoiceSource,
} from '@prisma/client';

type Tx = Prisma.TransactionClient;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Bugünün dönemi: "YYYY-MM" */
export function periodOf(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** "YYYY-MM" dönemini [start, end) tarih aralığına çevir */
function periodRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split('-').map(Number);
  return {
    start: new Date(y, m - 1, 1, 0, 0, 0, 0),
    end: new Date(y, m, 1, 0, 0, 0, 0), // bir sonraki ayın 1'i (hariç)
  };
}

interface LineInput {
  tenantId: string;
  kind: InvoiceLineKind;
  description: string;
  deviceId?: string | null;
  readingId?: string | null;
  ticketId?: string | null;
  partId?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** Per-tenant atomik fatura numarası: SF-FAT-2026-00001 */
async function nextInvoiceNumber(tx: Tx, tenantId: string): Promise<string> {
  const t = await tx.tenant.update({
    where: { id: tenantId },
    data: { nextInvoiceSeq: { increment: 1 } },
    select: { nextInvoiceSeq: true },
  });
  const year = new Date().getFullYear();
  return `SF-FAT-${year}-${String(t.nextInvoiceSeq).padStart(5, '0')}`;
}

/**
 * Faturayı + satırları + LOGO kuyruğunu oluşturur.
 * NAKİT-ESASLI: Gelir burada YAZILMAZ; tahsilat anında (allocatePayment) yazılır.
 * Fatura yalnızca cari borç/alacak belgesidir. Faturalanacak satır yoksa null döner.
 */
async function postInvoice(
  tx: Tx,
  params: {
    tenantId: string;
    customerId: string;
    period: string;
    source: InvoiceSource;
    lines: LineInput[];
  }
) {
  const { tenantId, customerId, period, source, lines } = params;
  if (lines.length === 0) return null;

  const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant bulunamadı');

  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const vatRate = Number(tenant.vatRate);
  const vatAmount = round2((subtotal * vatRate) / 100);
  const totalAmount = round2(subtotal + vatAmount);

  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate.getTime() + tenant.paymentTermDays * 86400000);
  const invoiceNumber = await nextInvoiceNumber(tx, tenantId);

  const invoice = await tx.customerInvoice.create({
    data: {
      tenantId,
      customerId,
      invoiceNumber,
      period,
      invoiceDate,
      dueDate,
      status: 'OPEN',
      subtotal,
      vatRate,
      vatAmount,
      totalAmount,
      paidAmount: 0,
      source,
    },
  });

  await tx.invoiceLine.createMany({
    data: lines.map((l) => ({
      tenantId,
      invoiceId: invoice.id,
      kind: l.kind,
      description: l.description,
      deviceId: l.deviceId ?? null,
      readingId: l.readingId ?? null,
      ticketId: l.ticketId ?? null,
      partId: l.partId ?? null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
  });

  // Gelir burada YAZILMAZ (nakit-esaslı). Gelir tahsilat anında allocatePayment'ta yazılır.

  // LOGO/e-Fatura senkron kuyruğu
  await tx.logoSyncLog.create({
    data: {
      tenantId,
      operation: 'customer_invoice_create',
      entityType: 'invoice',
      entityId: invoice.id,
      direction: 'export',
      status: 'pending',
    },
  });

  return invoice;
}

/**
 * Bir müşterinin verilen dönemi için TEK fatura oluşturur (idempotent):
 *  - Faturalanmamış sayaç okumaları (mono/renkli delta × birim fiyat)
 *  - Sabit aylık kira (dönem başına 1 kez)
 *  - Teslim edilmiş, faturalanmamış iş emirleri (parça + işçilik)
 * Faturalanacak bir şey yoksa null döner.
 */
export async function buildInvoiceForCustomerPeriod(
  tenantId: string,
  customerId: string,
  period: string = periodOf(),
  source: InvoiceSource = 'AUTO_MONTHLY'
) {
  const { start, end } = periodRange(period);

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant bulunamadı');

    const lines: LineInput[] = [];
    const readingIdsToBill: string[] = [];
    const deviceRentToMark: string[] = [];

    const devices = await tx.device.findMany({ where: { tenantId, customerId } });

    for (const device of devices) {
      const blackPrice =
        device.pricePerBlack !== null ? Number(device.pricePerBlack) : Number(tenant.pricePerBlack);
      const colorPrice =
        device.pricePerColor !== null ? Number(device.pricePerColor) : Number(tenant.pricePerColor);

      // a) Faturalanmamış sayaç okumaları (bu dönem)
      const readings = await tx.counterReading.findMany({
        where: { tenantId, deviceId: device.id, billed: false, readingDate: { gte: start, lt: end } },
      });
      let sumBlack = 0;
      let sumColor = 0;
      for (const r of readings) {
        sumBlack += r.deltaBlack;
        sumColor += r.deltaColor;
        readingIdsToBill.push(r.id);
      }
      if (device.isRental) {
        if (sumBlack > 0)
          lines.push({
            tenantId,
            kind: 'COUNTER',
            description: `Sayaç (S/B) — ${device.brand} ${device.model}`,
            deviceId: device.id,
            quantity: sumBlack,
            unitPrice: blackPrice,
            lineTotal: round2(sumBlack * blackPrice),
          });
        if (sumColor > 0)
          lines.push({
            tenantId,
            kind: 'COUNTER',
            description: `Sayaç (Renkli) — ${device.brand} ${device.model}`,
            deviceId: device.id,
            quantity: sumColor,
            unitPrice: colorPrice,
            lineTotal: round2(sumColor * colorPrice),
          });
      }

      // b) Sabit kira — dönem başına 1 kez (çift kira engeli)
      if (device.isRental && Number(device.monthlyRent) > 0 && device.lastInvoicedPeriod !== period) {
        lines.push({
          tenantId,
          kind: 'RENTAL',
          description: `Aylık kira — ${device.brand} ${device.model}`,
          deviceId: device.id,
          quantity: 1,
          unitPrice: Number(device.monthlyRent),
          lineTotal: round2(Number(device.monthlyRent)),
        });
        deviceRentToMark.push(device.id);
      }
    }

    // c) Teslim edilmiş, faturalanmamış ve HENÜZ ÖDENMEMİŞ iş emirleri (parça + işçilik).
    // Fişten doğrudan ödenmiş (PAID) servisler gelirini ödeme anında yazdığı için
    // burada tekrar faturalanmaz (mükerrer gelir önlenir).
    const tickets = await tx.serviceTicket.findMany({
      where: { tenantId, customerId, status: 'DELIVERED', invoiceId: null, deletedAt: null, paymentStatus: 'UNPAID' },
      include: { ticketParts: { include: { part: true } } },
    });
    const ticketIdsToMark: string[] = [];
    for (const t of tickets) {
      for (const tp of t.ticketParts) {
        lines.push({
          tenantId,
          kind: 'PART',
          description: `Parça: ${tp.part.name} (${t.ticketNumber})`,
          ticketId: t.id,
          partId: tp.partId,
          quantity: tp.quantity,
          unitPrice: Number(tp.unitPrice),
          lineTotal: round2(tp.quantity * Number(tp.unitPrice)),
        });
      }
      if (Number(t.laborCost) > 0) {
        lines.push({
          tenantId,
          kind: 'LABOR',
          description: `İşçilik (${t.ticketNumber})`,
          ticketId: t.id,
          quantity: 1,
          unitPrice: Number(t.laborCost),
          lineTotal: round2(Number(t.laborCost)),
        });
      }
      ticketIdsToMark.push(t.id);
    }

    const invoice = await postInvoice(tx, { tenantId, customerId, period, source, lines });
    if (!invoice) return null;

    // Idempotency işaretleri — aynı transaction
    if (readingIdsToBill.length)
      await tx.counterReading.updateMany({ where: { id: { in: readingIdsToBill } }, data: { billed: true } });
    if (deviceRentToMark.length)
      await tx.device.updateMany({ where: { id: { in: deviceRentToMark } }, data: { lastInvoicedPeriod: period } });
    if (ticketIdsToMark.length)
      await tx.serviceTicket.updateMany({
        where: { id: { in: ticketIdsToMark } },
        data: { invoiceId: invoice.id, invoicedAt: invoice.invoiceDate },
      });

    return invoice;
  });
}

/**
 * Tek iş emri için anlık fatura (DELIVERED tetiği — peşin servis).
 * Parça + işçilik kalemleriyle fatura keser, ticket'ı faturaya bağlar.
 */
export async function createInvoiceForTicket(ticketId: string) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.serviceTicket.findUnique({
      where: { id: ticketId },
      include: { ticketParts: { include: { part: true } } },
    });
    if (!t || t.invoiceId || t.deletedAt) return null; // yok / zaten faturalı

    const lines: LineInput[] = [];
    for (const tp of t.ticketParts) {
      lines.push({
        tenantId: t.tenantId,
        kind: 'PART',
        description: `Parça: ${tp.part.name} (${t.ticketNumber})`,
        ticketId: t.id,
        partId: tp.partId,
        quantity: tp.quantity,
        unitPrice: Number(tp.unitPrice),
        lineTotal: round2(tp.quantity * Number(tp.unitPrice)),
      });
    }
    if (Number(t.laborCost) > 0) {
      lines.push({
        tenantId: t.tenantId,
        kind: 'LABOR',
        description: `İşçilik (${t.ticketNumber})`,
        ticketId: t.id,
        quantity: 1,
        unitPrice: Number(t.laborCost),
        lineTotal: round2(Number(t.laborCost)),
      });
    }

    const invoice = await postInvoice(tx, {
      tenantId: t.tenantId,
      customerId: t.customerId,
      period: periodOf(),
      source: 'TICKET',
      lines,
    });
    if (!invoice) return null;

    await tx.serviceTicket.update({
      where: { id: t.id },
      data: { invoiceId: invoice.id, invoicedAt: invoice.invoiceDate },
    });
    return invoice;
  });
}

/**
 * FIFO tahsilat mahsubu (onaysız):
 * Cari bazlı bir tahsilatı en eski açık faturalardan başlayarak otomatik dağıtır.
 * Mevcut bir Payment kaydı verilebilir (paymentId), yoksa yeni oluşturulur.
 * Artan tutar (avans) unallocated olarak döner — sonraki faturaya mahsup edilebilir.
 */
export async function allocatePayment(params: {
  tenantId: string;
  customerId: string;
  amount: number;
  method?: string;
  referenceNo?: string | null;
  date?: Date;
  paymentId?: string;
  ticketId?: string | null;
}) {
  const { tenantId, customerId } = params;
  const amount = round2(params.amount);

  const pmethod = PaymentMethod[(params.method ?? '') as keyof typeof PaymentMethod] ?? PaymentMethod.TRANSFER;

  return prisma.$transaction(async (tx) => {
    let paymentId = params.paymentId;
    if (!paymentId) {
      const p = await tx.payment.create({
        data: {
          tenantId,
          customerId,
          ticketId: params.ticketId ?? null,
          amount,
          method: pmethod,
          paymentDate: params.date ?? new Date(),
          referenceNo: params.referenceNo ?? null,
        },
      });
      paymentId = p.id;
    }

    const open = await tx.customerInvoice.findMany({
      where: { tenantId, customerId, status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] }, deletedAt: null },
      orderBy: [{ dueDate: 'asc' }, { invoiceDate: 'asc' }],
    });

    let remaining = amount;
    const allocations: { invoiceId: string; invoiceNumber: string; amount: number; status: string }[] = [];

    for (const inv of open) {
      if (remaining <= 0.001) break;
      const openAmt = round2(Number(inv.totalAmount) - Number(inv.paidAmount));
      if (openAmt <= 0) continue;
      const alloc = round2(Math.min(remaining, openAmt));
      const newPaid = round2(Number(inv.paidAmount) + alloc);
      const fullyPaid = newPaid >= Number(inv.totalAmount) - 0.001;

      await tx.invoicePayment.create({ data: { tenantId, invoiceId: inv.id, paymentId, amount: alloc } });
      await tx.customerInvoice.update({
        where: { id: inv.id },
        data: {
          paidAmount: newPaid,
          status: fullyPaid ? 'PAID' : 'PARTIAL',
          paidAt: fullyPaid ? new Date() : inv.paidAt,
        },
      });
      // Nakit-esaslı gelir kaydı — mahsup edilen tutar kadar
      await tx.financialTransaction.create({
        data: {
          tenantId,
          customerId,
          invoiceId: inv.id,
          type: 'INCOME',
          category: inv.source === 'TICKET' ? 'SERVICE_FEE' : 'COUNTER_FEE',
          amount: alloc,
          method: pmethod,
          description: `Tahsilat — ${inv.invoiceNumber}`,
          date: params.date ?? new Date(),
        },
      });
      allocations.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: alloc,
        status: fullyPaid ? 'PAID' : 'PARTIAL',
      });
      remaining = round2(remaining - alloc);
    }

    if (params.method && params.method !== 'OPEN_ACCOUNT') {
      await tx.payment.update({ where: { id: paymentId }, data: { reconciled: true } });
    }

    // LOGO ödeme kuyruğu
    await tx.logoSyncLog.create({
      data: {
        tenantId,
        operation: 'payment_create',
        entityType: 'payment',
        entityId: paymentId,
        direction: 'export',
        status: 'pending',
      },
    });

    return { paymentId, allocations, allocated: round2(amount - remaining), unallocated: round2(remaining) };
  });
}

/** Vadesi geçen OPEN/PARTIAL faturaları OVERDUE'ya çevirir (cron). Etkilenen sayıyı döner. */
export async function markOverdueInvoices(tenantId?: string): Promise<number> {
  const now = new Date();
  const res = await prisma.customerInvoice.updateMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      status: { in: ['OPEN', 'PARTIAL'] },
      dueDate: { lt: now },
      deletedAt: null,
    },
    data: { status: 'OVERDUE' },
  });
  return res.count;
}
