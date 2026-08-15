import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PrintNowButton from '@/components/PrintNowButton';
import ReceiptDocument, { type ReceiptDocData } from '@/components/docs/ReceiptDocument';
import { oturumKullanicisi } from '@/lib/api-auth';

export default async function ReceiptPrintPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const session = await auth();
  if (!session) redirect('/login');

  const user = await oturumKullanicisi(session);
  if (!user) redirect('/login');

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId: user.tenantId },
    include: {
      customer: true,
      tenant: true,
      allocations: { include: { invoice: { select: { invoiceNumber: true, status: true, totalAmount: true, paidAmount: true } } } },
    },
  });
  if (!payment) redirect('/collections');

  const receipt: ReceiptDocData = {
    receiptNo: `SF-MKB-${payment.id.slice(-6).toUpperCase()}`,
    amount: Number(payment.amount),
    paymentDate: payment.paymentDate,
    method: payment.method,
    referenceNo: payment.referenceNo,
    tenant: { name: payment.tenant.name, logo: payment.tenant.logo, phone: payment.tenant.phone },
    customer: payment.customer ? { name: payment.customer.name, phone: payment.customer.phone } : null,
    allocations: payment.allocations.map((a) => ({
      invoiceNumber: a.invoice.invoiceNumber, status: a.invoice.status, amount: Number(a.amount),
    })),
  };

  return (
    <>
      <PrintNowButton />
      <ReceiptDocument receipt={receipt} />
    </>
  );
}
