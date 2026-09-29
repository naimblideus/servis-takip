/**
 * İLK AY GARANTİSİ — bayi iade talep etmeye hak kazandı mı?
 *
 * (Cihazın servis garantisi başka bir şey: lib/garanti.ts. Bu dosya BİZİM
 * bayiye verdiğimiz abonelik garantisi.)
 *
 * Tanıtım sayfasındaki söz: "İlk ödediğiniz ay boyunca sayaçlarınızı
 * sistemde okuttuğunuz halde işinize yaramadığını düşünürseniz, o ayın
 * ücretini geri öderiz. Profesyonel ve Kurumsal paketlerde."
 *
 * Söz verilip takip edilmezse iki kötü sonuç var: hak kazanan bayiye
 * "şartı sağlamadınız" denir (güven biter) ya da sistemi hiç açmamış bayiye
 * iade yapılır (garanti suistimale açılır). Karar bu yüzden VERİDEN
 * türetiliyor: ilk ödenen abonelik dönemi ve o dönemde okunan sayaçlar.
 *
 * İadenin kendisi elle yapılır; bu modül yalnız hakkın durumunu söyler.
 * Saf modül: veritabanı yok.
 */

/** Garantinin geçerli olduğu paketler (tanıtım sayfasındaki metinle aynı). */
export const GARANTILI_PAKETLER: readonly string[] = ['professional', 'enterprise'];

export type GarantiDurumu =
  | { durum: 'KAPSAM_DISI'; plan: string | null }
  | { durum: 'ODEME_YOK' }
  | {
      durum: 'SURUYOR' | 'HAK_VAR' | 'HAK_YOK';
      donem: string;
      /** Dönemin bittiği an (bir sonraki ayın ilk günü, UTC). */
      bitis: string;
      okumaSayisi: number;
      okunanCihaz: number;
      kiralikCihaz: number;
    };

/** "2026-09" → [1 Eylül, 1 Ekim) UTC. Biçimsiz dönem null. */
export function donemAraligi(donem: string): { bas: Date; bit: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(donem);
  if (!m) return null;
  const yil = Number(m[1]), ay = Number(m[2]);
  if (ay < 1 || ay > 12) return null;
  return { bas: new Date(Date.UTC(yil, ay - 1, 1)), bit: new Date(Date.UTC(yil, ay, 1)) };
}

/**
 * @param plan           bayinin paketi
 * @param ilkOdenenDonem ödenmiş ilk abonelik faturasının dönemi ("2026-09") ya da null
 * @param okuma          o dönemdeki sayaç okumaları (çağıran dönem aralığında sayar)
 * @param simdi          referans an
 */
export function garantiDurumu(args: {
  plan: string | null;
  ilkOdenenDonem: string | null;
  okuma: { okumaSayisi: number; okunanCihaz: number; kiralikCihaz: number };
  simdi: Date;
}): GarantiDurumu {
  const { plan, ilkOdenenDonem, okuma, simdi } = args;
  if (!plan || !GARANTILI_PAKETLER.includes(plan)) return { durum: 'KAPSAM_DISI', plan };
  if (!ilkOdenenDonem) return { durum: 'ODEME_YOK' };
  const aralik = donemAraligi(ilkOdenenDonem);
  if (!aralik) return { durum: 'ODEME_YOK' };
  // Şart dönem bitmeden kesinleşmez: bayi ayın son günü sayaç okutabilir.
  const durum = simdi < aralik.bit ? 'SURUYOR' : okuma.okumaSayisi > 0 ? 'HAK_VAR' : 'HAK_YOK';
  return {
    durum,
    donem: ilkOdenenDonem,
    bitis: aralik.bit.toISOString(),
    okumaSayisi: okuma.okumaSayisi,
    okunanCihaz: okuma.okunanCihaz,
    kiralikCihaz: okuma.kiralikCihaz,
  };
}
