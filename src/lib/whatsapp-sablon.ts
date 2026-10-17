/**
 * WHATSAPP ŞABLONLARI — Meta'ya onaya gönderilen metin ve değişken sırası TEK YERDE.
 *
 * Müşteri son 24 saatte yazmadıysa mesaj ancak Meta ONAYLI şablonla gider.
 * Şablondaki {{n}} sayısıyla gönderilen değişken sayısı uyuşmazsa Meta mesajı
 * reddeder (#132000). Eskiden borç hatırlatması iki yerden iki ayrı biçimde
 * gidiyordu: günlük iş [ad, tutar, MÜŞTERİNİN KENDİ TELEFONU], bayinin toplu
 * gönderimi [ad, bakiye] — aynı şablonla. Biri her zaman reddedilirdi.
 *
 * Meta kuralları: değişkenler sırayla geçer ({{1}}, {{2}}, {{3}}), metin
 * değişkenle başlamaz/bitmez, aynı değişken iki kez kullanılmaz. Test
 * (test-whatsapp-paylasimli) metinleri bu kurallara ve yardımcılara kilitler.
 *
 * Tek platform numarası: mesaj "Nextus Servis" adlı numaradan gider; müşteri
 * bayisini tanısın diye bayi adı her şablonda var. Cevap bu numaraya gelir ve
 * webhook onu doğru bayiye yönlendirir (lib/whatsapp-inbound paylasimliNumaraBayisi).
 *
 * Her şablon "DUR" yazma yolunu söyler: müşteri istemediği mesajı şikâyet etmek
 * yerine durdurabilsin (şikâyet tek platform numarasının kalitesini herkes için düşürür).
 */

export interface SablonTanimi {
  /** Meta'daki şablon adı (Coolify'da WHATSAPP_TEMPLATE / WHATSAPP_TEMPLATE_SAYAC). */
  ad: string;
  kategori: 'UTILITY';
  dil: 'tr';
  metin: string;
  /** Meta onay formundaki "örnek değerler". */
  ornek: string[];
}

export const SABLONLAR = {
  borc: {
    ad: 'borc_hatirlatma',
    kategori: 'UTILITY',
    dil: 'tr',
    metin: 'Merhaba {{1}}, {{2}} adına hatırlatma: vadesi geçmiş {{3}} TL tutarında ödemeniz bulunuyor. Sorunuz varsa bu mesaja cevap yazabilirsiniz. Hatırlatma istemiyorsanız DUR yazın.',
    ornek: ['Ahmet Bey', 'Örnek Fotokopi', '2.450,00'],
  },
  sayac: {
    ad: 'sayac_hatirlatma',
    kategori: 'UTILITY',
    dil: 'tr',
    metin: 'Merhaba {{1}}, {{2}} bu ayın faturası için {{3}} makinenizin sayacını bekliyor. Sayaç ekranının fotoğrafını bu mesaja cevap olarak gönderebilirsiniz. Hatırlatma istemiyorsanız DUR yazın.',
    ornek: ['Ahmet Bey', 'Örnek Fotokopi', '3'],
  },
} satisfies Record<string, SablonTanimi>;

/** Borç hatırlatması: {{1}} müşteri, {{2}} bayi, {{3}} açık tutar ("2.450,00"). */
export const borcParametreleri = (musteri: string, bayi: string, tutar: string): string[] => [musteri, bayi, tutar];

/** Sayaç hatırlatması: {{1}} müşteri, {{2}} bayi, {{3}} okunmamış cihaz sayısı. */
export const sayacParametreleri = (musteri: string, bayi: string, cihaz: number): string[] => [musteri, bayi, String(cihaz)];
