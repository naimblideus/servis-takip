/**
 * DİL — SUNUCU TARAFI.
 *
 * Yalnız sunucu bileşenleri ve route'lar içe aktarır (`next/headers`).
 *
 * Öncelik: ÇEREZ > kullanıcının kayıtlı tercihi > bayinin varsayılanı > 'tr'.
 * Çerez önde, çünkü kullanıcı dili değiştirdiği an ekranın değişmesi gerekir;
 * veritabanı yazımı arkadan gelir ve gecikse bile arayüz bekletmez.
 */
import { cookies } from 'next/headers';
import { dilMi, DIL_CEREZI, VARSAYILAN_DIL, type Dil } from './sozluk';

export async function sunucuDili(...yedekler: Array<string | null | undefined>): Promise<Dil> {
  const cerez = (await cookies()).get(DIL_CEREZI)?.value;
  if (dilMi(cerez)) return cerez;
  for (const y of yedekler) if (dilMi(y)) return y;
  return VARSAYILAN_DIL;
}
