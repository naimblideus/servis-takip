import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { verifyDocToken } from '@/lib/doc-token';
import PrintNowButton from '@/components/PrintNowButton';
import ReceiptDocument, { type ReceiptDocData } from '@/components/docs/ReceiptDocument';

export const dynamic = 'force-dynamic';

// Girişsiz paylaşılabilir tahsilat makbuzu — token doğruysa açılır.
export default async function PublicReceiptPage({ params }: { params: Promise<{ paymentId: string; token: string }> }) {
  const { paymentId, token } = await params;
  if (!verifyDocToken('makbuz', paymentId, token)) notFound();

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId },
    include: {
      customer: true,
      tenant: true,
      allocations: { include: { invoice: { select: { invoiceNumber: true, status: true, totalAmount: true, paidAmount: true } } } },
    },
  });
  if (!payment) notFound();

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
