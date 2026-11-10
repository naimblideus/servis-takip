// MATBAA AYARI — saf kurallar (veritabanı yok). Testte doğrudan derlenir.
//
// Sipariş sayfasının adresi matbaanın kısa adı: /b/<kisaAd>. Müşteri bu
// bağlantıyı WhatsApp karşılama mesajından açar; iş takibi ve prova aynı
// adresin altında. Adresler tek yerde kurulur ki mesaj, fiş (QR) ve sayfa
// aynı bağlantıyı üretsin.
import { ibanBicimle } from './odeme-bilgisi';

// ── KISA AD ──────────────────────────────────────────────────────────────

const HARF: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
/** Adresin altındaki sabit yollarla ve sistem adlarıyla karışmasın. */
const YASAK: readonly string[] = ['api', 'admin', 'is', 'prova', 'yeni', 'www', 'nextus', 'nextus-servis', 'login', 'kayit'];

/** "Lider Dijital Baskı" → "lider-dijital-baski". Geçersiz kalırsa boş döner. */
export function kisaAdTemizle(ham: unknown): string {
  const s = String(ham ?? '').toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, (c) => HARF[c] ?? c)
    .normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return s;
}

export function kisaAdGecerli(x: unknown): x is string {
  return typeof x === 'string' && x.length >= 3 && x.length <= 40 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x) && !YASAK.includes(x);
}

/** Takip ve prova jetonu: 18 bayt base64url (lib/baski-is-kayit yeniJeton). */
export function jetonGecerli(x: unknown): x is string {
  return typeof x === 'string' && /^[A-Za-z0-9_-]{24}$/.test(x);
}

// ── ADRESLER ─────────────────────────────────────────────────────────────

export const siparisYolu = (kisaAd: string) => `/b/${kisaAd}`;
export const takipYolu = (kisaAd: string, jeton: string) => `/b/${kisaAd}/is/${jeton}`;
export const provaYolu = (kisaAd: string, jeton: string) => `/b/${kisaAd}/prova/${jeton}`;

/** Tam adres; kısa ad yoksa null (bağlantısı olmayan sayfaya müşteri gönderilmez). */
export function tamAdres(kok: string, yol: string | null): string | null {
  return yol ? `${kok.replace(/\/+$/, '')}${yol}` : null;
}

// ── SAYILAR ──────────────────────────────────────────────────────────────

const aralik = (x: unknown, alt: number, ust: number, varsayilan: number) => {
  const n = Math.floor(Number(x));
  return Number.isFinite(n) && n >= alt && n <= ust ? n : varsayilan;
};
/** Dosyalar teslim ya da iptalden sonra kaç gün saklanır (7–365). */
export const saklamaGunu = (x: unknown) => aralik(x, 7, 365, 30);
/** Ürününde süre yoksa hazırlama süresi (saat). */
export const hazirlamaSaati = (x: unknown) => aralik(x, 1, 240, 2);

/**
 * Online iş kabul edilince müşteriye söylenecek hazır olma saati: kalemlerin
 * en uzun hazırlama süresi kadar sonra. Sipariş gece gelmiş olabilir; süre
 * siparişten değil KABULDEN sayılır.
 */
export function sozSaati(simdi: Date, urunSaatleri: readonly (number | null | undefined)[], varsayilanSaat: number): Date {
  const saat = Math.max(...urunSaatleri.map((s) => (typeof s === 'number' && s > 0 ? s : varsayilanSaat)), 0) || varsayilanSaat;
  return new Date(simdi.getTime() + saat * 3_600_000);
}

// ── HIZLI YANITLAR ───────────────────────────────────────────────────────
// WhatsApp Business'ın "hızlı yanıt" ve "karşılama mesajı" alanlarına
// yapıştırılacak metinler. Otomatik gönderim yok: matbaa bir kez kopyalar,
// WhatsApp kendi gönderir. Verisi olmayan yanıt listede çıkmaz.

export type YanitTuru = 'KARSILAMA' | 'FIYAT' | 'IBAN' | 'ADRES' | 'SAAT';

export interface YanitVerisi {
  firma: string;
  siparisUrl: string | null;
  adres?: string | null;
  iban?: string | null;
  hesapAdi?: string | null;
  calisma?: string | null;
  /** Matbaanın kendi yazdığı karşılama; {baglanti} yerine sipariş adresi konur. */
  ozelKarsilama?: string | null;
}

