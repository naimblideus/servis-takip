import { NextResponse } from 'next/server';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { rateLimit } from '@/lib/rate-limit';
import { AZAMI_METIN, boyutKontrol, govdeBuyukMu, kaynakTuru, okuyucuAcik, type OkumaGirdisi } from '@/lib/baski-okuyucu';
import { OKUMA_SAATLIK, okumaYap } from '@/lib/baski-okuyucu-kayit';

export const dynamic = 'force-dynamic';
// Okuma model tarafında 10–60 sn sürebilir.
export const maxDuration = 120;

/**
 * POST /api/matbaa/okuma — multipart: `dosya` (JPG/PNG/WEBP/GIF/PDF) ve/veya
 * `metin` (yazılı sipariş ya da fotoğrafın açıklaması). Sipariş okunur,
 * TASLAK kaydedilir: { id, taslak }. İş AÇILMAZ; onay ayrı uçta.
 *
 * Dosya yalnız bellekte durur: base64'e çevrilip modele gider, sonra atılır.
 * Boyut gövde OKUNMADAN denetlenir (middleware 10 MB'ta keser; biz 8 MB'ta
 * anlaşılır bir hatayla duruyoruz).
 */
export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireMatbaaUser(['ADMIN', 'FRONT_DESK']);
    if (!okuyucuAcik(process.env)) return baskiHatasi('OKUYUCU_KAPALI');
    if (govdeBuyukMu(req.headers.get('content-length'))) return baskiHatasi('OKUMA_BUYUK');
    if (!rateLimit(`okuyucu:${tenantId}`, OKUMA_SAATLIK, 3_600_000).ok) return baskiHatasi('OKUMA_SINIR');

    const form = await req.formData().catch(() => null);
    if (!form) return baskiHatasi('OKUMA_BOS');
    const dosya = form.get('dosya');
    const ham = form.get('metin');
    const metin = typeof ham === 'string' ? ham.trim() : '';
    if (metin.length > AZAMI_METIN) return baskiHatasi('OKUMA_BUYUK');

    let girdi: OkumaGirdisi;
    let meta: Parameters<typeof okumaYap>[3];
    if (dosya instanceof File && dosya.size > 0) {
      const kaynak = kaynakTuru(dosya.type);
      if (!kaynak) return baskiHatasi('OKUMA_TUR');
      const boyut = boyutKontrol(kaynak, dosya.size);
      if (boyut) return baskiHatasi(boyut);
      const base64 = Buffer.from(await dosya.arrayBuffer()).toString('base64');
      girdi = { dosya: { kaynak, mime: dosya.type.toLowerCase(), base64 }, metin };
      meta = { kaynak, dosyaAdi: dosya.name || null, dosyaBoyut: dosya.size };
    } else if (metin) {
      girdi = { metin };
      meta = { kaynak: 'METIN' };
    } else {
      return baskiHatasi('OKUMA_BOS');
    }

    const r = await okumaYap(tenantId, girdi, user, meta);
    if (!r.ok) return baskiHatasi(r.kod);
    return NextResponse.json({ ok: true, id: r.id, taslak: r.taslak }, { status: 201 });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
