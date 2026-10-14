// İÇE AKTARMA ŞABLONU — "Excel'den kendiniz aktarın" için örnek dosya.
//
// NEDEN
// Bayi boş ekranda "hangi kolonlar olmalı?" diye takılıyordu. Şablon bunun
// cevabı; ama asıl işi şu: başlıklar otomatik eşleyicinin (sheet-import.ts
// → autoMap) TANIDIĞI yazımlar. Bayi şablonu doldurup geri yüklediğinde hiçbir
// kolonu elle eşlemek zorunda kalmaz. scripts/test-kira-eslesme.mjs her
// başlığın doğru alana düştüğünü ölçüyor — buradaki bir başlığı değiştiren,
// testi de koşturmalı.
//
// Örnek satır gerçek bir Pantum (çoğu Pantum siyah-beyaz): renkli sayaç 0,
// renkli fiyat boş. Sayılar Türk biçiminde (ondalık virgül), çünkü dosya
// Türk Excel'inde açılıp kaydedilecek.

export type SablonDili = 'tr' | 'en';

export const SABLON: Record<SablonDili, string[][]> = {
  tr: [
    ['Müşteri Adı', 'Telefon', 'Adres', 'Marka', 'Model', 'Seri No', 'Konum', 'S/B Sayaç', 'Renkli Sayaç', 'Kiralık mı', 'Aylık Kira', 'S/B Sayfa Fiyatı', 'Renkli Sayfa Fiyatı'],
    ['Örnek Kırtasiye Ltd. Şti.', '0555 111 22 33', 'Atatürk Cad. No:1 Şişli/İstanbul', 'Pantum', 'M7100DW', 'CN0000000001', '2. Kat Muhasebe', '36010', '0', 'Evet', '1500', '0,45', ''],
  ],
  en: [
    ['Customer Name', 'Phone', 'Address', 'Brand', 'Model', 'Serial No', 'Location', 'Black Counter', 'Color Counter', 'Rental', 'Monthly Rent', 'Black Page Price', 'Color Page Price'],
    ['Sample Office Supplies Ltd.', '0555 111 22 33', '1 Main Street', 'Pantum', 'M7100DW', 'CN0000000001', '2nd Floor Accounting', '36010', '0', 'Yes', '1500', '0.45', ''],
  ],
};

/**
 * Excel'in Türkçe karakterleri doğru açması için BOM + CRLF. Ayraç dile göre:
 * Türk Excel'i noktalı virgül bekler (virgül ondalık ayracı), İngilizce Excel
 * virgül — yanlış ayraçta bütün satır tek hücreye dolar. İçe aktarma ayracı
 * kendisi tespit ediyor, ikisini de okur.
 */
export function sablonCsv(dil: SablonDili): string {
  const ayrac = dil === 'en' ? ',' : ';';
  const alan = (v: string) => (v.includes(ayrac) || /["\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return '﻿' + SABLON[dil].map((s) => s.map(alan).join(ayrac)).join('\r\n') + '\r\n';
}
