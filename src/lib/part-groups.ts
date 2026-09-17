/**
 * Ürün (parça) grupları — TEK KAYNAK.
 *
 * NEDEN: bu liste üç ayrı dosyada kopyalanmıştı ve üçü de farklıydı —
 * "Fırın Grubu" / "FIRIN GURUBU" / bazısında "Diğer" var bazısında yok.
 * Aynı grup üç farklı metin olarak veritabanına yazılınca gruplama,
 * stok raporu ve çapraz-bayi analiz kırılır.
 *
 * ── NEDEN ARTIK KOD YAZIYORUZ ────────────────────────────────────────────
 * Veritabanına eskiden TÜRKÇE AD yazılıyordu ("Fırın Grubu"). Bu iki şeyi
 * aynı anda bozuyordu:
 *
 *   1. ÇEVİRİ — İngilizce arayüzde stok listesi yine "Fırın Grubu" yazıyordu
 *      ve çevrilemiyordu, çünkü ekranda gösterilen şey verinin kendisiydi.
 *   2. VERİNİN DAYANIKLILIĞI — etiketteki tek bir düzeltme ("Kağıt / Sarf"
 *      → "Kâğıt / Sarf") geçmiş kayıtları bambaşka bir gruba düşürürdü.
 *
 * Arıza kategorilerinde (fault-categories.ts) çözüm neyse burada da o:
 * KOD sabittir, ETİKET sözlükten gelir (sz.parcaGrubu[kod]).
 *
 * Eski Türkçe değerler 20260917010000_parca_grubu_kodu göçüyle koda çevrildi;
 * normalizePartGroup eski yazımları yine de tanıyor, çünkü Excel/SQL
 * aktarımından hâlâ Türkçe metin gelebilir.
 */

export const PART_GROUPS = [
  'TONER',
  'INK',        // dolum/kartuş mürekkep — TONER'den ayrı sayılır
  'FUSER',
  'ROLLER',
  'GEAR',
  'DRUM',
  'SPARE',
  'PAPER',
  'LABOUR',
  'REPAIR',
  'OTHER',
] as const;

export type PartGroup = (typeof PART_GROUPS)[number];

/**
 * Göçten önce veritabanında duran ve aktarım dosyalarından gelmeye devam eden
 * TAM yazımlar. Anahtar kelime eşleşmesi aşağıda ayrıca var; tam adlar burada
 * duruyor ki "Diğer" gibi kısa sözcükler yanlış gruba kaymasın.
 */
const ESKI_ADLAR: Record<string, PartGroup> = {
  toner: 'TONER',
  murekkep: 'INK',
  firingrubu: 'FUSER',
  paten: 'ROLLER',
  disligrubu: 'GEAR',
  drum: 'DRUM',
  yedekparca: 'SPARE',
  kagitsarf: 'PAPER',
  iscilik: 'LABOUR',
  tamirat: 'REPAIR',
  diger: 'OTHER',
};

const fold = (s: unknown): string =>
  String(s ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');

/**
 * Gelen değeri kanonik KODA eşler.
 * Kodun kendisini ('TONER'), eski Türkçe adı ('FIRIN GURUBU') ve yaygın
 * varyantları kabul eder. Tanınmayan değer için null — uydurma grup yazılmaz.
 */
export function normalizePartGroup(value: unknown): PartGroup | null {
  const ham = String(value ?? '').trim().toUpperCase();
  if ((PART_GROUPS as readonly string[]).includes(ham)) return ham as PartGroup;

  const f = fold(value);
  if (!f) return null;
  if (ESKI_ADLAR[f]) return ESKI_ADLAR[f];

  // yaygın varyantlar
  if (f.includes('firin') || f.includes('fuser')) return 'FUSER';
  if (f.includes('disli') || f.includes('gear')) return 'GEAR';
  if (f.includes('paten') || f.includes('roller')) return 'ROLLER';
  if (f.includes('murekkep') || f.includes('ink')) return 'INK';
  if (f.includes('toner')) return 'TONER';
  if (f.includes('drum')) return 'DRUM';
  if (f.includes('iscilik') || f.includes('labour') || f.includes('labor')) return 'LABOUR';
  if (f.includes('tamirat') || f.includes('repair')) return 'REPAIR';
  if (f.includes('yedekparca') || f.includes('spare')) return 'SPARE';
  if (f.includes('kagit') || f.includes('sarf') || f.includes('paper')) return 'PAPER';
  if (f.includes('diger') || f.includes('other')) return 'OTHER';
  return null;
}

/**
 * Parça ADINDAN grubu tahmin eder — grup boş bırakıldığında kullanılır.
 * Örn. "C-5790 MODÜLLÜ MÜREKKEP SARI DOLUM" -> 'INK'.
 *
 * DÜRÜSTLÜK: yalnızca kullanıcının kendi yazdığı metinde açık geçen anahtar
 * kelimeye bakar. Emin olunamıyorsa null döner ve grup BOŞ kalır — uydurma yok.
 */
export function guessPartGroup(name: unknown): PartGroup | null {
  const f = fold(name);
  if (!f) return null;
  // Sıra önemli: "toner dolum" toner, "murekkep dolum" mürekkeptir
  if (f.includes('murekkep') || f.includes('ink')) return 'INK';
  if (f.includes('toner') || f.includes('kartus')) return 'TONER';
  if (f.includes('firin') || f.includes('fuser')) return 'FUSER';
  if (f.includes('drum') || f.includes('tambur')) return 'DRUM';
  if (f.includes('paten') || f.includes('roller') || f.includes('pickup')) return 'ROLLER';
  if (f.includes('disli')) return 'GEAR';
  if (f.includes('iscilik')) return 'LABOUR';
  if (f.includes('kagit')) return 'PAPER';
  return null;
}
