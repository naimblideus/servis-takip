/**
 * SUNUCU BİLEŞENİ için dil demeti: sözlük + biçimlendiriciler.
 *
 * İstemci tarafında `useT()` + `useBicim()` ne yapıyorsa bunun sunucu
 * karşılığı. Tek çağrıda hepsi geliyor, çünkü her sunucu sayfasında aynı üç
 * satırı (çerez oku → bayinin para birimini çek → biçimlendirici kur)
 * tekrarlamak, er geç birinde unutulur ve o ekran Türkçe/₺ kalırdı.
 *
 * Bayinin para birimi ve ülkesi BAYİYE aittir (faturayı o kesiyor); dil ise
 * KİŞİYE — aynı firmada Türkçe ve İngilizce çalışan olabilir.
 */
import { prisma } from '@/lib/prisma';
import { sunucuDili } from './sunucu';
import { sozluk, type Sozluk, type Dil } from './sozluk';
import { bicimYap, type Bicimleyici } from '@/lib/bicim';

export interface SunucuBicim {
  dil: Dil;
  sz: Sozluk;
  b: Bicimleyici;
  /** ISO 3166-1 alpha-2 — TR'ye özgü modüller buna göre kapılanır. */
  ulke: string;
}

export async function sunucuBicimi(
  kullanici: { tenantId: string; locale?: string | null } | null | undefined,
): Promise<SunucuBicim> {
  const bayi = kullanici
    ? await prisma.tenant.findUnique({
      where: { id: kullanici.tenantId },
      select: { locale: true, currency: true, country: true },
    })
    : null;
  const dil = await sunucuDili(kullanici?.locale, bayi?.locale);
  return { dil, sz: sozluk(dil), b: bicimYap(dil, bayi?.currency), ulke: bayi?.country ?? 'TR' };
}
