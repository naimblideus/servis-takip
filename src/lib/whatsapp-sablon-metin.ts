/**
 * "Eksik şablonları Meta'ya gönder" kutusunun metinleri (süper admin →
 * WhatsApp Kurulumu). Ana sözlük aynı anda başka işlerde değiştiği için
 * aktivasyon-metin / kurulum-metin gibi kendi dosyasında duruyor.
 */
const METIN = {
  tr: {
    baslik: 'Şablonları Meta’ya gönder',
    alt: 'Eksik olan şablonları (hatırlatmalar + mağaza bildirimleri) tek seferde onaya yollar. Meta’da olanlara dokunmaz. Onay genelde dakikalar, bazen 1 gün sürer.',
    dugme: 'Eksik şablonları gönder',
    gonderiliyor: 'Gönderiliyor…',
    env: 'Önce Coolify’da WHATSAPP_TOKEN ve WHATSAPP_WABA_ID tanımlanmalı.',
    sinir: 'Çok sık denendi; 10 dakika sonra tekrar deneyin.',
    meta: 'Meta şablon listesini vermedi:',
    hata: 'İstek gönderilemedi.',
    olusturuldu: 'onaya gönderildi',
    zatenVar: 'zaten var',
    basarisiz: 'gönderilemedi',
  },
  en: {
    baslik: 'Send templates to Meta',
    alt: 'Submits the missing templates (reminders + store notifications) for approval in one go. Existing ones are left untouched. Approval usually takes minutes, sometimes a day.',
    dugme: 'Send missing templates',
    gonderiliyor: 'Sending…',
    env: 'WHATSAPP_TOKEN and WHATSAPP_WABA_ID must be set in Coolify first.',
    sinir: 'Tried too often; try again in 10 minutes.',
    meta: 'Meta did not return the template list:',
    hata: 'The request could not be sent.',
    olusturuldu: 'submitted for approval',
    zatenVar: 'already exists',
    basarisiz: 'failed',
  },
} satisfies Record<'tr' | 'en', Record<string, string>>;

export function sablonOlusturMetni(dil: string | null | undefined) {
  return METIN[dil === 'en' ? 'en' : 'tr'];
}
