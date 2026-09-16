/**
 * TOPLU HATIRLATMA ŞABLONU — değişken doldurma.
 *
 * Bayi kutuya "Sayın {ad}, {borç} borcunuz var" yazar; burası değişkenleri
 * gerçek değerlerle değiştirir.
 *
 * ── NİYE ORTAK DOSYA ──────────────────────────────────────────────────────
 * Aynı şablon İKİ yerde işleniyor: ekranda önizleme/tek tek WhatsApp
 * (istemci) ve toplu SMS (sunucu). İki ayrı `replace` zinciri vardı; biri
 * güncellenip diğeri unutulursa bayi önizlemede doğru, müşteri telefonunda
 * yanlış metin görürdü.
 *
 * ── NİYE İKİ DİLDE DEĞİŞKEN ADI ───────────────────────────────────────────
 * Arayüz İngilizceyken bayiye `{borç}` yazdırmak, ürünün çevrilmediğini
 * söyler. İkisi de kabul ediliyor: eski Türkçe şablonlar çalışmaya devam
 * eder, yeni İngilizce şablonlar da çalışır.
 */

export interface SablonDegerleri {
  ad: string;
  /** Biçimlendirilmiş borç — para birimi çağıran tarafta uygulanır. */
  borc: string;
  telefon: string;
}

/** Ekranda "kullanabileceğin değişkenler" satırında gösterilenler. */
export const SABLON_DEGISKENLERI: Record<string, string[]> = {
  tr: ['{ad}', '{borç}', '{telefon}'],
  en: ['{name}', '{debt}', '{phone}'],
};

export function sablonDoldur(sablon: string, d: SablonDegerleri): string {
  return String(sablon ?? '')
    .replace(/\{ad\}|\{name\}/g, d.ad ?? '')
    // `{borc}` de kabul ediliyor: bayi Türkçe klavyesi olmayan bir makinede
    // yazdığında ç'siz yazması çok olası ve sessizce boş metin gitmesin.
    .replace(/\{borç\}|\{borc\}|\{debt\}/g, d.borc ?? '')
    .replace(/\{telefon\}|\{phone\}/g, d.telefon ?? '');
}
