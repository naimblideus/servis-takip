// BASKI ÜRÜNLERİ — veritabanı tarafı. Hesap motoru saf (lib/baski-fiyat).
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { sablonSatirlari } from '@/lib/baski-sablon';
import { urunTanimi } from '@/lib/baski-fiyat';

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

const KATEGORILER = ['FOTOKOPI', 'PLAN', 'BUYUK_BASKI', 'CILT', 'DIGER'];

/**
 * Formdan gelen ürünü yazılabilir alanlara çevirir. Fiyat yapısı
 * baski-fiyat normalleştiricisinden geçer: ekranın gönderdiği bozuk kademe
 * ya da seçenek veritabanına girmez. Ad boşsa null.
 */
export function urunVerisi(ham: Record<string, unknown>) {
  const u = urunTanimi(ham);
  if (!u.ad) return null;
  const saat = Math.floor(Number(ham.teslimSaat));
  return {
    ad: u.ad,
    kategori: KATEGORILER.includes(String(ham.kategori)) ? String(ham.kategori) : 'DIGER',
    fiyatModeli: u.fiyatModeli,
    kademeler: u.kademeler as unknown as Prisma.InputJsonValue,
    secenekler: u.secenekler as unknown as Prisma.InputJsonValue,
    minTutar: u.minTutar,
    kdvOrani: u.kdvOrani,
    kdvDahil: u.kdvDahil,
    yuvarlama: u.yuvarlama,
    teslimSaat: saat > 0 && saat < 10_000 ? saat : null,
    dosyaGerekli: ham.dosyaGerekli !== false,
    online: ham.online !== false,
    aktif: ham.aktif !== false,
  };
}
