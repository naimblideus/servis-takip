import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi, yoneticiMi } from '@/lib/api-auth';
import { urunTanimi } from '@/lib/baski-fiyat';
import FiyatListesi, { type ListeUrunu } from '@/components/matbaa/FiyatListesi';

export const dynamic = 'force-dynamic';

/**
 * FİYAT LİSTESİ — yalnız sahip (yönetici). Fiyatı girilmemiş ürün tezgahta
 * ve sipariş sayfasında görünmez; eksik fiyat kartın üstünde yazar.
 */
export default async function FiyatListesiSayfasi() {
  const session = await auth();
  if (!session) return null;
  const user = await oturumKullanicisi(session);
  if (!user) return null;
  if (!yoneticiMi(user)) redirect('/matbaa');
  const satirlar = await prisma.baskiUrunu.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ aktif: 'desc' }, { sira: 'asc' }, { ad: 'asc' }] });
  const urunler: ListeUrunu[] = satirlar.map((s) => ({
    id: s.id, kategori: s.kategori, online: s.online, aktif: s.aktif, teslimSaat: s.teslimSaat, tanim: urunTanimi(s),
  }));
  return <FiyatListesi urunler={urunler} />;
}
