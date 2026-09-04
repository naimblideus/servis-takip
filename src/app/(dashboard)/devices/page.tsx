import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { bayiSuzgeci } from '@/lib/api-auth';
import DevicesClient from '@/components/DevicesClient';

export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const session = await auth();
  if (!session) redirect('/login');

  const user = await prisma.user.findFirst({
    where: { email: session.user?.email!, ...bayiSuzgeci(session) },
  });

  const devices = await prisma.device.findMany({
    where: { tenantId: user!.tenantId },
    // `take: 1` cihazın SON fişini alıyor. Filtre yokken silinmiş bir fiş en
    // yeniyse cihazın "son servisi" olarak ÇÖPTEKİ fiş görünüyordu.
    include: { customer: true, serviceTickets: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  });

  const activeTab = tab || 'all';

  return <DevicesClient devices={devices as any} activeTab={activeTab} />;
}
