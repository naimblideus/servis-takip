/**
 * BİÇİMLENDİRME — para, sayı, tarih; dil ve para birimine göre.
 *
 * ── NİYE VAR ─────────────────────────────────────────────────────────────
 * Ölçüldü: depoda 259 yerde sabit "₺", 254 yerde sabit 'tr-TR'. Avrupalı bir
 * bayi bunu görünce ürün kendisine yazılmamış hisseder — ve haklıdır.
 * Biçimlendirme tek yerde toplanıyor; ekranlar dili ve para birimini
 * bağlamdan alıyor, kendileri karar vermiyor.
 *
 * ── NEDEN en-GB, en-US DEĞİL ─────────────────────────────────────────────
 * Hedef pazar Avrupa. en-GB tarihi gün/ay/yıl ve saati 24 saat yazar;
 * en-US ay/gün/yıl ve 12 saat yazardı. Almanya'daki bir bayiye 09/16/2026
 * göstermek, Türkçe göstermekten daha az anlaşılır.
 *
 * Bu dosya SAFtır: React yok, Next yok. Testte doğrudan çalışır.
 */
import type { Dil } from './i18n/sozluk';

export const PARA_BIRIMLERI = ['TRY', 'EUR', 'USD', 'GBP'] as const;
export type ParaBirimi = (typeof PARA_BIRIMLERI)[number];
export const VARSAYILAN_BIRIM: ParaBirimi = 'TRY';

export function paraBirimiMi(x: unknown): x is ParaBirimi {
  return typeof x === 'string' && (PARA_BIRIMLERI as readonly string[]).includes(x);
}

/** Dil → Intl yerel ayarı. Bilinçli olarak burada, sözlükten bağımsız. */
export const INTL_LOCALE: Record<Dil, string> = { tr: 'tr-TR', en: 'en-GB' };

const yerel = (dil: Dil) => INTL_LOCALE[dil] ?? INTL_LOCALE.tr;

/** Sayı olmayan girdi "—" döner; ekranda "NaN ₺" görünmesin. */
const sayiMi = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export interface ParaSecenek {
  dil: Dil;
  birim?: ParaBirimi | string | null;
  /** Kesir basamağı; varsayılan 2. Sayfa maliyeti gibi küçük tutarlarda 4. */
  kesir?: number;
}

/** Para: ₺1.234,56 / €1,234.56. Birim bilinmiyorsa TRY. */
export function para(n: number | string | null | undefined, s: ParaSecenek): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (!sayiMi(v)) return '—';
  const birim = paraBirimiMi(s.birim) ? s.birim : VARSAYILAN_BIRIM;
  const kesir = s.kesir ?? 2;
  // narrowSymbol: en-GB, TRY için sembol değil "TRY" kodu yazıyor ve dar
  // kartta "TRY 119,676.5" diye kırpılıyordu (ölçüldü). Dar sembol her
  // dilde ₺ / € / £ / $ verir — kısa ve tek bakışta okunur.
  return new Intl.NumberFormat(yerel(s.dil), {
    style: 'currency', currency: birim, currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: kesir, maximumFractionDigits: kesir,
  }).format(v);
}

/**
 * Para biriminin ALT birimi: kuruş / cent / penny.
 *
 * Sayfa maliyeti liranın binde biri mertebesinde bir sayı ve "₺0,0779" ile
 * "₺0,3148" arasındaki farkı gözle yakalamak zor. Bayi de zaten alt birimle
 * konuşuyor ("sayfası 8 kuruşa geliyor"). Tutar 100'le çarpılıp o birimin
 * kısaltmasıyla yazılıyor; Türkçedeki "kr" böylece kaybolmuyor.
 */
export const ALT_BIRIM: Record<ParaBirimi, string> = { TRY: 'kr', EUR: 'c', USD: '¢', GBP: 'p' };

/** 0,0779 ₺ → "7,79 kr" · 0.0779 € → "7.79 c" */
export function altBirim(n: number | string | null | undefined, s: { dil: Dil; birim?: ParaBirimi | string | null }): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (!sayiMi(v)) return '—';
  const birim = paraBirimiMi(s.birim) ? s.birim : VARSAYILAN_BIRIM;
  return `${sayi(v * 100, s.dil, 2)} ${ALT_BIRIM[birim]}`;
}

/** Sayı: 1.234 / 1,234. Kesir verilirse sabit basamak. */
export function sayi(n: number | string | null | undefined, dil: Dil, kesir?: number): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (!sayiMi(v)) return '—';
  return new Intl.NumberFormat(yerel(dil), kesir === undefined
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: kesir, maximumFractionDigits: kesir }).format(v);
}

/** Yüzde: girdi 0-100 ölçeğinde. %12 (tr) / 12% (en). */
export function yuzde(n: number | null | undefined, dil: Dil, kesir = 0): string {
  if (!sayiMi(n)) return '—';
  return new Intl.NumberFormat(yerel(dil), {
    style: 'percent', minimumFractionDigits: kesir, maximumFractionDigits: kesir,
  }).format(n / 100);
}