const YANIT = {
  tr: {
    karsilama: (f: string, u: string) => `Merhaba, ${f} olarak size yardımcı olalım.\nFiyat görmek, dosyanızı gönderip sipariş vermek için: ${u}\nSiparişinizin durumunu aynı bağlantıdan takip edebilirsiniz.`,
    fiyat: (u: string) => `Fiyatlarımız ve anında fiyat hesabı: ${u}`,
    iban: (i: string, h: string | null) => [`IBAN: ${i}`, h ? `Alıcı: ${h}` : null, 'Açıklamaya iş numaranızı yazmanız yeterli.'].filter(Boolean).join('\n'),
    adres: (a: string) => `Adresimiz: ${a}`,
    saat: (c: string) => `Çalışma saatlerimiz: ${c}`,
  },
  en: {
    karsilama: (f: string, u: string) => `Hello, this is ${f}.\nTo see prices, send your file and place an order: ${u}\nYou can follow your order from the same link.`,
    fiyat: (u: string) => `Our prices and an instant quote: ${u}`,
    iban: (i: string, h: string | null) => [`IBAN: ${i}`, h ? `Payee: ${h}` : null, 'Please put your job number in the reference.'].filter(Boolean).join('\n'),
    adres: (a: string) => `Our address: ${a}`,
    saat: (c: string) => `Opening hours: ${c}`,
  },
} as const;

export function hizliYanitlar(v: YanitVerisi, dil: string | null | undefined): { tur: YanitTuru; metin: string }[] {
  const m = dil === 'en' ? YANIT.en : YANIT.tr;
  const out: { tur: YanitTuru; metin: string }[] = [];
  if (v.siparisUrl) {
    const ozel = (v.ozelKarsilama ?? '').trim();
    out.push({
      tur: 'KARSILAMA',
      // Kendi metninde bağlantı yeri yoksa sona eklenir: bağlantısız karşılama işe yaramaz.
      metin: ozel ? (ozel.includes('{baglanti}') ? ozel.split('{baglanti}').join(v.siparisUrl) : `${ozel}\n${v.siparisUrl}`) : m.karsilama(v.firma, v.siparisUrl),
    });
    out.push({ tur: 'FIYAT', metin: m.fiyat(v.siparisUrl) });
  }
  if (v.iban) out.push({ tur: 'IBAN', metin: m.iban(ibanBicimle(v.iban), v.hesapAdi ?? null) });
  if (v.adres?.trim()) out.push({ tur: 'ADRES', metin: m.adres(v.adres.trim()) });
  if (v.calisma?.trim()) out.push({ tur: 'SAAT', metin: m.saat(v.calisma.trim()) });
  return out;
}

// ── KURULUM LİSTESİ ──────────────────────────────────────────────────────

export type KurulumAdimi = 'FIYAT' | 'BAGLANTI' | 'KARSILAMA' | 'ILK_IS';
export const KURULUM_SIRASI: readonly KurulumAdimi[] = ['FIYAT', 'BAGLANTI', 'KARSILAMA', 'ILK_IS'];

/**
 * Yeni matbaanın ilk dört işi. Hepsi bitince liste Bugün'den kalkar; biten
 * adım geri açılmaz (sipariş sayfasını sonradan kapatan matbaaya liste
 * yeniden gösterilmez: ilk iş açılmışsa kurulum bitmiştir).
 */
export function kurulumDurumu(v: { fiyatliUrun: number; kisaAd: string | null; siparisAcik: boolean; karsilamaKopyalandi: boolean; isSayisi: number }): { adim: KurulumAdimi; tamam: boolean }[] {
  return [
    { adim: 'FIYAT', tamam: v.fiyatliUrun > 0 },
    { adim: 'BAGLANTI', tamam: !!v.kisaAd && v.siparisAcik },
    { adim: 'KARSILAMA', tamam: v.karsilamaKopyalandi },
    { adim: 'ILK_IS', tamam: v.isSayisi > 0 },
  ];
}
export const kurulumBitti = (l: readonly { tamam: boolean }[]) => l.every((x) => x.tamam);
