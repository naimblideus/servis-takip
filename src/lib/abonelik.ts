/**
 * ABONELİK — denemeden ödemeye geçiş.
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Deneme süresindeki bayi kaç günü kaldığını hiçbir yerde görmüyordu; süre
 * dolduğu an erişim kilitleniyor ve kilit ekranında yalnız bir e-posta
 * adresi çıkıyordu. Ödeyen bayi de kendi abonelik faturasını göremiyordu
 * (o faturaları yalnız süper admin görüyordu). Satın almaya hazır bayi,
 * satın almanın yolunu bulamıyordu.
 *
 * Tutar, faturayı KESEN fonksiyondan (plan-pricing monthlyAmount) gelir:
 * ekranda gösterilen ile kesilen ayrı hesaplanırsa ilk faturada tartışma çıkar.
 *
 * Saf modül: veritabanı yok.
 */
import { ibanGecerli, ibanBicimle, hesapAdiTemizle } from './odeme-bilgisi';

const GUN = 86_400_000;

/**
 * Denemenin bitmesine kalan gün. Deneme değilse ya da bitiş tarihi yoksa
 * null (şerit çizilmez). Son gün "1 gün" der, süresi geçmişse 0.
 */
export function denemeKalanGun(plan: string | null | undefined, trialEndsAt: Date | string | null | undefined, simdi: Date): number | null {
  if (plan !== 'trial' || !trialEndsAt) return null;
  const bitis = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(bitis)) return null;
  return Math.max(0, Math.ceil((bitis - simdi.getTime()) / GUN));
}

/**
 * WhatsApp numarası: yalnız rakam, uluslararası biçim (90…).
 * Türkiye'deki "0532…" ve "532…" yazımları 90'a çevrilir. Geçersizse null.
 */
export function whatsappNumarasi(s: string | null | undefined): string | null {
  let r = (s ?? '').replace(/\D/g, '');
  if (r.startsWith('00')) r = r.slice(2);
  if (r.length === 11 && r.startsWith('05')) r = '9' + r;          // 0532… → 90532…
  if (r.length === 10 && r.startsWith('5')) r = '90' + r;          // 532…  → 90532…
  return r.length >= 10 && r.length <= 15 ? r : null;
}

/** wa.me bağlantısı; mesaj ekranın dilinde ekran tarafından kurulur. */
export function whatsappLinki(numara: string | null, mesaj: string): string | null {
  return numara ? `https://wa.me/${numara}?text=${encodeURIComponent(mesaj)}` : null;
}

export interface PlatformOdeme {
  /** Dörtlü gruplar hâlinde; geçersizse null (yanlış IBAN'a havale gitmesin). */
  iban: string | null;
  hesapAdi: string | null;
  whatsapp: string | null;
}

/** Platform ayarındaki ödeme bilgisi, gösterilmeden önce yeniden doğrulanır. */
export function platformOdeme(ps: { odemeIban?: string | null; odemeHesapAdi?: string | null; satisWhatsapp?: string | null } | null | undefined): PlatformOdeme {
  const iban = ps?.odemeIban && ibanGecerli(ps.odemeIban) ? ibanBicimle(ps.odemeIban) : null;
  return {
    iban,
    hesapAdi: iban ? hesapAdiTemizle(ps?.odemeHesapAdi) : null,
    whatsapp: whatsappNumarasi(ps?.satisWhatsapp),
  };
}

/**
 * Ekranda gösterilecek aylık tutar hangi pakete göre?
 * Denemedeki bayiye "deneme bitince ne ödersin" sorusunun cevabı gerekiyor:
 * hedef paket Profesyonel olduğu için onun tutarı gösterilir.
 */
export function gosterilecekPaket(plan: string | null | undefined): 'starter' | 'professional' | 'enterprise' {
  return plan === 'starter' || plan === 'enterprise' ? plan : 'professional';
}
