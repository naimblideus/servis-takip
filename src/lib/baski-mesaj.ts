// BASKI İŞİ WHATSAPP METİNLERİ — saf (veritabanı yok). Testte doğrudan derlenir.
//
// Mesaj matbaanın KENDİ numarasından, tek dokunuşla gider: düğme wa.me
// bağlantısı açar, metin hazır gelir, gönderen personeldir. Otomatik gönderim
// yok (Meta onayı gerekir). Her iş aynı dört turla bitiyordu: "aldık",
// "hazır mı?", "IBAN neydi?", "teşekkürler"; burası o dört mesajın metni.
//
// Müşteriye giden metin BAYİNİN dilinde, ekrandaki kullanıcının dilinde değil.
// Takip ve prova bağlantısı verilmedikçe satırı yazılmaz (matbaanın kısa adı
// yoksa bağlantı da yoktur): açılmayan bir sayfaya müşteri göndermek
// "çalışmıyor" mesajı getirir.
import { ibanBicimle } from './odeme-bilgisi';

export type MesajTuru = 'ALINDI' | 'HAZIR' | 'ODEME' | 'TESEKKUR' | 'PROVA';
export const MESAJ_TURLERI: readonly MesajTuru[] = ['ALINDI', 'HAZIR', 'ODEME', 'TESEKKUR', 'PROVA'];

export function mesajTuru(x: unknown): MesajTuru | null {
  return (MESAJ_TURLERI as readonly string[]).includes(x as string) ? (x as MesajTuru) : null;
}

export interface MesajVerisi {
  isNo: string;
  musteriAd?: string | null;
  ozet?: string | null;
  /** Biçimlenmiş tutarlar ("₺570,00"). */
  toplam: string;
  /** Kalan borç; ödenmişse null. */
  kalan: string | null;
  /** Söz verilen saat, biçimlenmiş. */
  saat?: string | null;
  firma: string;
  adres?: string | null;
  iban?: string | null;
  hesapAdi?: string | null;
  /** Takip sayfası (/b/<kısa-ad>/is/<jeton>). */
  takipUrl?: string | null;
  /** Prova onay sayfası; yalnız PROVA mesajında. */
  provaUrl?: string | null;
}

/** Boş satırları atar; metin satırı `null` ise o bilgi yoktur. */
const satirlar = (...l: (string | null | undefined | false)[]) => l.filter((x) => typeof x === 'string').join('\n');

const METIN = {
  tr: {
    selam: (ad?: string | null) => (ad ? `Merhaba ${ad},` : 'Merhaba,'),
    ALINDI: (v: MesajVerisi) => satirlar(
      `${v.isNo} numaralı işiniz alındı.`,
      v.ozet ?? null,
      `Tutar: ${v.toplam}`,
      v.saat ? `Hazır olma saati: ${v.saat}` : null,
      v.takipUrl ? `Takip: ${v.takipUrl}` : null,
    ),
    HAZIR: (v: MesajVerisi) => satirlar(
      `${v.isNo} numaralı işiniz hazır, teslim alabilirsiniz.`,
      v.kalan ? `Ödenecek tutar: ${v.kalan}` : null,
      v.adres ? `Adres: ${v.adres}` : null,
      v.takipUrl ? `Takip: ${v.takipUrl}` : null,
    ),
    ODEME: (v: MesajVerisi) => satirlar(
      `${v.isNo} numaralı işiniz için ödeme bilgisi:`,
      `Tutar: ${v.kalan ?? v.toplam}`,
      v.iban ? `IBAN: ${ibanBicimle(v.iban)}` : null,
      v.hesapAdi ? `Alıcı: ${v.hesapAdi}` : null,
      `Açıklama: ${v.isNo}`,
    ),
    TESEKKUR: (v: MesajVerisi) => `${v.isNo} numaralı işinizi teslim ettik. Bizi tercih ettiğiniz için teşekkür ederiz.`,
    PROVA: (v: MesajVerisi) => satirlar(
      `${v.isNo} numaralı işinizin provası hazır.`,
      'Baskıya geçmeden önce inceleyip onaylamanızı rica ederiz:',
      v.provaUrl ?? null,
    ),
  },
  en: {
    selam: (ad?: string | null) => (ad ? `Hello ${ad},` : 'Hello,'),
    ALINDI: (v: MesajVerisi) => satirlar(
      `We have received your job ${v.isNo}.`,
      v.ozet ?? null,
      `Amount: ${v.toplam}`,
      v.saat ? `Ready by: ${v.saat}` : null,
      v.takipUrl ? `Track it: ${v.takipUrl}` : null,
    ),
    HAZIR: (v: MesajVerisi) => satirlar(
      `Your job ${v.isNo} is ready for pickup.`,
      v.kalan ? `Amount due: ${v.kalan}` : null,
      v.adres ? `Address: ${v.adres}` : null,
      v.takipUrl ? `Track it: ${v.takipUrl}` : null,
    ),
    ODEME: (v: MesajVerisi) => satirlar(
      `Payment details for your job ${v.isNo}:`,
      `Amount: ${v.kalan ?? v.toplam}`,
      v.iban ? `IBAN: ${ibanBicimle(v.iban)}` : null,
      v.hesapAdi ? `Payee: ${v.hesapAdi}` : null,
      `Reference: ${v.isNo}`,
    ),
    TESEKKUR: (v: MesajVerisi) => `We have handed over your job ${v.isNo}. Thank you for choosing us.`,
    PROVA: (v: MesajVerisi) => satirlar(
      `The proof for your job ${v.isNo} is ready.`,
      'Please check and approve it before we print:',
      v.provaUrl ?? null,
    ),
  },
} as const;

/** Mesaj metni: selam, gövde, imza (matbaanın adı). */
export function mesajYaz(tur: MesajTuru, v: MesajVerisi, dil: string | null | undefined): string {
  const m = dil === 'en' ? METIN.en : METIN.tr;
  return [m.selam(v.musteriAd), m[tur](v), v.firma].join('\n\n');
}

/**
 * Bu durumda hangi mesajlar anlamlı; ilki ana düğme. Havale istenen işte
 * IBAN'ı personel ezberden yazmasın; IBAN girilmemişse ödeme mesajı yok,
 * hesap numarasız "ödeme bilgisi" müşteriye bir tur daha yazdırır. Cari iş
 * teslimden önce hatırlatılmaz: borç zaten cariye yazılacak. Onay bekleyen
 * prova varsa ilk düğme odur: iş müşterinin cevabını bekliyor.
 */
export function onerilenMesajlar(durum: string, o: { kalan: number; ibanVar: boolean; cari: boolean; provaBekliyor?: boolean }): MesajTuru[] {
  const odeme = o.kalan > 0 && o.ibanVar;
  switch (durum) {
    case 'GELEN': case 'SIRADA': case 'BASKIDA': case 'BITIS': {
      const l: MesajTuru[] = odeme && !o.cari ? ['ALINDI', 'ODEME'] : ['ALINDI'];
      return o.provaBekliyor ? ['PROVA', ...l] : l;
    }
    case 'HAZIR':
      return odeme && !o.cari ? ['HAZIR', 'ODEME'] : ['HAZIR'];
    case 'TESLIM':
      return odeme ? ['ODEME', 'TESEKKUR'] : ['TESEKKUR'];
    default:
      return [];
  }
}
