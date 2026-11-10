/**
 * AY SONU FATURA KOŞUSU — veritabanı katmanı (kural lib/fatura-donemi'de).
 *
 * Bir dönemin koşusu (gece işi ya da kapanmış ayı elle faturalama) bitince
 * FaturaTuru TAMAM olur. O andan sonra o döneme düşen geç okuma (portalda
 * dün girilip bugün onaylanan, gecikmeli gelen cihaz raporu) bir sonraki
 * açık döneme yazılır: aksi hâlde hiçbir koşu ona bir daha bakmaz.
 *
 * Açık dönemi ayın ortasında elle faturalamak koşuyu TAMAM YAPMAZ — dönem
 * açık kalır, ay içindeki kalan okumalar aynı ayın paketiyle faturalanır.
 */
import { prisma } from '@/lib/prisma';
import { acikDonem, kesimGunu, oncekiDonem } from '@/lib/fatura-donemi';

const ONBELLEK_MS = 60_000;
type Kayit = { kapali: boolean; son: number };

/** Süreç içi önbellek: 1.000 cihazlık e-posta raporu her okumada sorgu atmasın. */
const onbellek: Map<string, Kayit> =
  ((globalThis as { __donemKapaliOnbellek?: Map<string, Kayit> }).__donemKapaliOnbellek ??= new Map());

/** Bu dönemin fatura koşusu bitti mi? */
export async function donemKapaliMi(tenantId: string, period: string): Promise<boolean> {
  const anahtar = `${tenantId}:${period}`;
  const k = onbellek.get(anahtar);
  if (k && Date.now() - k.son < ONBELLEK_MS) return k.kapali;
  const t = await prisma.faturaTuru.findUnique({
    where: { tenantId_period: { tenantId, period } },
    select: { durum: true },
  });
  const kapali = t?.durum === 'TAMAM';
  onbellek.set(anahtar, { kapali, son: Date.now() });
  return kapali;
}

/**
 * Bu koşu dönemi kapatır mı? Yalnız kesim anı geçmiş (kapanmış) bir dönem.
 * Açık dönemi faturalamak ara faturadır, dönemi kapatmaz.
 */
export function kosuDonemiKapatir(period: string, kesim: unknown, an: Date = new Date()): boolean {
  return period < acikDonem(an, kesimGunu(kesim));
}

export interface KosuOzeti {
  faturaSayisi: number;
  toplam: number;
  hataSayisi: number;
  hatalar?: { customerId: string; hata: string }[];
}

/** Dönemin taslakta bekleyen fatura sayısını FaturaTuru'na yazar (taslak kesilince/atılınca da). */
export async function bekleyenSayisiniTazele(tenantId: string, period: string): Promise<number> {
  const n = await prisma.faturaTaslagi.count({ where: { tenantId, period, durum: 'BEKLIYOR' } });
  await prisma.faturaTuru.updateMany({ where: { tenantId, period }, data: { bekleyenSayisi: n } });
  return n;
}

/**
 * Koşunun sonucunu yazar. `kapat` doğruysa dönem TAMAM olur (geç okumalar
 * sonraki döneme kayar); değilse özet tutulur, dönem açık kalır. Aynı dönem
 * ikinci kez koşulursa (kalan okumaları elle kesmek) fatura sayısı ve toplam
 * birikir; hata sayısı ise SON koşunundur ("şu an kaç müşteri kesilemedi").
 *
 * Hata alan koşu dönemi kapatmaz (çağıran `kapat`ı buna göre verir) ve dönem
 * HATA olarak işaretlenir: gece işi ertesi gün yeniden dener (bitmemisDonemler).
 */
export async function kosuyuKaydet(
  tenantId: string,
  period: string,
  kaynak: 'CRON' | 'ELLE',
  ozet: KosuOzeti,
  kapat: boolean,
): Promise<void> {
  const hatalar = ozet.hatalar?.slice(0, 50);
  const simdi = new Date();
  await prisma.faturaTuru.upsert({
    where: { tenantId_period: { tenantId, period } },
    create: {
      tenantId, period, kaynak,
      durum: kapat ? 'TAMAM' : ozet.hataSayisi > 0 ? 'HATA' : 'CALISIYOR',
      faturaSayisi: ozet.faturaSayisi,
      toplam: ozet.toplam,
      hataSayisi: ozet.hataSayisi,
      hatalar: hatalar && hatalar.length ? hatalar : undefined,
      bitis: kapat ? simdi : null,
    },
    update: {
      kaynak,
      ...(kapat ? { durum: 'TAMAM', bitis: simdi } : {}),
      faturaSayisi: { increment: ozet.faturaSayisi },
      toplam: { increment: ozet.toplam },
      hataSayisi: ozet.hataSayisi,
      hatalar: hatalar && hatalar.length ? hatalar : [],
    },
  });
  // Hata alan koşu: dönem kapanmadıysa HATA (zaten TAMAM olan dönem geri açılmaz).
  if (!kapat && ozet.hataSayisi > 0) {
    await prisma.faturaTuru.updateMany({ where: { tenantId, period, durum: { not: 'TAMAM' } }, data: { durum: 'HATA' } });
  }
  await bekleyenSayisiniTazele(tenantId, period);
  onbellek.set(`${tenantId}:${period}`, { kapali: kapat || (await donemKapaliMiTaze(tenantId, period)), son: Date.now() });
}

async function donemKapaliMiTaze(tenantId: string, period: string): Promise<boolean> {
  const t = await prisma.faturaTuru.findUnique({ where: { tenantId_period: { tenantId, period } }, select: { durum: true } });
  return t?.durum === 'TAMAM';
}

/**
 * Kapanmış ama koşusu bitmemiş dönemler (hata almış ya da yarım kalmış),
 * eskiden yeniye. Gece işi yalnız "az önce kapanan" döneme bakıyordu; ay
 * dönünce önceki ayın yarım kalmış koşusu bir daha hiç denenmiyordu.
 * `geriAy` kadar geriye bakar: daha eskisi bayinin elle karar vereceği iştir.
 */
export async function bitmemisDonemler(tenantId: string, kapanan: string, geriAy = 3): Promise<string[]> {
  let alt = kapanan;
  for (let i = 0; i < geriAy; i++) alt = oncekiDonem(alt);
  const r = await prisma.faturaTuru.findMany({
    where: { tenantId, durum: { not: 'TAMAM' }, period: { gte: alt, lt: kapanan } },
    select: { period: true },
    orderBy: { period: 'asc' },
  });
  return r.map((x) => x.period);
}
