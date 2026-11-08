/**
 * MÜŞTERİ EKLEME — tek kural, üç kapı
 *
 * Müşteri üç yerden açılıyor: Yeni Müşteri formu, fiş ekranındaki "＋ Yeni
 * müşteri" ve telefon rehberinden toplu seçim. Üçü de aynı kuralı izler:
 *   · telefon Excel aktarımıyla AYNI biçimde saklanır (lib/sheet-import
 *     normalizePhone: yalnız rakam, baştaki 0 / 90 atılır). Müşteri bayi
 *     içinde telefonla tekil; biçim farkı "0532 111 22 33" ile "5321112233"yi
 *     iki ayrı müşteri yapıyordu;
 *   · numara zaten kayıtlıysa yeni kayıt açılmaz, mevcut müşteri döner
 *     (fiş ekranı onu seçer; rehberde "zaten var" diye atlanır).
 */
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/sheet-import';

export const TOPLU_AZAMI = 500;

export interface MusteriOzeti { id: string; name: string; phone: string; address: string | null }
const OZET = { id: true, name: true, phone: true, address: true } as const;

/** Saklanacak telefon; geçersizse boş dize. */
export function musteriTelefonu(ham: unknown): string {
  const t = normalizePhone(typeof ham === 'string' ? ham.trim() : String(ham ?? ''));
  return t.length >= 7 && t.length <= 15 ? t : '';
}

export type MusteriEkleSonucu =
  | { durum: 'YENI'; musteri: MusteriOzeti }
  | { durum: 'VAR'; musteri: MusteriOzeti }
  | { durum: 'HATA'; kod: 'MUSTERI_ADI_GEREKLI' | 'GECERSIZ_TELEFON_NUMARASI' };

export async function musteriEkle(tenantId: string, g: {
  ad: unknown; telefon: unknown; adres?: unknown; vergiNo?: unknown; eposta?: unknown; onay?: unknown;
}): Promise<MusteriEkleSonucu> {
  const ad = typeof g.ad === 'string' ? g.ad.trim().slice(0, 160) : '';
  if (!ad) return { durum: 'HATA', kod: 'MUSTERI_ADI_GEREKLI' };
  const ham = typeof g.telefon === 'string' ? g.telefon.trim() : '';
  const telefon = musteriTelefonu(ham);
  if (!telefon) return { durum: 'HATA', kod: 'GECERSIZ_TELEFON_NUMARASI' };
  // Eski elle girişler ham biçimde saklı olabilir: ikisine de bakılır.
  const mevcut = await prisma.customer.findFirst({
    where: { tenantId, phone: { in: [...new Set([telefon, ham])] } },
    select: OZET,
  });
  if (mevcut) return { durum: 'VAR', musteri: mevcut };
  const metin = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const eposta = metin(g.eposta);
  try {
    const musteri = await prisma.customer.create({
      data: {
        tenantId, name: ad, phone: telefon,
        address: metin(g.adres),
        taxNo: metin(g.vergiNo),
        // Küçük harfle: eşleştirme ve tekrar kontrolü harf duyarsız olsun.
        email: eposta ? eposta.toLowerCase() : null,
        consent: g.onay === true,
      },
      // Kaydın tamamı döner: çağıran ekranlar (muhasebe hızlı ekleme) eskiden
      // olduğu gibi bütün alanları alır.
    });
    return { durum: 'YENI', musteri };
  } catch (e: any) {
    // Aynı anda iki kişi aynı numarayı eklediyse tekillik kuralı yakalar.
    if (e?.code === 'P2002') {
      const m = await prisma.customer.findFirst({ where: { tenantId, phone: telefon }, select: OZET });
      if (m) return { durum: 'VAR', musteri: m };
    }
    throw e;
  }
}

export interface TopluSonuc { eklenen: number; zatenVar: number; gecersiz: number }

/**
 * Rehberden seçilen kişileri ekler. Kayıtlı numara atlanır, aynı numara
 * listede iki kez geçerse bir kez eklenir. En çok TOPLU_AZAMI kişi.
 */
export async function musterileriEkle(tenantId: string, kisiler: { ad: unknown; telefon: unknown }[]): Promise<TopluSonuc> {
  let gecersiz = 0;
  const temiz = new Map<string, string>(); // telefon → ad
  for (const k of kisiler.slice(0, TOPLU_AZAMI)) {
    const ad = typeof k.ad === 'string' ? k.ad.trim().slice(0, 160) : '';
    const tel = musteriTelefonu(k.telefon);
    if (!ad || !tel) { gecersiz++; continue; }
    if (!temiz.has(tel)) temiz.set(tel, ad);
  }
  if (!temiz.size) return { eklenen: 0, zatenVar: 0, gecersiz };
  const kayitli = await prisma.customer.findMany({
    where: { tenantId, phone: { in: [...temiz.keys()] } },
    select: { phone: true },
  });
  const var_ = new Set(kayitli.map((k) => k.phone));
  const yeni = [...temiz].filter(([tel]) => !var_.has(tel));
  const r = yeni.length
    ? await prisma.customer.createMany({
        data: yeni.map(([phone, name]) => ({ tenantId, name, phone })),
        skipDuplicates: true,
      })
    : { count: 0 };
  return { eklenen: r.count, zatenVar: temiz.size - r.count, gecersiz };
}
