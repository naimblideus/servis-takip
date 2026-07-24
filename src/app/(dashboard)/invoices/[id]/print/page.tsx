import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PrintNowButton from '@/components/PrintNowButton';
import InvoiceDocument, { type InvoiceDocData } from '@/components/docs/InvoiceDocument';
import { buildCounterAppendix } from '@/lib/invoice-appendix';

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect('/login');

  const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
  if (!user) redirect('/login');

  const invoice = await prisma.customerInvoice.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null },
    include: { customer: true, tenant: true, lines: { orderBy: { id: 'asc' } } },
  });
  if (!invoice) redirect('/invoices');

  // Sayaç eki (2. sayfa) — sayaç satırı yoksa null döner, sayfa basılmaz
  const counterAppendix = await buildCounterAppendix(user.tenantId, invoice as any);

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
    counterAppendix,
  };

  return (
    <>
      <PrintNowButton />
      <InvoiceDocument invoice={doc} />
    </>
  );
}
