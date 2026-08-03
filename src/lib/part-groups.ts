/**
 * Ürün (parça) grupları — TEK KAYNAK.
 *
 * NEDEN: bu liste üç ayrı dosyada kopyalanmıştı ve üçü de farklıydı —
 * "Fırın Grubu" / "FIRIN GURUBU" / bazısında "Diğer" var bazısında yok.
 * Aynı grup üç farklı metin olarak veritabanına yazılınca gruplama,
 * stok raporu ve çapraz-bayi analiz kırılır. Arıza kategorilerinde
 * yaptığımızın aynısı: kod tek yerde durur, ekranlar buradan okur.
 */

export const PART_GROUPS = [
  'Toner',
  'Mürekkep',        // dolum/kartuş mürekkep — TONER'den ayrı sayılır
  'Fırın Grubu',
  'Paten',
  'Dişli Grubu',
  'Drum',
  'Yedek Parça',
  'Kağıt / Sarf',
  'İşçilik',
  'Tamirat',
  'Diğer',
] as const;

export type PartGroup = (typeof PART_GROUPS)[number];

const fold = (s: unknown): string =>
  String(s ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');

/** Eski/serbest yazımları kanonik gruba eşler ("FIRIN GURUBU" -> "Fırın Grubu"). */
export function normalizePartGroup(value: unknown): PartGroup | null {
  const f = fold(value);
  if (!f) return null;
  for (const g of PART_GROUPS) if (fold(g) === f) return g;
  // yaygın varyantlar
  if (f.includes('firin') || f.includes('fuser')) return 'Fırın Grubu';
  if (f.includes('disli') || f.includes('gear')) return 'Dişli Grubu';
  if (f.includes('paten') || f.includes('roller')) return 'Paten';
  if (f.includes('murekkep') || f.includes('ink')) return 'Mürekkep';
  if (f.includes('toner')) return 'Toner';
  if (f.includes('drum')) return 'Drum';
  if (f.includes('iscilik')) return 'İşçilik';
  if (f.includes('tamirat')) return 'Tamirat';
  if (f.includes('yedekparca')) return 'Yedek Parça';
  if (f.includes('kagit') || f.includes('sarf')) return 'Kağıt / Sarf';
  if (f.includes('diger')) return 'Diğer';
  return null;
}

/**
 * Parça ADINDAN grubu tahmin eder — grup boş bırakıldığında kullanılır.
 * Örn. "C-5790 MODÜLLÜ MÜREKKEP SARI DOLUM" -> "Mürekkep".
 *
 * DÜRÜSTLÜK: yalnızca kullanıcının kendi yazdığı metinde açık geçen anahtar
 * kelimeye bakar. Emin olunamıyorsa null döner ve grup BOŞ kalır — uydurma yok.
 */
export function guessPartGroup(name: unknown): PartGroup | null {
  const f = fold(name);
  if (!f) return null;
  // Sıra önemli: "toner dolum" toner, "murekkep dolum" mürekkeptir
  if (f.includes('murekkep') || f.includes('ink')) return 'Mürekkep';
  if (f.includes('toner') || f.includes('kartus')) return 'Toner';
  if (f.includes('firin') || f.includes('fuser')) return 'Fırın Grubu';
  if (f.includes('drum') || f.includes('tambur')) return 'Drum';
  if (f.includes('paten') || f.includes('roller') || f.includes('pickup')) return 'Paten';
  if (f.includes('disli')) return 'Dişli Grubu';
  if (f.includes('iscilik')) return 'İşçilik';
  if (f.includes('kagit')) return 'Kağıt / Sarf';
  return null;
}
