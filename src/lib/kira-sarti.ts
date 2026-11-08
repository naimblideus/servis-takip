/**
 * KİRALIK CİHAZIN KİRA BİLGİSİ EKSİK Mİ — tek kural, iki yer.
 *
 * Kaydı olmayan bayide cihaz sahada "kiralık" diye tanımlanır, kira bilgisi
 * çoğu zaman sonra girilir. Eksik kalırsa ay sonunda bu cihazdan sabit kira
 * çıkmaz ve kimse fark etmez. Aynı kural iki yerde soruluyor:
 *   · Excel aktarımının ön izlemesi (KIRA_YOK uyarısı, lib/sayfa-ice-aktar),
 *   · fatura öncesi kontrol (api/invoices/preflight → Faturalar ekranında
 *     "kira bilgisi yok" listesi, yerinde doldurulur).
 * Eksik sayılan: aylık kira, sayfa fiyatı ve aşım fiyatının HİÇBİRİ yok.
 *
 * Tarayıcıda da çalışır (Prisma Decimal da sayıya çevrilir).
 */
const pozitif = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0;
};

export function kiraSartiEksik(d: {
  monthlyRent?: unknown; pricePerBlack?: unknown; pricePerColor?: unknown;
  overagePriceBlack?: unknown; overagePriceColor?: unknown;
}): boolean {
  return !pozitif(d.monthlyRent) && !pozitif(d.pricePerBlack) && !pozitif(d.pricePerColor)
    && !pozitif(d.overagePriceBlack) && !pozitif(d.overagePriceColor);
}

/** Fatura öncesi listede en çok kaç cihaz gösterilir (sayı ayrıca döner). */
export const KIRA_EKSIK_LISTE_AZAMI = 100;
