import { notFound } from 'next/navigation';
import { verifyDocToken } from '@/lib/doc-token';
import PrintNowButton from '@/components/PrintNowButton';
import EmanetTutanagi from '@/components/docs/EmanetTutanagi';
import { tutanakVerisi } from '@/lib/emanet-veri';
import { sozluk, dilMi, VARSAYILAN_DIL } from '@/lib/i18n/sozluk';

export const dynamic = 'force-dynamic';

// Girişsiz paylaşılabilir teslim tutanağı — imza doğruysa açılır (makbuz gibi).
// Müşteri WhatsApp'tan açar: belge ve düğme bayinin dilinde.
export default async function HerkeseAcikTutanak({ params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;
  if (!verifyDocToken('emanet', id, token)) notFound();
  const v = await tutanakVerisi(id);
  if (!v) notFound();
  return (
    <>
      <PrintNowButton etiket={sozluk(dilMi(v.bayi.dil) ? v.bayi.dil : VARSAYILAN_DIL).genel.yazdir} />
      <EmanetTutanagi v={v} />
    </>
  );
}
