import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { yonetici } from '@/lib/menu-aileleri';

/**
 * GELECEK GELİR YALNIZ YÖNETİCİYE: bayinin bütün kira ve sözleşme gelirini
 * tutarıyla gösteriyor. Uç zaten yönetici istiyor; burada sunucuda yönlendirmek
 * ekranın bir an boş açılıp 403 yazmasını önler.
 */
export default async function GelecekGelirLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!yonetici((session?.user as { role?: string } | undefined)?.role ?? '')) redirect('/dashboard');
  return children;
}
