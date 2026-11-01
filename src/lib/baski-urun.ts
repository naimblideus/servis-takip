// BASKI ÜRÜNLERİ — veritabanı tarafı. Hesap motoru saf (lib/baski-fiyat).
import { prisma } from '@/lib/prisma';
import { sablonSatirlari } from '@/lib/baski-sablon';

/**
 * Eksik hazır ürünleri ekler; olanlara dokunmaz (sablonKodu tekil).
 * Hesap açılışında createTenant zaten yazar (Türkçe adlarla); bu, sonradan matbaaya çevrilen
 * işletme ve yeni eklenen şablonlar için. Kaç ürün eklendiğini döner.
 */
export async function sablonlariKur(tenantId: string): Promise<number> {
  const [tenant, mevcut] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { locale: true } }),
    prisma.baskiUrunu.findMany({ where: { tenantId, sablonKodu: { not: null } }, select: { sablonKodu: true } }),
  ]);
  const satirlar = sablonSatirlari(tenant?.locale, mevcut.map((m) => m.sablonKodu));
  if (!satirlar.length) return 0;
  const r = await prisma.baskiUrunu.createMany({
    data: satirlar.map((s) => ({ ...s, tenantId, kademeler: s.kademeler as object[], secenekler: s.secenekler as object[] })),
    skipDuplicates: true,
  });
  return r.count;
}
