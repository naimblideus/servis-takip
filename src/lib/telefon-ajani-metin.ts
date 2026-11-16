/**
 * TELEFON AJANI — EKRAN METİNLERİ (TR/EN).
 *
 * Ana sözlükte (tr.ts/en.ts) değil, burada: ajan ekranları kendi başına
 * duruyor (bkz. matbaa-metin.ts). Menü adı ve uç hataları ana sözlükte.
 * İki dil aynı anahtarları taşımak ZORUNDA (`typeof tr`).
 *
 * Müşteriye söylenen/yazılan cümleler burada DEĞİL: onlar lib/telefon-ajani.ts
 * içinde, Türkçe (bayilerin müşterisi Türk).
 */
import type { HazirlikKodu, KurulumKodu, OneriVerisi } from './telefon-ajani';

const tr = {
  baslik: 'Telefon ajanı',
  alt: 'Arıza hattınızı ve WhatsApp’ınızı karşılayan yapay zekâ. Müşteriyi numarasından tanır, cihazı ve arızayı sorar; size yalnız taslak bırakır. Fişi siz açarsınız.',

  kart: {
    baslik: 'Ajanın açtığı taslaklar',
    bos: 'Bekleyen taslak yok.',
    buAy: 'Bu ay ajan {acilan} taslak açtı · {onaylanan} tanesi onaylandı',
    bekleyenler: 'Bekleyenler',
    gecmis: 'Geçmiş',
    sayfaya: 'Telefon ajanı →',
  },
  kanal: { TELEFON: 'Telefon', WHATSAPP: 'WhatsApp' } as Record<string, string>,
  durum: { BEKLIYOR: 'Bekliyor', ONAYLANDI: 'Onaylandı', REDDEDILDI: 'Reddedildi' } as Record<string, string>,
  mesajdan: 'mesajdan açıldı',
  taninmayan: 'Tanınmayan numara',
  numaraGizli: 'Numara gizli',
  birdenCokMusteri: 'Bu numara birden çok müşteride kayıtlı',
  acil: 'ACİL',
  firma: 'Firma: {ad}',
  arayan: 'Arayan: {ad}',
  soylenen: 'Söylenen cihaz: {metin}',
  cihazBelirsiz: 'Cihaz belirsiz',
  cihazNeden: {
    SERI: 'seri numarasından',
    MODEL: 'modelden',
    TEK_CIHAZ: 'tek cihazı',
    ONERI: 'mesajdan tahmin',
  } as Record<string, string>,
  fiseCevir: 'Fişe çevir',
  reddet: 'Reddet',
  vazgec: 'Vazgeç',
  cihaz: 'Cihaz',
  cihazSecin: 'Cihaz seçin',
  adayYok: 'Bu taslak için seçilebilecek cihaz yok. Önce müşteriyi ve cihazı ekleyin ya da taslağı reddedin.',
  teknisyen: 'Teknisyen',
  atamaYok: 'Atama yok',
  oneri: 'Öneri',
  ariza: 'Arıza',
  kategori: 'Kategori',
  kategoriYok: 'Kategori yok',
  oncelik: 'Öncelik',
  oncelikler: { LOW: 'Düşük', NORMAL: 'Normal', HIGH: 'Yüksek', URGENT: 'Acil' } as Record<string, string>,
  fisiAc: 'Fişi aç',
  acildi: '{no} açıldı.',
  fiseGit: 'Fişe git',
  redSebebi: 'Sebep (isteğe bağlı)',
  reddedildi: 'Taslak reddedildi.',
  hata: 'İşlem yapılamadı.',
  yukleniyor: 'Yükleniyor…',

  gerekce: {
    bolge: 'bu bölgede {n} iş',
    marka: 'bu markada {n} iş',
    kategori: '{n} benzer arıza',
    acik: 'şu an {n} açık işi var',
    gecmisYok: 'geçmiş iş yok; en az yüklü',
  },

  sayac: {
    baslik: 'Sayaç',
    buAy: 'Bu ay',
    toplam: 'Toplam',
    acilan: 'Açılan taslak',
    onaylanan: 'Onaylanan',
    mesajdan: 'mesajdan açılan: {n}',
    reddedilen: 'Reddedilen',
    bekleyen: 'Bekleyen',
  },

  ayar: {
    baslik: 'Ajan ayarları',
    acik: 'Ajan açık',
    kapali: 'Ajan kapalı',
    ac: 'Ajanı aç',
    kapat: 'Ajanı kapat',
    acikAciklama: 'Ajan aramaları ve WhatsApp’ı karşılıyor, taslakları buraya bırakıyor.',
    kapaliAciklama: 'Kapatınca ajan susar; hat açık kalır, arayan size aktarılır. WhatsApp eskisi gibi çalışır.',
    asistanAdi: 'Asistanın adı',
    aktarma: 'Aktarma numarası',
    aktarmaIpucu: 'Ajan, gerektiğinde arayanı bu numaraya bağlar. Yapay zekâ hattına yönlendirdiğiniz numara olmasın (döngü olur); cep telefonu önerilir.',
    kaydet: 'Kaydet',
    kaydedildi: 'Kaydedildi.',
    senkronHata: 'Değişiklik kaydedildi ama telefon ajanına gönderilemedi. Birazdan yeniden deneyin.',
    yenidenGonder: 'Yeniden gönder',
    hat: 'Telefon hattı',
    hatYok: 'Hat henüz kurulmadı. Hattı Nextus ekibi kurar.',
    hatVar: 'Ajanın hattı: {no}',
    yalnizYonetici: 'Ajanı yalnız yönetici açıp kapatabilir.',
  },

  hazirlik: {
    baslik: 'Hazırlık',
    tamam: 'Tamam',
    eksik: 'Eksik',
    sesHazir: 'Telefon kanalı hazır.',
    sesEksik: 'Telefon kanalı için eksikler var; WhatsApp kanalı yine çalışır.',
    kod: {
      ANAHTAR: 'Retell anahtarı (sunucu ayarı)',
      SES: 'Ses seçimi (sunucu ayarı)',
      SIR: 'Araç sırrı (sunucu ayarı)',
      ADRES: 'Dışarıdan erişilen https adres (sunucu ayarı)',
      AKTARMA: 'Aktarma numarası',
      HAT: 'Telefon hattı',
      KURULU: 'Ajan kuruldu',
      WHATSAPP: 'WhatsApp bağlı',
    } as Record<HazirlikKodu, string>,
  },

  kurulum: {
    ANAHTAR_YOK: 'Retell anahtarı (RETELL_API_KEY) sunucuda tanımlı değil.',
    ARAC_ADRESI_YOK: 'Dışarıdan erişilen https adres yok: VOICE_TOOL_BASE_URL tanımlanmalı.',
    SIR_YOK: 'Araç sırrı (VOICE_TOOL_SECRET) tanımlı değil ya da 16 karakterden kısa.',
    AKTARMA_YOK: 'Geçerli bir aktarma numarası yok (ya da ajan hattıyla aynı). Bot kapalıyken hat ancak aktarmayla açık kalır.',
    SES_KIMLIGI_YOK: 'Ses seçimi (RETELL_VOICE_ID) sunucuda tanımlı değil.',
    HAT_YOK: 'Hat numarası girilmedi.',
    KIRACI_YOK: 'Bayi bulunamadı.',
    RETELL_HATASI: 'Retell isteği başarısız oldu.',
  } as Record<KurulumKodu, string>,
  uyari: {
    ESKI_HAT_COZULEMEDI: 'Eski hattın bağı çözülemedi; Retell panelinden kontrol edin.',
  } as Record<string, string>,

  superAdmin: {
    baslik: 'Telefon ajanı',
    alt: 'Hattı ve ajanı platform ekibi kurar. Bayi yalnız aç/kapa, asistan adı ve aktarma numarasını değiştirir.',
    hatNumarasi: 'Hat numarası (Retell’deki numara)',
    aktarma: 'Aktarma numarası',
    kaydet: 'Kaydet',
    kur: 'Kaydet ve ajanı kur / güncelle',
    kuruluyor: 'Kuruluyor…',
    kuruldu: 'Kuruldu.',
    sonGonderim: 'Son gönderim: {zaman}',
    sonHata: 'Son hata: {kod}',
    ajanDurumu: 'Bayide ajan: {durum}',
    sayac: 'Taslak: {acilan} · onaylanan: {onaylanan}',
    hatBaskaBayide: 'Bu hat başka bir bayiye tanımlı.',
    gecersizNumara: 'Numara geçersiz.',
  },

  /** Fiş aşama geçmişine YAZILAN not — bayinin dilinde. */
  asamaNotu: 'Telefon ajanının taslağından açıldı',
  /** Fişin notu: kanal ve arayan. */
  fisNotu: 'Telefon ajanı · {kanal} · {numara}',
};

