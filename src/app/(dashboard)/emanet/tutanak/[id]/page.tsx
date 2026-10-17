import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PrintNowButton from '@/components/PrintNowButton';
import EmanetTutanagi from '@/components/docs/EmanetTutanagi';
import { oturumKullanicisi } from '@/lib/api-auth';
import { tutanakVerisi } from '@/lib/emanet-veri';

export const dynamic = 'force-dynamic';

// Oturumlu yazdırma: yalnız bu bayinin bırakışı açılır (IDOR: tenantId ile aranır).
export default async function EmanetTutanakSayfasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect('/login');
  const user = await oturumKullanicisi(session);
  if (!user) redirect('/login');
  const v = await tutanakVerisi(id, user.tenantId);
  if (!v) redirect('/emanet');
  return (
    <>
      <PrintNowButton />
      <EmanetTutanagi v={v} />
    </>
  );
}
