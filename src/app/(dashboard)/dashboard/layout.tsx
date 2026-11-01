import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { kiraciTuru } from '@/lib/matbaa-kapi';

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
  // BASKI MERKEZİNİN ANA SAYFASI "BUGÜN"DÜR. Bayi panelindeki ciro, sayaç,
  // kiralık filo matbaada anlamsız. Girişten sonra herkes buraya düşüyor.
  // Operatör (TECHNICIAN) doğrudan işler panosuna: Bugün'de tutar var.
  if ((await kiraciTuru((session?.user as { tenantId?: string } | undefined)?.tenantId)) === 'MATBAA') {
    redirect((session?.user as { role?: string } | undefined)?.role === 'TECHNICIAN' ? '/matbaa/isler' : '/matbaa');
  }
  if ((session?.user as { role?: string } | undefined)?.role === 'TECHNICIAN') redirect('/tickets');
  return children;
}
