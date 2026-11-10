/**
 * KİRA — DÖNEM DÖNEM, SIRADAN BAĞIMSIZ (saf; veritabanına dokunmaz).
 *
 * ── NEYİ DÜZELTİYOR ──────────────────────────────────────────────────────
 * Kira tek bir işaretle tutuluyordu: Device.lastInvoicedPeriod, "kirası
 * kesilen son ay". Kural "yalnız işaretten sonraki ay kesilir, işaret geri
 * gitmez" idi. Aylar sırayla kesildiği sürece doğru; sıra bozulunca para
 * kayboluyordu ve hiçbir ekran söylemiyordu:
 *
 *   · Temmuz faturası şüpheli okuma yüzünden taslakta bekliyor. Ağustos
 *     kesiliyor → işaret Ağustos. Bayi Temmuz'u onaylıyor → Temmuz'un kirası
 *     artık "geçmiş": kesilmiyor. (Ölçüldü: ₺4.000 yerine ₺2.500.)
 *   · Gece işi bir müşteride hata alıyor, ertesi ay kesiliyor → aynı sonuç.
 *   · Taslaklar toplu onaylanıyor; liste en yeni dönem önce.
 *
 * ── YENİ KURAL ───────────────────────────────────────────────────────────
 * Her cihaz × dönem için kira en fazla bir kez kesilir; kesildiği KiraDonemi
 * satırıyla bilinir (tekil dizin). Bir dönemin kirası kesilebilir ⇔
 *   kiralık ∧ kira > 0 ∧ dönem > taban ∧ cihaz dönem bitmeden eklenmiş ∧
 *   o dönemin satırı yok.
 *
 * Taban = Device.lastInvoicedPeriod: "bu ay ve öncesi kapandı". Aktarım
 * "son faturalanan ay"ı buraya yazar; eski düzenden gelen cihazlarda yeni
 * düzene geçildiği andaki değerdir. Kesim tabanı DEĞİŞTİRMEZ — sıra bu
 * yüzden önemsizdir ve atlanan ay "kesilmemiş kira" olarak görünür kalır.
 *
 * Dahil paketin sıradan bağımsızlığı lib/invoicing sayacAyCarpanlari'nda.
 */
import { oncekiDonem } from '@/lib/fatura-donemi';

export type KiraCihazi = {
  isRental: boolean;
  monthlyRent: unknown;
  lastInvoicedPeriod: string | null;
  createdAt?: Date | null;
};

/**
 * Bu dönemin kirası kesilir mi? `kesildi`: cihazın bu dönem için KiraDonemi
 * satırı var mı (çağıran veritabanından getirir).
 *
 * Cihaz dönem bittikten sonra eklendiyse o dönemin kirası yoktur.
 */
export function kiraKesilir(d: KiraCihazi, period: string, donemSonu: Date | undefined, kesildi: boolean): boolean {
  if (!d.isRental || !(Number(d.monthlyRent) > 0)) return false;
  if (kesildi) return false;
  if ((d.lastInvoicedPeriod ?? '') >= period) return false;
  if (donemSonu && d.createdAt && d.createdAt >= donemSonu) return false;
  return true;
}

/**
 * Verilen dönemden geriye doğru, kirası kesilmemiş dönemler (eskiden yeniye).
 * Kaçan Gelir bunu gösterir: atlanan ay artık kaybolmuyor, görünür kalıyor.
 * `kesilmis`: cihazın KiraDonemi satırı olan dönemler. En çok `ust` dönem geriye bakar.
 */
export function kesilmemisKiraDonemleri(
  d: KiraCihazi,
  buDonem: string,
  kesilmis: ReadonlySet<string>,
  donemSonuOf: (period: string) => Date,
  ust = 12,
): string[] {
  const sonuc: string[] = [];
  let p = buDonem;
  for (let i = 0; i < ust; i++) {
    if ((d.lastInvoicedPeriod ?? '') >= p) break; // tabanın altına inildi
    if (kiraKesilir(d, p, donemSonuOf(p), kesilmis.has(p))) sonuc.push(p);
    p = oncekiDonem(p);
  }
  return sonuc.reverse();
}
