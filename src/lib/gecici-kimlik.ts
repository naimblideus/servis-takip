/**
 * SERİ NO'SU HENÜZ BİLİNMEYEN CİHAZ
 *
 * Kaydı hiç olmayan bayi ilk telefonda cihazın seri numarasını bilmez: müşteri
 * "yazıcı kağıt sıkıştırıyor" der, o kadar. Eskiden hızlı cihaz eklemede seri
 * no zorunluydu ve tezgah fişi açamıyordu. Artık cihaz geçici kimlikle açılır,
 * teknisyen sahada etiketi okutup gerçek seriyi yazar.
 *
 * Seri no veritabanında bayi içinde tekil ve zorunlu; boş bırakılamaz. Bu yüzden
 * önekli bir kimlik yazılıyor:
 *   GEC-…  elle eklenen, seri no'su bilinmeyen cihaz (rastgele)
 *   IMP-…  Excel aktarımında seri no'su olmayan satır (satırdan türetilen;
 *          lib/sayfa-ice-aktar.ts — aynı dosya ikinci kez yüklenince çoğalmasın)
 * İkisi de "seri no bekliyor" sayılır. Sayaç e-postası seri numarasıyla eşleştiği
 * için bu cihazların sayacı, gerçek seri girilene kadar otomatik işlenemez.
 *
 * Tarayıcıda da çalışır (fiş ekranı aynı kuralla "Cihazı tanımla" der).
 */

export const BILINMIYOR = 'Bilinmiyor';

const ONEKLER = ['GEC-', 'IMP-'];
// Karışan karakterler (0/O, 1/I) yok: teknisyen ekrandan okuyup yazabilsin.
const HARFLER = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Elle eklenen, seri no'su bilinmeyen cihazın geçici kimliği: GEC-XXXXXXXX. */
export function geciciSeri(): string {
  const b = new Uint8Array(8);
  globalThis.crypto.getRandomValues(b);
  return 'GEC-' + Array.from(b, (x) => HARFLER[x % HARFLER.length]).join('');
}

/** Seri numarası gerçek değil (boş, GEC- ya da IMP-): sahada tanımlanmalı. */
export function seriBekliyor(seri: string | null | undefined): boolean {
  const s = (seri ?? '').trim().toUpperCase();
  return !s || ONEKLER.some((o) => s.startsWith(o));
}

/** Marka ya da model bilinmiyor. */
export function modelBekliyor(marka: string | null | undefined, model: string | null | undefined): boolean {
  const b = (marka ?? '').trim();
  const m = (model ?? '').trim();
  return !b || !m || b === BILINMIYOR || m === BILINMIYOR;
}

/** Teknisyenin sahada tamamlaması gereken cihaz mı? */
export function cihazTanimlanmali(d: { serialNo?: string | null; brand?: string | null; model?: string | null }): boolean {
  return seriBekliyor(d.serialNo) || modelBekliyor(d.brand, d.model);
}