export type AjanMetni = typeof tr;

const en: AjanMetni = {
  baslik: 'Phone agent',
  alt: 'An AI that answers your fault line and WhatsApp. It recognises the customer by phone number, asks for the device and the fault, and leaves you only a draft. You open the ticket.',

  kart: {
    baslik: 'Drafts opened by the agent',
    bos: 'No drafts waiting.',
    buAy: 'This month the agent opened {acilan} drafts · {onaylanan} approved',
    bekleyenler: 'Waiting',
    gecmis: 'History',
    sayfaya: 'Phone agent →',
  },
  kanal: { TELEFON: 'Phone', WHATSAPP: 'WhatsApp' },
  durum: { BEKLIYOR: 'Waiting', ONAYLANDI: 'Approved', REDDEDILDI: 'Rejected' },
  mesajdan: 'opened from the message',
  taninmayan: 'Unknown number',
  numaraGizli: 'Hidden number',
  birdenCokMusteri: 'This number belongs to more than one customer',
  acil: 'URGENT',
  firma: 'Company: {ad}',
  arayan: 'Caller: {ad}',
  soylenen: 'Device mentioned: {metin}',
  cihazBelirsiz: 'Device unclear',
  cihazNeden: {
    SERI: 'from serial number',
    MODEL: 'from model',
    TEK_CIHAZ: 'only device',
    ONERI: 'guessed from message',
  },
  fiseCevir: 'Turn into ticket',
  reddet: 'Reject',
  vazgec: 'Cancel',
  cihaz: 'Device',
  cihazSecin: 'Choose a device',
  adayYok: 'There is no device to choose for this draft. Add the customer and the device first, or reject the draft.',
  teknisyen: 'Technician',
  atamaYok: 'Unassigned',
  oneri: 'Suggested',
  ariza: 'Fault',
  kategori: 'Category',
  kategoriYok: 'No category',
  oncelik: 'Priority',
  oncelikler: { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' },
  fisiAc: 'Open ticket',
  acildi: '{no} opened.',
  fiseGit: 'Go to ticket',
  redSebebi: 'Reason (optional)',
  reddedildi: 'Draft rejected.',
  hata: 'Could not complete the action.',
  yukleniyor: 'Loading…',

  gerekce: {
    bolge: '{n} jobs in this area',
    marka: '{n} jobs on this brand',
    kategori: '{n} similar faults',
    acik: '{n} open jobs right now',
    gecmisYok: 'no past jobs; least busy',
  },

  sayac: {
    baslik: 'Counter',
    buAy: 'This month',
    toplam: 'All time',
    acilan: 'Drafts opened',
    onaylanan: 'Approved',
    mesajdan: 'opened from message: {n}',
    reddedilen: 'Rejected',
    bekleyen: 'Waiting',
  },

  ayar: {
    baslik: 'Agent settings',
    acik: 'Agent on',
    kapali: 'Agent off',
    ac: 'Turn agent on',
    kapat: 'Turn agent off',
    acikAciklama: 'The agent answers calls and WhatsApp and leaves the drafts here.',
    kapaliAciklama: 'When off, the agent stays silent; the line stays open and callers are put through to you. WhatsApp works as before.',
    asistanAdi: 'Assistant name',
    aktarma: 'Transfer number',
    aktarmaIpucu: 'The agent puts callers through to this number when needed. Do not use the number you forward to the AI line (it would loop); a mobile is recommended.',
    kaydet: 'Save',
    kaydedildi: 'Saved.',
    senkronHata: 'The change was saved but could not be sent to the phone agent. Try again shortly.',
    yenidenGonder: 'Send again',
    hat: 'Phone line',
    hatYok: 'The line is not set up yet. The Nextus team sets it up.',
    hatVar: 'Agent line: {no}',
    yalnizYonetici: 'Only an admin can turn the agent on or off.',
  },

  hazirlik: {
    baslik: 'Readiness',
    tamam: 'Done',
    eksik: 'Missing',
    sesHazir: 'The phone channel is ready.',
    sesEksik: 'The phone channel is missing something; the WhatsApp channel still works.',
    kod: {
      ANAHTAR: 'Retell key (server setting)',
      SES: 'Voice choice (server setting)',
      SIR: 'Tool secret (server setting)',
      ADRES: 'Public https address (server setting)',
      AKTARMA: 'Transfer number',
      HAT: 'Phone line',
      KURULU: 'Agent set up',
      WHATSAPP: 'WhatsApp connected',
    },
  },

  kurulum: {
    ANAHTAR_YOK: 'The Retell key (RETELL_API_KEY) is not set on the server.',
    ARAC_ADRESI_YOK: 'No public https address: set VOICE_TOOL_BASE_URL.',
    SIR_YOK: 'The tool secret (VOICE_TOOL_SECRET) is not set or is shorter than 16 characters.',
    AKTARMA_YOK: 'No valid transfer number (or it equals the agent line). With the bot off, the line stays open only through the transfer.',
    SES_KIMLIGI_YOK: 'The voice choice (RETELL_VOICE_ID) is not set on the server.',
    HAT_YOK: 'No line number entered.',
    KIRACI_YOK: 'Dealer not found.',
    RETELL_HATASI: 'The Retell request failed.',
  },
  uyari: {
    ESKI_HAT_COZULEMEDI: 'The old line could not be released; check it in the Retell dashboard.',
  },

  superAdmin: {
    baslik: 'Phone agent',
    alt: 'The platform team sets up the line and the agent. The dealer only changes on/off, the assistant name and the transfer number.',
    hatNumarasi: 'Line number (the number in Retell)',
    aktarma: 'Transfer number',
    kaydet: 'Save',
    kur: 'Save and set up / update the agent',
    kuruluyor: 'Setting up…',
    kuruldu: 'Set up.',
    sonGonderim: 'Last sent: {zaman}',
    sonHata: 'Last error: {kod}',
    ajanDurumu: 'Agent at dealer: {durum}',
    sayac: 'Drafts: {acilan} · approved: {onaylanan}',
    hatBaskaBayide: 'This line is assigned to another dealer.',
    gecersizNumara: 'Invalid number.',
  },

  asamaNotu: 'Opened from the phone agent’s draft',
  fisNotu: 'Phone agent · {kanal} · {numara}',
};

export function ajanMetni(dil: string | null | undefined): AjanMetni {
  return dil === 'en' ? en : tr;
}

/** {ad} gibi yer tutucuları doldurur. */
export function doldurMetin(kalip: string, degerler: Record<string, string | number>): string {
  return kalip.replace(/\{(\w+)\}/g, (_, k: string) => (k in degerler ? String(degerler[k]) : `{${k}}`));
}

/** Teknisyen önerisinin gerekçesi, okuyanın dilinde: "bu bölgede 7 iş · şu an 2 açık işi var". */
export function gerekceMetni(v: OneriVerisi | null | undefined, m: AjanMetni): string {
  if (!v) return '';
  if (v.gecmisYok) return `${m.gerekce.gecmisYok} · ${doldurMetin(m.gerekce.acik, { n: v.acikIs })}`;
  const parca: string[] = [];
  if (v.bolgeIs > 0) parca.push(doldurMetin(m.gerekce.bolge, { n: v.bolgeIs }));
  if (v.markaIs > 0) parca.push(doldurMetin(m.gerekce.marka, { n: v.markaIs }));
  if (v.kategoriIs > 0) parca.push(doldurMetin(m.gerekce.kategori, { n: v.kategoriIs }));
  parca.push(doldurMetin(m.gerekce.acik, { n: v.acikIs }));
  return parca.join(' · ');
}

/** Ekranda numara: 5321234567 → 0532 123 45 67 (TR); diğerleri olduğu gibi. */
export function numaraGoster(son10: string | null | undefined): string {
  const s = (son10 ?? '').replace(/[^0-9]/g, '');
  if (s.length !== 10) return s;
  return `0${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6, 8)} ${s.slice(8)}`;
}

export { tr as ajanMetniTr, en as ajanMetniEn };