const tarihe = (d: Date | string | number | null | undefined): Date | null => {
  if (d === null || d === undefined) return null;
  const t = d instanceof Date ? d : new Date(d);
  return Number.isNaN(t.getTime()) ? null : t;
};

/** 16.09.2026 (tr) / 16/09/2026 (en). */
export function tarih(d: Date | string | number | null | undefined, dil: Dil): string {
  const t = tarihe(d);
  if (!t) return '—';
  return new Intl.DateTimeFormat(yerel(dil), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(t);
}

/** 16.09.2026 14:05 (tr) / 16/09/2026, 14:05 (en). */
export function tarihSaat(d: Date | string | number | null | undefined, dil: Dil): string {
  const t = tarihe(d);
  if (!t) return '—';
  return new Intl.DateTimeFormat(yerel(dil), {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(t);
}

/**
 * 16.09 (tr) / 16/09 (en) — listelerde yıl gereksiz yer kaplar.
 *
 * Intl'e yalnız gün+ay verilince tr-TR ayracı "/" yapıyor ("16/09"), oysa
 * tam tarihte "." kullanıyor ("16.09.2026"). Aynı ekranda iki ayrı ayraç
 * görünmesin diye kısa tarih TAM tarihten türetiliyor: yıl kırpılıyor, ayraç
 * ne ise o kalıyor. Test bunu yakaladı; uydurma değil, ölçülmüş tuhaflık.
 */
export function kisaTarih(d: Date | string | number | null | undefined, dil: Dil): string {
  const tam = tarih(d, dil);
  return tam === '—' ? tam : tam.replace(/[./-]\d{4}$/, '');
}

/** Eylül 2026 / September 2026 — dönem başlıklarında. */
export function ayYil(d: Date | string | number | null | undefined, dil: Dil): string {
  const t = tarihe(d);
  if (!t) return '—';
  return new Intl.DateTimeFormat(yerel(dil), { month: 'long', year: 'numeric' }).format(t);
}

/**
 * Para birimi simgesi: ₺ / € / £ / $.
 *
 * Alan etiketlerinde ("Toplam Tutar (₺)") sabit ₺ yazmak yerine buradan
 * geliyor. ISO kodunu ("TRY") göstermek teknik ve soğuk; simge her dilde
 * tanıdık. Simge bulunamazsa kodun kendisi döner.
 */
export function birimSimgesi(dil: Dil, birim?: ParaBirimi | string | null): string {
  const b = paraBirimiMi(birim) ? birim : VARSAYILAN_BIRIM;
  const parcalar = new Intl.NumberFormat(yerel(dil), {
    style: 'currency', currency: b, currencyDisplay: 'narrowSymbol',
  }).formatToParts(0);
  return parcalar.find((p) => p.type === 'currency')?.value ?? b;
}

/**
 * DİLE VE BİRİME BAĞLI biçimlendirici demeti.
 *
 * Ekranlar `b.para(x)` yazar; dil ve para birimi zaten bağlanmıştır. İstemci
 * tarafında `useBicim()`, sunucu tarafında `sunucuBicimi()` bunu döndürür —
 * ikisi de AYNI işlevi kullanır, yoksa iki tarafta iki ayrı biçim oluşurdu.
 */
export interface Bicimleyici {
  para(n: number | string | null | undefined, kesir?: number): string;
  /** Kuruş/cent — sayfa maliyeti gibi çok küçük tutarlar. */
  altBirim(n: number | string | null | undefined): string;
  sayi(n: number | string | null | undefined, kesir?: number): string;
  yuzde(n: number | null | undefined, kesir?: number): string;
  tarih(d: Date | string | number | null | undefined): string;
  tarihSaat(d: Date | string | number | null | undefined): string;
  kisaTarih(d: Date | string | number | null | undefined): string;
  ayYil(d: Date | string | number | null | undefined): string;
  dil: Dil;
  birim: ParaBirimi;
  /** Alan etiketlerinde kullanılan para simgesi. */
  simge: string;
}

export function bicimYap(dil: Dil, birim?: ParaBirimi | string | null): Bicimleyici {
  const b = paraBirimiMi(birim) ? birim : VARSAYILAN_BIRIM;
  return {
    para: (n, kesir) => para(n, { dil, birim: b, kesir }),
    altBirim: (n) => altBirim(n, { dil, birim: b }),
    sayi: (n, kesir) => sayi(n, dil, kesir),
    yuzde: (n, kesir) => yuzde(n, dil, kesir),
    tarih: (d) => tarih(d, dil),
    tarihSaat: (d) => tarihSaat(d, dil),
    kisaTarih: (d) => kisaTarih(d, dil),
    ayYil: (d) => ayYil(d, dil),
    dil, birim: b, simge: birimSimgesi(dil, b),
  };
}
