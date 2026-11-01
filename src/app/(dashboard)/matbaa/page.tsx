import { auth } from '@/lib/auth';
import { oturumKullanicisi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';

export const dynamic = 'force-dynamic';

/**
 * BUGÜN — baskı merkezinin ana sayfası.
 *
 * Üstte tek sayı satırı, altında satır başına tek düğmeli bekleyen işler
 * (kalıp: magaza/BugunListesi). İş modeli gelince dolar; şimdilik boş hâl.
 */
export default async function MatbaaBugun() {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  const { sz } = await sunucuBicimi(user);

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">{sz.matbaa.bugunBaslik}</h1>
      <p className="mt-6 text-gray-500">{sz.matbaa.bugunBos}</p>
    </div>
  );
}
