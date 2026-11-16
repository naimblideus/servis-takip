// BELGE OKUYUCU ÇEKİRDEĞİ — sunucu tarafı, üründen bağımsız.
// Model istemcisi, SDK hata sınıflandırması ve istekten girdi alma burada;
// saf kurallar lib/belge-okuyucu'da. Ürün uçları (ör. /api/matbaa/okuma)
// yalnız kendi kapısını, hız sınırını ve şemasını ekler.
//
// DOSYA SAKLANMAZ: girdi bellekte base64'e çevrilir; ne diske ne depoya yazılır.
import Anthropic from '@anthropic-ai/sdk';
import {
  AZAMI_METIN, boyutKontrol, govdeBuyukMu, kaynakTuru, okuyucuAcik,
  type BelgeGirdisi, type Kaynak, type OkumaHatasi,
} from '@/lib/belge-okuyucu';

let istemci: Anthropic | null = null;
/**
 * Anahtar ortamdan (ANTHROPIC_API_KEY); uçlar önce `okumaKapisi` ile bakar.
 * En kötü durum: 55 sn + bir yeniden deneme ≈ 2 dk (uçlarda maxDuration 120 sn).
 */
export function belgeIstemcisi(): Anthropic {
  istemci ??= new Anthropic({ timeout: 55_000, maxRetries: 1 });
  return istemci;
}

export type ModelHatasi = 'OKUMA_MESGUL' | 'OKUMA_ZAMAN_ASIMI' | 'OKUMA_MODEL_HATASI';

/**
 * SDK hatası → kod (en özelden genele). SDK hatası değilse null: çağıran
 * fırlatır. İçerik günlüğe YAZILMAZ (müşteri bilgisi), yalnız durum.
 */
export function modelHatasi(e: unknown): ModelHatasi | null {
  if (e instanceof Anthropic.RateLimitError) return 'OKUMA_MESGUL';
  if (e instanceof Anthropic.APIConnectionTimeoutError) return 'OKUMA_ZAMAN_ASIMI';
  if (e instanceof Anthropic.APIError) {
    console.error('[belge-okuyucu] model hatası', e.status ?? 'bağlantı');
    return 'OKUMA_MODEL_HATASI';
  }
  return null;
}

/**
 * Gövdeyi OKUMADAN önce: okuyucu kapalıysa ya da gövde sınırı aşıyorsa kod.
 * `kapatma` ürünün kendi kapatma değişkeni (ör. MATBAA_OKUYUCU).
 */
export function okumaKapisi(req: Request, kapatma?: string): OkumaHatasi | null {
  if (!okuyucuAcik(process.env, kapatma)) return 'OKUYUCU_KAPALI';
  if (govdeBuyukMu(req.headers.get('content-length'))) return 'OKUMA_BUYUK';
  return null;
}

export interface GirdiMeta { kaynak: Kaynak; dosyaAdi?: string | null; dosyaBoyut?: number | null }

/** multipart: `dosya` (JPG/PNG/WEBP/GIF/PDF) ve/veya `metin`. Tür ve boyut burada denetlenir. */
export async function belgeGirdisiOku(req: Request):
  Promise<{ ok: true; girdi: BelgeGirdisi; meta: GirdiMeta } | { ok: false; kod: OkumaHatasi }> {
  const form = await req.formData().catch(() => null);
  if (!form) return { ok: false, kod: 'OKUMA_BOS' };
  const dosya = form.get('dosya');
  const ham = form.get('metin');
  const metin = typeof ham === 'string' ? ham.trim() : '';
  if (metin.length > AZAMI_METIN) return { ok: false, kod: 'OKUMA_BUYUK' };

  if (dosya instanceof File && dosya.size > 0) {
    const kaynak = kaynakTuru(dosya.type);
    if (!kaynak) return { ok: false, kod: 'OKUMA_TUR' };
    const boyut = boyutKontrol(kaynak, dosya.size);
    if (boyut) return { ok: false, kod: boyut };
    const base64 = Buffer.from(await dosya.arrayBuffer()).toString('base64');
    return {
      ok: true,
      girdi: { dosya: { kaynak, mime: dosya.type.toLowerCase(), base64 }, metin },
      meta: { kaynak, dosyaAdi: dosya.name || null, dosyaBoyut: dosya.size },
    };
  }
  if (metin) return { ok: true, girdi: { metin }, meta: { kaynak: 'METIN' } };
  return { ok: false, kod: 'OKUMA_BOS' };
}
