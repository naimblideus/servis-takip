// MATBAA AYARI — veritabanı tarafı. Kurallar saf dosyada (lib/matbaa-ayar).
import type { MatbaaAyar } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hesapTuru } from '@/lib/menu-aileleri';
import { hazirlamaSaati, kisaAdGecerli, kisaAdTemizle, saklamaGunu, siparisYolu, takipYolu, tamAdres } from '@/lib/matbaa-ayar';

/** Sitenin dış adresi (mesaj ve QR bağlantıları). */
export function siteKoku(): string {
  return (process.env.NEXTAUTH_URL || 'https://nextusservis.com').replace(/\/+$/, '');
}

const cakisma = (e: unknown) => (e as { code?: string } | null)?.code === 'P2002';

/**
 * Matbaanın ayar satırı; yoksa açar. Kısa ad işletmenin adresinden (slug)
 * ya da adından türetilir; doluysa sonuna sayı eklenir. Takip bağlantısı
 * kısa ada bağlı olduğu için ayar ekranına hiç girmemiş matbaada da çalışır.
 */
export async function ayarHazirla(tenantId: string): Promise<MatbaaAyar> {
  const mevcut = await prisma.matbaaAyar.findUnique({ where: { tenantId } });
  if (mevcut?.kisaAd) return mevcut;
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, name: true } });
  const taban = [kisaAdTemizle(t?.slug), kisaAdTemizle(t?.name)].find(kisaAdGecerli) ?? 'matbaa';
  for (let i = 0; i < 8; i++) {
    const kisaAd = i === 0 ? taban : `${taban.slice(0, 34)}-${i < 5 ? i + 1 : Math.random().toString(36).slice(2, 7)}`;
    if (!kisaAdGecerli(kisaAd)) continue;
    try {
      return await prisma.matbaaAyar.upsert({ where: { tenantId }, create: { tenantId, kisaAd }, update: { kisaAd } });
    } catch (e) {
      if (!cakisma(e)) throw e;
    }
  }
  // Kısa ad bulunamadı: ayar yine açılır, bağlantılar kısa ad girilene kadar yazılmaz.
  return prisma.matbaaAyar.upsert({ where: { tenantId }, create: { tenantId }, update: {} });
}

/** Müşteriye gidecek takip bağlantısı; kısa ad yoksa null. */
export function takipAdresi(ayar: Pick<MatbaaAyar, 'kisaAd'> | null, jeton: string): string | null {
  return tamAdres(siteKoku(), ayar?.kisaAd ? takipYolu(ayar.kisaAd, jeton) : null);
}
export function siparisAdresi(ayar: Pick<MatbaaAyar, 'kisaAd'> | null): string | null {
  return tamAdres(siteKoku(), ayar?.kisaAd ? siparisYolu(ayar.kisaAd) : null);
}

export type AyarHatasi = 'KISA_AD_GECERSIZ' | 'KISA_AD_DOLU';

const metin = (x: unknown, azami: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, azami) : null);

/** Ayar ekranından gelen değerleri yazar. Yalnız gönderilen alanlar değişir. */
export async function ayarKaydet(tenantId: string, g: Record<string, unknown>): Promise<{ ok: true; ayar: MatbaaAyar } | { ok: false; kod: AyarHatasi }> {
  await ayarHazirla(tenantId);
  const data: Record<string, unknown> = {};
  if (g.kisaAd !== undefined) {
    const k = String(g.kisaAd ?? '').trim().toLowerCase();
    if (!kisaAdGecerli(k)) return { ok: false, kod: 'KISA_AD_GECERSIZ' };
    data.kisaAd = k;
  }
  if (g.siparisAcik !== undefined) data.siparisAcik = g.siparisAcik === true;
  if (g.havaleKabul !== undefined) data.havaleKabul = g.havaleKabul === true;
  if (g.calismaSaatleri !== undefined) data.calismaSaatleri = metin(g.calismaSaatleri, 200);
  if (g.karsilamaMetni !== undefined) data.karsilamaMetni = metin(g.karsilamaMetni, 1000);
  if (g.hazirlamaSaat !== undefined) data.hazirlamaSaat = hazirlamaSaati(g.hazirlamaSaat);
  if (g.saklamaGun !== undefined) data.saklamaGun = saklamaGunu(g.saklamaGun);
  if (g.karsilamaKopyalandi === true) data.karsilamaKopyalandiAt = new Date();
  try {
    return { ok: true, ayar: await prisma.matbaaAyar.update({ where: { tenantId }, data }) };
  } catch (e) {
    if (cakisma(e)) return { ok: false, kod: 'KISA_AD_DOLU' };
    throw e;
  }
}

/**
 * Herkese açık sayfalar için: kısa addan matbaa. İşletme kapalıysa, askıdaysa
 * ya da baskı merkezi değilse BULUNAMAZ sayılır (portal kuralı: abonelik
 * bitince müşteri tarafı da kapanır).
 */
export async function kisaAddanMatbaa(kisaAd: string) {
  if (!kisaAdGecerli(kisaAd)) return null;
  const ayar = await prisma.matbaaAyar.findUnique({
    where: { kisaAd },
    include: {
      tenant: {
        select: {
          id: true, name: true, logo: true, phone: true, address: true, locale: true, currency: true, workTimezone: true,
          odemeIban: true, odemeHesapAdi: true, hesapTuru: true, isActive: true, isSuspended: true, deletedAt: true,
        },
      },
    },
  });
  if (!ayar) return null;
  const { tenant, ...gerisi } = ayar;
  if (!tenant.isActive || tenant.isSuspended || tenant.deletedAt || hesapTuru(tenant.hesapTuru) !== 'MATBAA') return null;
  return { ayar: gerisi, tenant };
}
