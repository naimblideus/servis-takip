/**
 * BASKI İŞİ TAKİBİ — müşteri tarafının güvenlik sınırı (kalıp: lib/portal).
 *
 * Takip sayfasına giren kişinin KİMLİĞİ DOĞRULANMAMIŞTIR; elinde yalnız bir
 * bağlantı var. "Müşteriye ne gösterilir" kararı burada, tek yerde: sayfa ve
 * uçlar bu dosyanın döndürdüğünden fazlasını göremez.
 *
 * ── DIŞARI ÇIKMAYANLAR (bilerek) ─────────────────────────────────────────
 * · İşin notu (tezgah iç not yazabilir), iptal nedeni
 * · Personel adları, kim açtı, kim ödeme aldı
 * · Müşterinin telefonu (bağlantı başkasına iletilmiş olabilir)
 * · Dosyaların indirme adresi (müşteri kendi dosyasını zaten biliyor)
 */
import { prisma } from '@/lib/prisma';
import { dilMi, type Dil } from '@/lib/i18n/sozluk';
import { isDurumu, isNo, kalan, takipCizelgesi } from '@/lib/baski-is';
import { jetonGecerli } from '@/lib/matbaa-ayar';
import { kisaAddanMatbaa } from '@/lib/matbaa-ayar-kayit';
import { musteriYukleyebilir } from '@/lib/baski-dosya';
import { r2Ayarli } from '@/lib/r2';

export async function takipVerisi(kisaAd: string, jeton: string) {
  if (!jetonGecerli(jeton)) return null;
  const m = await kisaAddanMatbaa(kisaAd);
  if (!m) return null;
  const is = await prisma.baskiIsi.findFirst({
    where: { jeton, tenantId: m.tenant.id },
    select: {
      id: true, no: true, durum: true, createdAt: true, teslimAt: true, sozVerilenAt: true, musteriAd: true,
      toplam: true, odenen: true, tahmini: true, odemeYolu: true, customerId: true,
      kalemler: { select: { ozet: true, tutar: true }, orderBy: { sira: 'asc' } },
      olaylar: { where: { tur: 'DURUM' }, select: { durumSonra: true, createdAt: true } },
      dosyalar: { where: { durum: 'HAZIR', tur: 'BASKI' }, select: { id: true, ad: true, boyut: true, sayfaSayisi: true }, orderBy: { createdAt: 'asc' } },
      provalar: { select: { jeton: true, durum: true, sonTarih: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!is) return null;
  const durum = isDurumu(is.durum) ?? 'SIRADA';
  const dil: Dil = dilMi(m.tenant.locale) ? m.tenant.locale : 'tr';
  const kalanTutar = kalan(is.toplam, is.odenen);
  const cari = !!is.customerId && is.odemeYolu === 'CARI';
  const prova = is.provalar[0] ?? null;
  return {
    dil,
    birim: m.tenant.currency,
    tz: m.tenant.workTimezone || 'Europe/Istanbul',
    kisaAd: m.ayar.kisaAd!,
    firma: { ad: m.tenant.name, logo: m.tenant.logo, telefon: m.tenant.phone, adres: m.tenant.address, calisma: m.ayar.calismaSaatleri },
    siparisAcik: m.ayar.siparisAcik,
    saklamaGun: m.ayar.saklamaGun,
    is: {
      no: isNo(is.no), durum, musteriAd: is.musteriAd, sozVerilenAt: is.sozVerilenAt,
      toplam: is.toplam, odenen: is.odenen, kalan: kalanTutar, tahmini: is.tahmini,
      kalemler: is.kalemler,
      cizelge: takipCizelgesi({ durum, createdAt: is.createdAt, teslimAt: is.teslimAt }, is.olaylar),
    },
    // Havale kartı: borç varken, IBAN girilmişse ve iş cari değilse. Tutar
    // kesinleşmeden (tahmini) gösterilmez: müşteri yanlış tutarı yatırmasın.
    odeme: kalanTutar > 0 && durum !== 'IPTAL' && !cari && !is.tahmini && m.ayar.havaleKabul && m.tenant.odemeIban
      ? { iban: m.tenant.odemeIban, hesapAdi: m.tenant.odemeHesapAdi, aciklama: isNo(is.no) } : null,
    dosyalar: is.dosyalar,
    dosyaEklenebilir: r2Ayarli() && musteriYukleyebilir(durum),
    // Bekleyen ve süresi dolmamış prova: sayfa onay bağlantısına götürür.
    prova: prova ? { durum: prova.durum, jeton: prova.durum === 'BEKLIYOR' && prova.sonTarih > new Date() ? prova.jeton : null } : null,
  };
}

export type TakipVerisi = NonNullable<Awaited<ReturnType<typeof takipVerisi>>>;
