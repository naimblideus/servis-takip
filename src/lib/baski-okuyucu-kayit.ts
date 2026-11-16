// MATBAA SİPARİŞ OKUYUCU — sunucu katmanı: model çağrısı, taslak kaydı, onay.
// Kurallar saf çekirdekte (lib/baski-okuyucu); burada veritabanı ve SDK var.
//
// DOSYA SAKLANMAZ: uç dosyayı bellekte base64'e çevirir, buraya yalnız o
// gelir; ne diske ne depoya yazılır. Kalıcı olan yalnız okunan taslaktır.
import Anthropic from '@anthropic-ai/sdk';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fiyatliMi, urunTanimi, type UrunTanimi } from '@/lib/baski-fiyat';
import { isOlustur, type Kullanici, type YeniIs } from '@/lib/baski-is-kayit';
import {
  OKUYUCU_SURUM, belirsizSayisi, bugunBilgisi, duzeltmeler, kayitliOkuma, kisiselBilgiSil, siparisOku, sonForm,
  taslakGorunumu, type Kaynak, type OkumaGirdisi, type OkumaHatasi, type TaslakGorunumu,
} from '@/lib/baski-okuyucu';

/** Kiracı başına saatte en çok bu kadar okuma (maliyet ve kötüye kullanım sınırı). */
export const OKUMA_SAATLIK = 60;

/** Fiyat listesinde fiyatı girilmiş ürün: tezgah ve okuyucu yalnız bunları kullanır. */
export interface FiyatliUrun { id: string; teslimSaat: number | null; tanim: UrunTanimi }

export async function fiyatliUrunler(tenantId: string): Promise<{ urunler: FiyatliUrun[]; fiyatsiz: number }> {
  const satirlar = await prisma.baskiUrunu.findMany({ where: { tenantId, aktif: true }, orderBy: [{ sira: 'asc' }, { ad: 'asc' }] });
  const urunler: FiyatliUrun[] = [];
  let fiyatsiz = 0;
  for (const s of satirlar) {
    const tanim = urunTanimi(s);
    if (fiyatliMi(tanim)) urunler.push({ id: s.id, teslimSaat: s.teslimSaat, tanim });
    else fiyatsiz++;
  }
  return { urunler, fiyatsiz };
}

let istemci: Anthropic | null = null;
/**
 * Anahtar ortamdan (ANTHROPIC_API_KEY); uç önce `okuyucuAcik` ile bakar.
 * En kötü durum: 55 sn + bir yeniden deneme ≈ 2 dk (uç maxDuration 120 sn).
 */
function anthropic(): Anthropic {
  istemci ??= new Anthropic({ timeout: 55_000, maxRetries: 1 });
  return istemci;
}

export type OkumaKodu = OkumaHatasi | 'OKUMA_MESGUL' | 'OKUMA_ZAMAN_ASIMI' | 'OKUMA_MODEL_HATASI';

/** Okur ve taslağı kaydeder. Sipariş değilse ya da okunamadıysa kayıt yok. */
export async function okumaYap(
  tenantId: string,
  girdi: OkumaGirdisi,
  kim: Kullanici,
  meta: { kaynak: Kaynak; dosyaAdi?: string | null; dosyaBoyut?: number | null },
): Promise<{ ok: true; id: string; taslak: TaslakGorunumu } | { ok: false; kod: OkumaKodu }> {
  const [{ urunler }, tenant] = await Promise.all([
    fiyatliUrunler(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { workTimezone: true } }),
  ]);
  const gun = bugunBilgisi(new Date(), tenant?.workTimezone || 'Europe/Istanbul');
  const bas = Date.now();
  let s;
  try {
    s = await siparisOku(anthropic(), girdi, urunler, gun);
  } catch (e) {
    // En özelden genele. İçerik günlüğe YAZILMAZ (müşteri bilgisi), yalnız durum.
    if (e instanceof Anthropic.RateLimitError) return { ok: false, kod: 'OKUMA_MESGUL' };
    if (e instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, kod: 'OKUMA_ZAMAN_ASIMI' };
    if (e instanceof Anthropic.APIError) {
      console.error('[okuyucu] model hatası', e.status ?? 'bağlantı');
      return { ok: false, kod: 'OKUMA_MODEL_HATASI' };
    }
    throw e;
  }
  if (!s.ok) return s;

  const kayit = await prisma.baskiOkuma.create({
    data: {
      tenantId,
      kaynak: meta.kaynak,
      dosyaAdi: meta.dosyaAdi ? meta.dosyaAdi.slice(0, 200) : null,
      dosyaBoyut: meta.dosyaBoyut ?? null,
      okunan: s.okuma as unknown as Prisma.InputJsonValue,
      belirsizSayisi: belirsizSayisi(s.okuma),
      model: s.model,
      surum: OKUYUCU_SURUM,
      sureMs: Date.now() - bas,
      girdiToken: s.girdiToken,
      ciktiToken: s.ciktiToken,
      okuyanId: kim.id,
      okuyanAd: kim.name ?? null,
    },
    select: { id: true },
  });
  return { ok: true, id: kayit.id, taslak: taslakGorunumu(s.okuma) };
}

/** Kayıtlı taslak → ekran (tezgah formunun başlangıcı). Taslak değilse null. */
export async function taslakGetir(tenantId: string, id: string, urunler: readonly FiyatliUrun[]) {
  const o = await prisma.baskiOkuma.findFirst({
    where: { id, tenantId },
    select: { id: true, durum: true, isId: true, kaynak: true, dosyaAdi: true, okunan: true, createdAt: true },
  });
  if (!o) return null;
  return { ...o, taslak: taslakGorunumu(kayitliOkuma(o.okunan, urunler)) };
}

