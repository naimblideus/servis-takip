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

  // SELECT, DevicesClient'ın Device tipiyle BİREBİR aynı: listede çizilen ve
  // aranan alanlar. Eskiden `include: { customer: true }` müşterinin BÜTÜN
  // alanlarını (adres, vergi no, portal jetonu, tarihler…) ve cihazın tüm
  // sütunlarını taşıyordu; listede yalnız 9 tanesi kullanılıyor.
  // Ölçüldü — 550 cihazlık gerçek bayide: sayfa 534 KB, sunucu 2.020 ms.
  //
  // Arama İSTEMCİDE kalıyor (bilerek): bayi seri no ararken her tuşta sunucuya
  // gitmek anlık aramayı kaybettirir. Yük düşünce ikisi birden mümkün.
  const devices = await prisma.device.findMany({
    where: { tenantId: user!.tenantId },
    select: {
      id: true, brand: true, model: true, serialNo: true,
      location: true, isRental: true, monthlyRent: true,
      customer: { select: { name: true } },
      // `take: 1` cihazın SON fişini alıyor. Filtre yokken silinmiş bir fiş en
      // yeniyse cihazın "son servisi" olarak ÇÖPTEKİ fiş görünüyordu.
      serviceTickets: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeTab = tab || 'all';

  return <DevicesClient devices={devices as any} activeTab={activeTab} />;
}
