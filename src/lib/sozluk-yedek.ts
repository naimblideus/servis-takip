/**
 * Sözlüğe HENÜZ eklenmemiş bir anahtarı güvenle oku: anahtar varsa onun
 * metni, yoksa verilen yedek (mevcut bir anahtarın metni) döner.
 *
 * NEDEN: tr.ts/en.ts aynı anda başka bir değişiklikte düzenleniyor. Yeni
 * metin isteyen ekran, anahtar eklenene kadar ÇALIŞIR kalmalı (Türkçe gömülü
 * metin yok, derleme hatası yok); anahtar eklendiği an kendiliğinden onu
 * kullanır. Anahtar eklendikten sonra çağrı doğrudan `t.bolum.anahtar`
 * erişimine çevrilebilir.
 */
export function yedekli(bolum: object, anahtar: string, yedek: string): string {
  const v = (bolum as Record<string, unknown>)[anahtar];
  return typeof v === 'string' && v.trim() !== '' ? v : yedek;
}
