/**
 * MÜŞTERİDEN ÖDEME — IBAN ve kartla ödeme bağlantısı.
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Müşteri panelinde bakiye yazıyordu ama "nasıl öderim" yazmıyordu. Müşteri
 * borcunu görüp bayiyi arıyor, IBAN'ı telefonda soruyordu; tahsilat bir
 * telefon trafiğine dönüşüyordu. Artık bakiyenin hemen altında bayinin
 * IBAN'ı ve (varsa) kartla ödeme düğmesi duruyor.
 *
 * ── KART BİLGİSİ BU SİSTEME GİRMEZ ───────────────────────────────────────
 * Kartla ödeme için bayinin KENDİ POS sağlayıcısının (iyzico, PayTR, Param
 * gibi) panelinden aldığı ödeme bağlantısı kullanılıyor. Müşteri o sayfaya
 * gider, kartını orada girer. Kart verisini hiç görmüyoruz; bu, entegrasyon
 * sözleşmesi beklemeden bugün çalışmasını da sağlıyor.
 *
 * ── YANLIŞ IBAN PARAYI KAYBETTİRİR ───────────────────────────────────────
 * Tek harfi yanlış bir IBAN'a gönderilen havale ya geri döner ya da başka
 * birine gider. Bu yüzden IBAN kaydedilmeden önce uluslararası kontrol
 * toplamı (ISO 13616, mod 97) ve ülke uzunluğu doğrulanıyor.
 *
 * Saf modül: veritabanı yok.
 */

/** Ülke → IBAN uzunluğu. Listede olmayan ülke yalnız genel kurala tabi. */
export const IBAN_UZUNLUK: Readonly<Record<string, number>> = {
  TR: 26, DE: 22, NL: 18, GB: 22, FR: 27, IT: 27, ES: 24, AT: 20, BE: 16, CH: 21,
  PL: 28, SE: 24, DK: 18, NO: 15, FI: 18, IE: 22, PT: 25, GR: 27, CZ: 24, HU: 28,
  RO: 24, BG: 22, HR: 21, LU: 20, CY: 28, AZ: 28, GE: 22,
};

/** Boşluk ve ayraçsız, büyük harf. */
export function ibanTemizle(s: string | null | undefined): string {
  return (s ?? '').replace(/[\s\-.]/g, '').toUpperCase();
}

/** ISO 13616 kontrol toplamı (mod 97 = 1) ve ülke uzunluğu. */
export function ibanGecerli(s: string | null | undefined): boolean {
  const i = ibanTemizle(s);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(i)) return false;
  const beklenen = IBAN_UZUNLUK[i.slice(0, 2)];
  if (beklenen !== undefined && i.length !== beklenen) return false;
  if (i.startsWith('TR') && !/^TR\d{24}$/.test(i)) return false;
  const yeniden = i.slice(4) + i.slice(0, 4);
  let kalan = 0;
  for (const ch of yeniden) {
    const deger = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const r of deger) kalan = (kalan * 10 + Number(r)) % 97;
  }
  return kalan === 1;
}

/** Okunur yazım: dörtlü gruplar (TR12 3456 ...). */
export function ibanBicimle(s: string | null | undefined): string {
  return ibanTemizle(s).replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Kartla ödeme bağlantısı güvenli mi?
 * Yalnız https; kullanıcı adı/parola içeren adres ve noktasız alan adı yok.
 * `javascript:` gibi bir değer müşteri panelinde tıklanabilir bir tuzak olurdu.
 */
export function odemeLinkiGecerli(s: string | null | undefined): boolean {
  const v = (s ?? '').trim();
  if (!v || v.length > 500) return false;
  let u: URL;
  try { u = new URL(v); } catch { return false; }
  return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.');
}

/** Hesap sahibi adı: görünür, kısa, tek satır. */
export function hesapAdiTemizle(s: string | null | undefined): string | null {
  const v = (s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return v ? v.slice(0, 120) : null;
}

/**
 * Havale açıklaması: müşterinin adı. Bayi hesap hareketinde ilk bunu arar;
 * ayrı bir kod uydurmak onu bir de o kodu aratmaya zorlardı. Banka
 * açıklama alanları kısa olduğu için 60 karakterde kesilir.
 */
export function havaleAciklamasi(musteriAdi: string): string {
  return musteriAdi.replace(/\s{2,}/g, ' ').trim().slice(0, 60);
}

export interface OdemeBilgisi {
  iban: string | null;
  hesapAdi: string | null;
  link: string | null;
  aciklama: string;
}

/**
 * Portalda gösterilecek ödeme kartı. Hiçbir yol tanımlı değilse ya da
 * bayi mali bilgileri kapattıysa null: kart hiç çizilmez.
 *
 * Kayıttaki değer sonradan bozulmuş olabilir (elle veritabanı düzeltmesi,
 * eski sürüm): gösterimde de yeniden doğrulanır, geçersizi gösterilmez.
 */
export function odemeKarti(
  t: { odemeIban: string | null; odemeHesapAdi: string | null; odemeLinki: string | null },
  musteriAdi: string,
  mali: boolean,
): OdemeBilgisi | null {
  if (!mali) return null;
  const iban = ibanGecerli(t.odemeIban) ? ibanBicimle(t.odemeIban) : null;
  const link = odemeLinkiGecerli(t.odemeLinki) ? t.odemeLinki!.trim() : null;
  if (!iban && !link) return null;
  return { iban, hesapAdi: iban ? hesapAdiTemizle(t.odemeHesapAdi) : null, link, aciklama: havaleAciklamasi(musteriAdi) };
}
