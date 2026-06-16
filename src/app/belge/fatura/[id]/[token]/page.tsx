import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { verifyDocToken } from '@/lib/doc-token';
import PrintNowButton from '@/components/PrintNowButton';
import InvoiceDocument, { type InvoiceDocData } from '@/components/docs/InvoiceDocument';

export const dynamic = 'force-dynamic';

// Girişsiz paylaşılabilir fatura belgesi — token doğruysa açılır (müşteriye WhatsApp ile gönderilir).
export default async function PublicInvoicePage({ params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;
  if (!verifyDocToken('fatura', id, token)) notFound();

  const invoice = await prisma.customerInvoice.findFirst({
    where: { id, deletedAt: null },
    include: { customer: true, tenant: true, lines: { orderBy: { id: 'asc' } } },
  });
  if (!invoice) notFound();

  const doc: InvoiceDocData = {
    invoiceNumber: invoice.invoiceNumber,
    period: invoice.period,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    subtotal: Number(invoice.subtotal),
    vatRate: Number(invoice.vatRate),
    vatAmount: Number(invoice.vatAmount),
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
    tenant: {
      name: invoice.tenant.name, logo: invoice.tenant.logo, phone: invoice.tenant.phone,
      address: invoice.tenant.address, taxOffice: invoice.tenant.taxOffice, taxNumber: invoice.tenant.taxNumber,
    },
    customer: {
      name: invoice.customer.name, phone: invoice.customer.phone, taxNo: invoice.customer.taxNo,
      contactPerson: invoice.customer.contactPerson, address: invoice.customer.address,
    },
    lines: invoice.lines.map((l) => ({
      id: l.id, kind: l.kind, description: l.description,
      quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), lineTotal: Number(l.lineTotal),
    })),
  };

  return (
    <>
      <PrintNowButton />
      <InvoiceDocument invoice={doc} />
    </>
  );
}
