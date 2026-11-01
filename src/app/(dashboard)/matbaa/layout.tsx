import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { kiraciTuru } from '@/lib/matbaa-kapi';

/**
 * BASKI MERKEZİ EKRANLARININ SUNUCU KAPISI.
 *
 * Menü ve ModuleGuard bayide bu ekranları gizliyor; burası doğrudan adresi
 * sunucuda keser. Bayi /matbaa yazarsa kendi paneline döner, ekran bir an
 * bile çizilmez.
 */
export default async function MatbaaLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if ((await kiraciTuru((session?.user as { tenantId?: string } | undefined)?.tenantId)) !== 'MATBAA') redirect('/dashboard');
  return children;
}
