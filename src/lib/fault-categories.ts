/**
 * Arıza kategorileri — tek kaynak.
 *
 * KOD sabittir (veritabanına yazılan şey), ETİKET değişebilir (ekranda görünen şey).
 * Türkçe metni doğrudan veriye yazmak yerine kod tutuyoruz; böylece:
 *  - etiket düzeltilse bile geçmiş veri bozulmaz,
 *  - yüzlerce bayide aynı kod aynı şeyi ifade eder (çapraz-bayi analizin ön şartı).
 */
import type { FaultCategory } from '@prisma/client';

export const FAULT_CATEGORIES: { code: FaultCategory; label: string; isFailure: boolean }[] = [
  { code: 'PAPER_JAM',            label: 'Kağıt Sıkışması',  isFailure: true },
  { code: 'TONER',                label: 'Toner Sorunu',     isFailure: true },
  { code: 'PRINT_QUALITY',        label: 'Baskı Kalitesi',   isFailure: true },
  { code: 'FEED_ERROR',           label: 'Besleme Hatası',   isFailure: true },
  { code: 'NETWORK',              label: 'Ağ Bağlantısı',    isFailure: true },
  { code: 'FUSER',                label: 'Fırın Arızası',    isFailure: true },
  { code: 'DRUM',                 label: 'Drum Sorunu',      isFailure: true },
  { code: 'ELECTRONIC',           label: 'Elektronik Sorun', isFailure: true },
  { code: 'GEAR',                 label: 'Dişli Arızası',    isFailure: true },
  { code: 'ROLLER',               label: 'Paten Sorunu',     isFailure: true },
  { code: 'PRINTHEAD',            label: 'Kafa Arızası',     isFailure: true },
  // Aşağıdakiler arıza DEĞİLDİR. Ayrı tutulmazsa arıza oranı yapay olarak şişer
  // ve marka/model güvenilirlik karşılaştırması anlamsızlaşır.
  { code: 'PERIODIC_MAINTENANCE', label: 'Periyodik Bakım',  isFailure: false },
  { code: 'INSTALLATION',         label: 'Kurulum',          isFailure: false },
  { code: 'OTHER',                label: 'Diğer',            isFailure: true },
];

/**
 * Fiş kapanırken tek dokunuşla seçilen sık kategoriler; kalanlar "Tümü" altında.
 * Sıra sahadaki gerçek sıklığa göre: kağıt sıkışması ve toner her bayide ilk ikilidir.
 * Amaç, teknisyenin %80 durumda TEK dokunuşla geçmesi — liste uzarsa kimse doldurmaz.
 */
export const QUICK_FAULT_CODES: FaultCategory[] = [
  'PAPER_JAM', 'TONER', 'PRINT_QUALITY', 'FEED_ERROR', 'FUSER', 'DRUM', 'PERIODIC_MAINTENANCE',
];

const BY_CODE = new Map(FAULT_CATEGORIES.map((c) => [c.code, c]));

/**
 * Ekranda gösterilecek Türkçe etiket. Bilinmeyen/eski kayıt için '—'.
 * Geniş `string` kabul eder: API'den/forma bağlı state'ten gelen ham değerler
 * her zaman dar enum tipinde olmaz.
 */
export function faultLabel(code?: FaultCategory | string | null): string {
  if (!code) return '—';
  return BY_CODE.get(code as FaultCategory)?.label ?? String(code);
}

/** Gerçek arıza mı, yoksa planlı ziyaret mi (bakım/kurulum). */
export function isFailure(code?: FaultCategory | string | null): boolean {
  if (!code) return false;
  return BY_CODE.get(code as FaultCategory)?.isFailure ?? false;
}

/** API'den gelen değeri doğrula — geçersizse null (uydurma kategori yazılmaz). */
export function parseFaultCategory(value: unknown): FaultCategory | null {
  if (typeof value !== 'string') return null;
  return BY_CODE.has(value as FaultCategory) ? (value as FaultCategory) : null;
}

/**
 * Türkçe-duyarlı katlama: "firin" yazınca "Fırın" bulunsun diye.
 * Teknisyen sahada hızlı yazar, şapkalı/noktalı harfle uğraşmaz.
 */
export function foldTr(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .trim();
}

/** Kategorileri yazılan metne göre süz. Boş sorgu = hepsi (14 tane, liste kısa). */
export function searchFaultCategories(query: string) {
  const q = foldTr(query);
  if (!q) return FAULT_CATEGORIES;
  const hits = FAULT_CATEGORIES.filter((c) => foldTr(c.label).includes(q) || foldTr(c.code).includes(q));
  // Baştan eşleşenler önce ("ton" → "Toner Sorunu" en üstte)
  return hits.sort((a, b) => {
    const aStarts = foldTr(a.label).startsWith(q) ? 0 : 1;
    const bStarts = foldTr(b.label).startsWith(q) ? 0 : 1;
    return aStarts - bStarts;
  });
}

/** Eski serbest metin şablonlarını koda eşler (geriye dönük uyum + içe aktarım). */
export function faultCategoryFromLegacyText(text?: string | null): FaultCategory | null {
  if (!text) return null;
  const t = text.toLocaleLowerCase('tr');
  const has = (...xs: string[]) => xs.some((x) => t.includes(x));
  if (has('sıkış', 'sikis')) return 'PAPER_JAM';
  if (has('toner')) return 'TONER';
  if (has('kalite')) return 'PRINT_QUALITY';
  if (has('besleme')) return 'FEED_ERROR';
  if (has('ağ', 'network')) return 'NETWORK';
  if (has('fırın', 'firin')) return 'FUSER';
  if (has('drum')) return 'DRUM';
  if (has('elektronik')) return 'ELECTRONIC';
  if (has('dişli', 'disli')) return 'GEAR';
  if (has('paten')) return 'ROLLER';
  if (has('kafa')) return 'PRINTHEAD';
  if (has('bakım', 'bakim')) return 'PERIODIC_MAINTENANCE';
  if (has('kurulum')) return 'INSTALLATION';
  if (has('diğer', 'diger')) return 'OTHER';
  return null;
}
