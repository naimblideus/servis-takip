import { NextResponse } from 'next/server';
import { anahtarlaBayi, nabizYaz, type NabizAsamasi } from '@/lib/sayac-tarama-veri';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sayac/tarayici/nabiz — tarayıcının "başladım" sinyali.
 *
 * Taramadan ÖNCE gelir: kurulum ekranı ilk saniyede "bağlandı, 254 adres
 * taranıyor" diyebilsin, anahtar ya da internet sorunu bir dakikalık
 * taramanın sonunda değil başında anlaşılsın. Yalnız kuruluma özel
 * anahtarla iz bırakır; bayinin dosya anahtarıyla gelen sinyal yalnız
 * anahtarın geçerli olduğunu doğrular.
 */
export async function POST(req: Request) {
  const yetki = req.headers.get('authorization') ?? '';
  const bayi = await anahtarlaBayi(yetki.startsWith('Bearer ') ? yetki.slice(7).trim() : null);
  if (!bayi) return NextResponse.json({ ok: false, kod: 'TARAYICI_ANAHTARI_GECERSIZ' }, { status: 401 });
  if (!bayi.isActive || bayi.isSuspended || bayi.deletedAt) return NextResponse.json({ ok: false, kod: 'TARAYICI_BAYI_KAPALI' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const asama: NabizAsamasi = b?.asama === 'GONDERILIYOR' ? 'GONDERILIYOR' : 'BASLADI';
  const hedefSayisi = Number.isInteger(b?.hedefSayisi) && b.hedefSayisi >= 0 ? Math.min(b.hedefSayisi, 1_000_000) : null;
  const bilgisayar = typeof b?.bilgisayar === 'string' ? b.bilgisayar.trim().slice(0, 64) || null : null;
  if (bayi.kurulumId) await nabizYaz(bayi.kurulumId, { asama, hedefSayisi, bilgisayar });
  return NextResponse.json({ ok: true });
}
