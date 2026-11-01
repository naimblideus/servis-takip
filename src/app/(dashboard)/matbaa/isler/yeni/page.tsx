import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { fiyatliMi, urunTanimi } from '@/lib/baski-fiyat';
import TezgahFormu, { type TezgahUrunu } from '@/components/matbaa/TezgahFormu';

export const dynamic = 'force-dynamic';

/**
 * YENİ İŞ — tezgah. Hedef ~15 saniye: telefon → ürün → adet → fiyat →
 * ödeme → kaydet. Yalnız FİYATLI ürünler listelenir; fiyat ekranda saf
 * motorla (lib/baski-fiyat) anında, kayıtta sunucuda yeniden hesaplanır.
 */
export default async function YeniIs() {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  if (user.role === 'TECHNICIAN') redirect('/matbaa/isler');

  const satirlar = await prisma.baskiUrunu.findMany({ where: { tenantId: user.tenantId, aktif: true }, orderBy: [{ sira: 'asc' }, { ad: 'asc' }] });
  const urunler: TezgahUrunu[] = [];
  let fiyatsiz = 0;
  for (const s of satirlar) {
    const tanim = urunTanimi(s);
    if (fiyatliMi(tanim)) urunler.push({ id: s.id, teslimSaat: s.teslimSaat, tanim });
    else fiyatsiz++;
  }
  return <TezgahFormu urunler={urunler} fiyatsizVar={fiyatsiz > 0} yonetici={user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'} />;
}
