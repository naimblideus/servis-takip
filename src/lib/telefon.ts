/**
 * TELEFONU OLMAYAN MÜŞTERİ — ekranda nasıl görünür
 *
 * Müşteri bayi içinde telefonla tekil ve telefon zorunlu. Telefonu olmayan
 * müşteriye (eski programdan SQL aktarımı, telefonsuz Excel listesi) "BOS-…"
 * yer tutucusu yazılıyor. WhatsApp/SMS yolları bunu numara saymıyor
 * (lib/share waPhone yalnız 905XXXXXXXXX kabul eder); ama ekranlar ve
 * belgeler "BOS-000070" diye basıyordu. Ölçülmüştü: bir bayide 305
 * müşterinin 124'ünde.
 *
 * Tarayıcıda da çalışır.
 */
export const TELEFON_YOK_ONEKI = 'BOS-';

/** Telefon gerçek değil (boş ya da yer tutucu). */
export function telefonYok(telefon: string | null | undefined): boolean {
  const t = (telefon ?? '').trim();
  return !t || t.toUpperCase().startsWith(TELEFON_YOK_ONEKI);
}

/** Ekrana/belgeye yazılacak telefon: yer tutucu yerine `yok` (varsayılan boş). */
export function telefonGoster(telefon: string | null | undefined, yok = ''): string {
  return telefonYok(telefon) ? yok : (telefon ?? '').trim();
}