/** Yarıda kalmış onay (sunucu düştü) bu süreden sonra yeniden onaylanabilir. */
const KILIT_SURESI_MS = 2 * 60_000;

/**
 * Taslağı onaylar: işi açar (kanal WHATSAPP), okumaya bağlar, ne düzeltildiğini
 * yazar. Aynı taslağı iki kişi aynı anda onaylarsa tek iş açılır (kilit).
 * Tutar istemciden alınmaz: isOlustur fiyat listesinden hesaplar.
 */
export async function okumaOnayla(tenantId: string, id: string, govde: Record<string, unknown>, kim: Kullanici):
  Promise<{ ok: true; isId: string } | { ok: false; kod: string }> {
  const okuma = await prisma.baskiOkuma.findFirst({ where: { id, tenantId }, select: { id: true, durum: true, okunan: true } });
  if (!okuma) return { ok: false, kod: 'OKUMA_YOK' };
  const kilit = await prisma.baskiOkuma.updateMany({
    where: {
      id, tenantId,
      OR: [{ durum: 'TASLAK' }, { durum: 'ONAYLANIYOR', updatedAt: { lt: new Date(Date.now() - KILIT_SURESI_MS) } }],
    },
    data: { durum: 'ONAYLANIYOR' },
  });
  if (kilit.count !== 1) return { ok: false, kod: 'OKUMA_ISLENDI' };
  const geriAl = () => prisma.baskiOkuma.updateMany({ where: { id, tenantId, durum: 'ONAYLANIYOR' }, data: { durum: 'TASLAK' } });

  try {
    const girdi = { ...(govde as unknown as YeniIs), kanal: 'WHATSAPP' };
    const r = await isOlustur(tenantId, girdi, kim, { personel: true });
    if (!r.ok) { await geriAl(); return { ok: false, kod: r.kod }; }

    const { urunler } = await fiyatliUrunler(tenantId);
    const oneri = taslakGorunumu(kayitliOkuma(okuma.okunan, urunler)).form;
    const d = duzeltmeler(oneri, sonForm(govde), urunler);
    await prisma.$transaction([
      prisma.baskiOkuma.update({
        where: { id },
        data: {
          durum: 'ONAYLANDI', isId: r.is.id, onaylayanId: kim.id, onaylandiAt: new Date(),
          duzeltilenler: d as unknown as Prisma.InputJsonValue, duzeltmesiz: d.degisen.length === 0,
        },
      }),
      // İş geçmişinde: "WhatsApp siparişinden okundu" (metin = düzeltilen alan sayısı).
      prisma.baskiOlayi.create({
        data: { isId: r.is.id, tenantId, tur: 'OKUMA', metin: String(d.degisen.length), kullaniciId: kim.id, kullaniciAd: kim.name ?? null },
      }),
    ]);
    return { ok: true, isId: r.is.id };
  } catch (e) {
    await geriAl().catch(() => {});
    throw e;
  }
}

/** Taslağı atar; kişisel bilgi silinir, sayım için kayıt kalır. */
export async function okumaAt(tenantId: string, id: string): Promise<{ ok: true } | { ok: false; kod: 'OKUMA_YOK' | 'OKUMA_ISLENDI' }> {
  const o = await prisma.baskiOkuma.findFirst({ where: { id, tenantId }, select: { okunan: true } });
  if (!o) return { ok: false, kod: 'OKUMA_YOK' };
  const r = await prisma.baskiOkuma.updateMany({
    where: { id, tenantId, durum: 'TASLAK' },
    data: { durum: 'ATILDI', okunan: kisiselBilgiSil(o.okunan) as Prisma.InputJsonValue },
  });
  return r.count === 1 ? { ok: true } : { ok: false, kod: 'OKUMA_ISLENDI' };
}

/** Panel: son `gun` günde okunan, onaylanan, düzeltmesiz ve en çok düzeltilen alanlar. */
export async function okumaSayilari(tenantId: string, gun = 30) {
  const bas = new Date(Date.now() - gun * 86_400_000);
  const [okunan, onaylananlar] = await Promise.all([
    prisma.baskiOkuma.count({ where: { tenantId, createdAt: { gte: bas } } }),
    prisma.baskiOkuma.findMany({
      where: { tenantId, createdAt: { gte: bas }, durum: 'ONAYLANDI' },
      select: { duzeltmesiz: true, duzeltilenler: true },
      take: 5000,
    }),
  ]);
  const degisenler = onaylananlar.map((o) => {
    const d = o.duzeltilenler as { degisen?: unknown } | null;
    return Array.isArray(d?.degisen) ? (d.degisen as unknown[]).map(String) : [];
  });
  return {
    okunan,
    onaylanan: onaylananlar.length,
    duzeltmesiz: onaylananlar.filter((o) => o.duzeltmesiz === true).length,
    degisenler,
  };
}

/** Onay bekleyen taslaklar (en yeni önce). */
export function bekleyenTaslaklar(tenantId: string, adet = 20) {
  return prisma.baskiOkuma.findMany({
    where: { tenantId, durum: { in: ['TASLAK', 'ONAYLANIYOR'] } },
    orderBy: { createdAt: 'desc' },
    take: adet,
    select: { id: true, kaynak: true, dosyaAdi: true, belirsizSayisi: true, okunan: true, okuyanAd: true, createdAt: true },
  });
}
