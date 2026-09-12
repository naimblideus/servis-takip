/**
 * CSV ÜRETİMİ — Türkçe Excel'de düzgün açılan tek biçim.
 *
 * ── NEDEN KÜTÜPHANE ──────────────────────────────────────────────────────
 * Depoda zaten CSV üreten yerler vardı ama her biri kendi satırını elle
 * birleştiriyordu ve HİÇBİRİ ALAN KAÇIRMA yapmıyordu. Müşteri adında bir
 * noktalı virgül olması yeter — "ABC Ltd; Şti" — o satırın bütün sütunları
 * bir sağa kayar ve bayi Excel'de yanlış müşteriye yazılmış bir tutar görür.
 * Sessiz ve fark edilmesi zor; tabloyu açan kimse hatayı anlamaz.
 *
 * ── TÜRKÇE EXCEL'İN ÜÇ ŞARTI ─────────────────────────────────────────────
 *   1. AYIRAÇ NOKTALI VİRGÜL. Türkçe Windows'ta ondalık ayıracı virgül
 *      olduğu için Excel, virgülle ayrılmış dosyayı tek sütuna yapıştırır.
 *   2. UTF-8 BOM. Olmazsa ş/ğ/İ bozuk görünür (Ä± gibi).
 *   3. ONDALIK VİRGÜL. "1234.56" Excel'de metin sayılır, toplanamaz;
 *      "1234,56" sayı olur.
 * Satır sonu CRLF — Excel'in beklediği.
 */

/** Alanı gerektiğinde tırnağa al, içindeki tırnağı ikile. */
function alan(deger: unknown): string {
  if (deger === null || deger === undefined) return '';
  const s = String(deger);
  // Tırnak gerektiren durumlar: ayıraç, tırnak, satır sonu, baştaki/sondaki boşluk.
  if (/[;"\r\n]/.test(s) || s !== s.trim()) {
    return `"${s.split('"').join('""')}"`;
  }
  return s;
}

/**
 * Sayıyı Türkçe Excel'in SAYI olarak okuyacağı biçime çevirir.
 * Binlik ayıracı KOYULMUYOR: "1.234,56" yazarsak Excel bunu yine metin
 * sayabiliyor. Ham "1234,56" hem doğru hem toplanabilir.
 */
export function csvSayi(n: number | null | undefined, basamak = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toFixed(basamak).replace('.', ',');
}

/** Tarihi gg.aa.yyyy yazar — Excel Türkçe yerelde tarih olarak tanır. */
export function csvTarih(d: Date | string | null | undefined): string {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  const iki = (n: number) => String(n).padStart(2, '0');
  return `${iki(t.getDate())}.${iki(t.getMonth() + 1)}.${t.getFullYear()}`;
}

/**
 * Başlık + satırlardan CSV metni üretir (BOM dahil).
 *
 * @param basliklar Sütun başlıkları.
 * @param satirlar  Her biri başlıklarla aynı uzunlukta olmalı — uzunluk
 *                  tutmuyorsa sessizce kaymasın diye hata veriyoruz.
 */
export function csvMetni(basliklar: string[], satirlar: unknown[][]): string {
  const BOM = '﻿';
  for (const s of satirlar) {
    if (s.length !== basliklar.length) {
      throw new Error(`CSV satır uzunluğu başlıkla uyuşmuyor (${s.length} ≠ ${basliklar.length})`);
    }
  }
  const hepsi = [basliklar, ...satirlar].map((satir) => satir.map(alan).join(';'));
  return BOM + hepsi.join('\r\n') + '\r\n';
}

/** Dosya adında sorun çıkaracak karakterleri temizler. */
export function csvDosyaAdi(...parcalar: (string | null | undefined)[]): string {
  const temiz = parcalar
    .filter(Boolean)
    .join('-')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ /g, '_');
  return `${temiz || 'rapor'}.csv`;
}

/** CSV indirme başlıkları — çağıran yalnız gövdeyi verir. */
export function csvBasliklari(dosyaAdi: string): Record<string, string> {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    // filename* ile UTF-8 ad: Türkçe karakterli bayi adı bozulmasın.
    'Content-Disposition': `attachment; filename="${dosyaAdi.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
    'Cache-Control': 'no-store',
  };
}
