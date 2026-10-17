import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { rateLimit } from '@/lib/rate-limit';
import { istemciIp } from '@/lib/istemci-ip';
import { anketCevapla } from '@/lib/memnuniyet-veri';
import { dilMi, type Dil } from '@/lib/i18n/sozluk';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/anket/<fiş> — müşterinin tavsiye puanı. OTURUMSUZ.
 *
 * Gövde: { t: anahtar, puan: 0–10, yorum?: ≤1000 karakter, dil?: 'tr'|'en' }
 *
 * Bu uca kimliği doğrulanmamış biri yazıyor:
 *  · Yalnız imzalı anahtarla çalışır (docToken('anket', fiş)); anahtar başka
 *    fişe taşınamaz, bayi fişten okunur — adreste bayi yok.
 *  · Fiş iş bitmiş durumda olmalı (DELIVERED ya da READY).
 *  · İkinci cevap ilkini EZMEZ: 200 + { durum: 'ZATEN' } döner, hata değil.
 *  · IP başına ve fiş başına hız sınırı (anahtar 160 bit, tahmin edilemez;
 *    sınır, sayfayı yenileyip duran ya da betikle basan için).
 *
 * Bütün karar lib/memnuniyet-veri.ts'te (anketCevapla); burada yalnız HTTP.
 */
export async function POST(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const govde = await req.json().catch(() => null) as Record<string, unknown> | null;
  // Hata cümlesi sayfanın dilinde: sayfa kendi dilini gönderiyor.
  const dilHam = govde?.dil;
  const sayfaDili: Dil | undefined = dilMi(dilHam) ? dilHam : undefined;

  const ip = istemciIp(req);
  if (ip && !rateLimit(`anket-ip:${ip}`, 30, 10 * 60_000).ok) {
    return ucHatasi('COK_FAZLA_ISTEK_LUTFEN_BIRAZ', 429, { dil: sayfaDili });
  }
  if (!rateLimit(`anket-fis:${ticketId}`, 12, 10 * 60_000).ok) {
    return ucHatasi('COK_FAZLA_ISTEK_LUTFEN_BIRAZ', 429, { dil: sayfaDili });
  }
  if (!govde || typeof govde !== 'object') return ucHatasi('GECERSIZ_ISTEK', 400, { dil: sayfaDili });

  try {
    const s = await anketCevapla({ ticketId, anahtar: govde.t, puan: govde.puan, yorum: govde.yorum });
    if (s.durum === 'GECERSIZ') return ucHatasi('ANKET_BAGLANTI_GECERSIZ', 404, { dil: sayfaDili });
    // Bayinin dili, sayfa dil göndermediyse.
    const dil: Dil | undefined = sayfaDili ?? (dilMi(s.dil) ? s.dil : undefined);
    switch (s.durum) {
      case 'KAYDEDILDI': return NextResponse.json({ ok: true, durum: 'KAYDEDILDI' });
      case 'ZATEN': return NextResponse.json({ ok: true, durum: 'ZATEN' });
      case 'KAPALI': return ucHatasi('ANKET_KAPALI', 409, { dil });
      case 'PUAN_GECERSIZ': return ucHatasi('ANKET_PUAN_GECERSIZ', 400, { dil });
      case 'YORUM_UZUN': return ucHatasi('ANKET_YORUM_COK_UZUN', 400, { dil });
    }
  } catch (e) {
    console.error('[anket] cevap yazılamadı:', ticketId, e instanceof Error ? e.message : e);
  }
  return ucHatasi('SUNUCU_HATASI', 500, { dil: sayfaDili });
}
