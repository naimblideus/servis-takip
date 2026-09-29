import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/**
 * TEKNİSYENİN ANA SAYFASI İŞLERİDİR.
 *
 * Ana panel bayinin cirosunu, tahsilatını ve borçlularını gösteriyor.
 * Sahadaki teknisyenin işi bunlar değil ve bayi çoğu zaman görmesini
 * istemiyor. Girişten sonra herkes /dashboard'a düşüyor; teknisyen buradan
 * kendi iş listesine gider.
 *
 * Yönlendirme SUNUCUDA: istemcide yapılsaydı panel bir an görünüp
 * kaybolurdu — o an ciroyu göstermeye yeter.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role === 'TECHNICIAN') redirect('/tickets');
  return children;
}
