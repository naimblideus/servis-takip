import { kurulumKoduNormal } from '@/lib/sayac-tarama';
import { kurulumKoduBul } from '@/lib/sayac-tarama-veri';
import { kurulumSitesi, onyukleyici } from '@/lib/tarayici-kurulum';

export const dynamic = 'force-dynamic';

/**
 * GET /k/KOD — tek komutla kurulumun önyükleyicisi (lib/tarayici-kurulum).
 * Kodu HARCAMAZ; yalnız geçerli mi diye bakar. Kod önyükleyicinin
 * POST /api/sayac/tarayici/kurulum/kullan çağrısında harcanır.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ kod: string }> }) {
  const { kod: ham } = await params;
  const kod = kurulumKoduNormal(ham);
  const bul = kod ? await kurulumKoduBul(kod) : { durum: 'YOK' as const, dil: null };
  const metin = onyukleyici(kurulumSitesi(), kod ?? '', bul.durum === 'GECERLI' ? null : bul.durum, bul.dil);
  return new Response(metin, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}
