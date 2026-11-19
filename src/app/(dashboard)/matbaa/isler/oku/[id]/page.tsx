import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { fiyatliUrunler, taslakGetir } from '@/lib/baski-okuyucu-kayit';
import TezgahFormu from '@/components/matbaa/TezgahFormu';

export const dynamic = 'force-dynamic';

/**
 * OKUNAN TASLAK — sonradan açılan taslak. Asıl dosya saklanmadığı için
 * yalnız okunan alanlar var; çalışan gerekirse WhatsApp'a bakar.
 * Onaylanmışsa işe, atılmışsa okuyucuya yönlendirir.
 */
export default async function OkunanTaslak({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  if (user.role === 'TECHNICIAN') redirect('/matbaa/isler');
  const { dil } = await sunucuBicimi(user);
  const m = matbaaMetni(dil);
  const { id } = await params;

  const { urunler, fiyatsiz } = await fiyatliUrunler(user.tenantId);
  const t = await taslakGetir(user.tenantId, id, urunler);
  if (!t) notFound();
  if (t.durum === 'ONAYLANDI' && t.isId) redirect(`/matbaa/isler/${t.isId}`);
  if (t.durum !== 'TASLAK' && t.durum !== 'ONAYLANIYOR') redirect('/matbaa/isler/oku');

  return (
    <div>
      <div className="mx-auto max-w-2xl px-4 pt-4 md:px-8">
        <Link href="/matbaa/isler/oku" className="text-sm font-semibold text-[#0f2253]">← {m.okuyucu.baslik}</Link>
        <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{m.okuyucu.dosyaSaklanmadi}</p>
      </div>
      <TezgahFormu urunler={urunler} fiyatsizVar={fiyatsiz > 0} yonetici={user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'}
        taslak={{ okumaId: t.id, ...t.taslak }} />
    </div>
  );
}
