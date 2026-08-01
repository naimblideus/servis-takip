/**
 * Cihaz marka/model normalleştirme — tek kaynak.
 *
 * NEDEN VAR: içe aktarılan Excel'lerde "Marka" ve "Model" sütunları sık sık ters
 * doldurulmuş oluyor (marka alanına "M501DN", model alanına "HP"). Tek bir bayide
 * bile 1.104 cihazın %97'si böyleydi. Bu, markaya göre gruplamayı imkânsız kılar —
 * yani cihaz verisinin en değerli boyutunu yok eder.
 *
 * Bu yüzden düzeltme TEK yerde yapılır ve TÜM giriş noktalarında (içe aktarma,
 * cihaz ekleme, cihaz düzenleme) çağrılır; böylece hata bir daha birikmez.
 *
 * DÜRÜSTLÜK KURALI: yalnızca güvenle tanınan marka varsa düzeltilir.
 * Tanınmıyorsa DOKUNULMAZ — tahmin yazmak, veriyi sessizce bozmaktan farksızdır.
 */

/** TR pazarında görülen yazıcı/fotokopi markaları. Yeni marka çıkarsa buraya eklenir. */
export const KNOWN_BRANDS = [
  'canon', 'hp', 'hewlett packard', 'hewlett-packard', 'konica', 'konica minolta', 'minolta',
  'pantum', 'ninestar', 'xerox', 'lexmark', 'brother', 'samsung', 'epson', 'kyocera',
  'ricoh', 'sharp', 'oki', 'toshiba', 'develop', 'olivetti', 'triumph adler', 'utax',
  'panasonic', 'dell', 'kodak', 'riso', 'duplo', 'nashuatec', 'gestetner', 'infotec',
];

/** Ekranda gösterilecek düzgün yazım. */
const DISPLAY: Record<string, string> = {
  hp: 'HP', 'hewlettpackard': 'HP',
  canon: 'Canon', konica: 'Konica Minolta', konicaminolta: 'Konica Minolta', minolta: 'Konica Minolta',
  pantum: 'Pantum', ninestar: 'Ninestar', xerox: 'Xerox', lexmark: 'Lexmark',
  brother: 'Brother', samsung: 'Samsung', epson: 'Epson', kyocera: 'Kyocera',
  ricoh: 'Ricoh', sharp: 'Sharp', oki: 'OKI', toshiba: 'Toshiba', develop: 'Develop',
  olivetti: 'Olivetti', triumphadler: 'Triumph Adler', utax: 'UTAX', panasonic: 'Panasonic',
  dell: 'Dell', kodak: 'Kodak', riso: 'Riso', duplo: 'Duplo',
  nashuatec: 'Nashuatec', gestetner: 'Gestetner', infotec: 'Infotec',
};

const fold = (s: unknown): string =>
  String(s ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');

/** Metin bilinen bir markayı gösteriyor mu? Gösteriyorsa kanonik anahtarı döner. */
export function brandKey(value: unknown): string | null {
  const f = fold(value);
  if (!f) return null;
  // Tam eşleşme önce (kısa markalar yanlış eşleşmesin: "hp" ile "hpx" karışmasın)
  for (const b of KNOWN_BRANDS) {
    if (f === fold(b)) return fold(b);
  }
  // Baştan eşleşme ("canonir2520" gibi birleşik yazımlar)
  for (const b of KNOWN_BRANDS) {
    const fb = fold(b);
    if (fb.length >= 4 && f.startsWith(fb)) return fb;
  }
  return null;
}

export function isKnownBrand(value: unknown): boolean {
  return brandKey(value) !== null;
}

/** Kanonik gösterim ("HP", "Konica Minolta"). Bilinmiyorsa girdiyi olduğu gibi döner. */
export function displayBrand(value: unknown): string {
  const k = brandKey(value);
  if (!k) return String(value ?? '').trim();
  return DISPLAY[k] ?? String(value ?? '').trim();
}

/**
 * Serbest metnin İÇİNDE geçen bilinen markayı bulur.
 * Örn. "Canon FM1-A606 fırın ünitesi" -> "Canon".
 *
 * Parça kayıtlarında marka alanını otomatik doldurmak için kullanılır.
 * UYDURMA YOK: yalnızca kullanıcının kendi yazdığı metinde geçen marka alınır;
 * geçmiyorsa null döner ve alan boş kalır.
 */
export function detectBrandInText(text: unknown): string | null {
  const raw = String(text ?? '');
  if (!raw.trim()) return null;
  // Kelime kelime bak: "hp" gibi kısa markalar rastgele hece eşleşmesin
  const kelimeler = raw.split(/[^A-Za-zÇĞİÖŞÜçğıöşü0-9]+/).filter(Boolean);
  for (const k of kelimeler) {
    const key = brandKey(k);
    if (key) return DISPLAY[key] ?? k;
  }
  // İki kelimelik markalar ("konica minolta", "hewlett packard")
  for (let i = 0; i < kelimeler.length - 1; i++) {
    const key = brandKey(kelimeler[i] + kelimeler[i + 1]);
    if (key) return DISPLAY[key] ?? `${kelimeler[i]} ${kelimeler[i + 1]}`;
  }
  return null;
}

export interface NormalizedDevice {
  brand: string;
  model: string;
  /** Alanlar ters kaydedilmişti ve düzeltildi */
  swapped: boolean;
  /** Marka bilinen listede — güvenle gruplanabilir */
  recognized: boolean;
}

/**
 * Marka/model çiftini düzeltir.
 *  - marka tanınıyorsa: yazımı kanonikleştir
 *  - marka tanınmıyor AMA model tanınıyorsa: TERS kaydedilmiş → yer değiştir
 *  - ikisi de tanınmıyorsa: DOKUNMA (yerel/bilinmeyen marka olabilir)
 */
export function normalizeBrandModel(brandIn: unknown, modelIn: unknown): NormalizedDevice {
  const brand = String(brandIn ?? '').trim();
  const model = String(modelIn ?? '').trim();

  const bIsBrand = isKnownBrand(brand);
  const mIsBrand = isKnownBrand(model);

  if (bIsBrand) {
    return { brand: displayBrand(brand), model, swapped: false, recognized: true };
  }
  if (mIsBrand) {
    // Ters kaydedilmiş: model alanındaki marka, marka alanındaki model kodu
    return { brand: displayBrand(model), model: brand, swapped: true, recognized: true };
  }
  return { brand, model, swapped: false, recognized: false };
}
