/**
 * KURULUM VE BAŞARI — saf kurallar (veritabanı yok). Testi: scripts/test-kurulum.mjs
 *
 * Kurulum ekibi öğrencilerden oluşuyor; çoğu yazılım bilmiyor. Ekranın tek
 * işi "bu bayinin kurulumu nerede, sıradaki iş ne, bugün kimi aramalıyım"
 * sorusunu cevaplamak. Kontrol listesi ELLE İŞARETLENMEZ: elle işaretlenen
 * liste ilk hafta doğru, ikinci hafta yalan olur ("yaptık" denir, veri
 * girilmemiştir). Her adım bayinin GERÇEK kaydından sayılır; veriyi
 * `kurulum-veri.ts` toplar, cümleleri `kurulum-metin.ts` kurar.
 *
 * "Hazır" = beş zorunlu adımın hepsi TAMAM ya da UYGULANMAZ. Bu beş adım,
 * bayinin ürünle para kazanmaya başladığı zincir: firma bilgisi (faturada
 * yazar) → cihaz → fiyat → sayaç → fatura. Biri eksikse ilk fatura ya hiç
 * çıkmaz ya da yanlış çıkar.
 */

export type AdimKodu =
  | 'FIRMA'
  | 'CIHAZ'
  | 'FIYAT'
  | 'SAYAC'
  | 'FATURA'
  | 'EKIP'
  | 'FIS'
  | 'TARAYICI'
  | 'ARAC'
  | 'SOZLESME'
  | 'WHATSAPP'
  | 'EFATURA'
  | 'PORTAL';

export type AdimDurumu = 'TAMAM' | 'KISMEN' | 'EKSIK' | 'UYGULANMAZ';

export interface Adim {
  kod: AdimKodu;
  zorunlu: boolean;
  durum: AdimDurumu;
  /** Ekranda cümleye konan sayılar (kurulum-metin.ts → kanit). */
  kanit: Record<string, number>;
  /** Bayinin bu işi yaptığı ürün sayfası. */
  yol: string;
}

/** Bir bayinin kurulum sayıları — veri katmanı doldurur. */
export interface KurulumGirdisi {
  firma: { vergiNo: boolean; adres: boolean; telefon: boolean };
  /** ISO ülke kodu: e-Fatura yalnız Türkiye'de var. */
  ulke: string;
  cihaz: number;
  kiralik: number;
  /** Kira bedeli ya da cihaza özel sayfa fiyatı yazılmış kiralık. */
  fiyatliKiralik: number;
  /** Son 35 günde en az bir okuması olan kiralık. */
  okunanKiralik: number;
  /** Son 35 günde kiralıklardan gelen okuma sayısı ve kendiliğinden gelenler. */
  okuma: number;
  kendiliginden: number;
  faturaSayisi: number;
  ilkFatura: Date | null;
  /** Yönetici dışı aktif kullanıcı (teknisyen, ön büro). */
  ekip: number;
  /** Son 30 gün. */
  fis: number;
  tarama: number;
  arac: number;
  sozlesme: number;
  whatsapp: boolean;
  eFatura: 'YOK' | 'TEST' | 'GERCEK';
  portal: number;
}

export interface KurulumSonucu {
  adimlar: Adim[];
  /** TAMAM ya da UYGULANMAZ olan zorunlu adım sayısı. */
  zorunluTamam: number;
  zorunluToplam: number;
  hazir: boolean;
  /** İlk eksik zorunlu adım; zorunlular bittiyse ilk eksik isteğe bağlı; hepsi bittiyse null. */
  sonrakiAdim: Adim | null;
  /** Açılıştan ilk faturaya gün — yalnız Hazır bayide (ortanca "hazır günü" bundan). */
  hazirGunu: number | null;
}

const GUN = 86_400_000;

// ── EŞİKLER ─────────────────────────────────────────────────────────────
// Hepsi sabit ve nedeniyle yazılı. Değiştirmek isteyen önce nedeni çürütsün.

/**
 * %80: kiralıkların çoğunluğu yetmez, neredeyse hepsi gerekir — fiyatsız ya da
 * okunmamış cihazın faturası çıkmaz, o para kaçar. %100 da istenmiyor: her
 * parkta depoda bekleyen, müşterisi değişen birkaç cihaz olur; %100 isteyen
 * kural hiçbir bayiyi "Hazır" saymaz ve ekip listeye bakmayı bırakır.
 */
export const KAPSAM_ESIGI = 0.8;
/** 35 gün: aylık okuma döngüsü + ay sonu/başı kayması için 5 gün pay. */
export const SAYAC_PENCERESI_GUN = 35;
/** 30 gün: "kullanıyor mu" için bir aylık dönem; fiş ve tarama seyrek işlerdir. */
export const KULLANIM_PENCERESI_GUN = 30;
/** 7 gün: bir iş haftası boyunca hiç kayıt yoksa bayi ürünü bırakmış olabilir. */
export const SESSIZ_GUN = 7;
/** 14 gün: iki hafta sessizlik artık uyarı değil, kayıp riskidir. */
export const SESSIZ_KIRMIZI_GUN = 14;
/**
 * Ayın 10'u: sayaçlar çoğunlukla ayın ilk haftasında okunur; 10'undan önce
 * düşük oran normaldir, sonra değildir. %60: hedefin (%80) belirgin altı —
 * birkaç geç okuma için alarm çalmasın.
 */
export const SAYAC_DUSUS_GUNU = 10;
export const SAYAC_DUSUS_ESIGI = 0.6;
/** Ayın 7'si: otomatik fatura ayın 1'inde keser; bir haftada hâlâ yoksa bir şey takılmıştır. */
export const FATURA_GECIKME_GUNU = 7;
/** 5 gün: ödemeyi konuşmak için en az bir hafta sonu öncesi; 2 gün ve altı acil. */
export const DENEME_UYARI_GUN = 5;
export const DENEME_ACIL_GUN = 2;

/** Kendiliğinden gelen okuma: bayi elle yazmadı (cihazın e-postası, ağ tarayıcı, müşteri portalı, WhatsApp fotoğrafı, yazıcı ajanı). */
export const KENDILIGINDEN_KAYNAKLAR = ['CIHAZ_EPOSTA', 'TARAYICI', 'PORTAL', 'WHATSAPP_FOTO', 'PRINTER'] as const;

export const ZORUNLU_ADIMLAR: readonly AdimKodu[] = ['FIRMA', 'CIHAZ', 'FIYAT', 'SAYAC', 'FATURA'];

/** Bayinin işi yaptığı sayfa. Tek yer: hem süper admin ekranı hem bayi kartı buradan alır. */
export const ADIM_YOLU: Record<AdimKodu, string> = {
  FIRMA: '/settings',
  CIHAZ: '/import',
  FIYAT: '/devices',
  SAYAC: '/sayac-turu',
  FATURA: '/invoices',
  EKIP: '/users/new',
  FIS: '/tickets/new',
  TARAYICI: '/sayac-tarayici',
  ARAC: '/depolar',
  SOZLESME: '/sozlesmeler',
  WHATSAPP: '/whatsapp',
  EFATURA: '/e-fatura',
  PORTAL: '/musteri-portali',
};

/** Oran adımı: hedefe ulaştıysa TAMAM, bir kısmı varsa KISMEN, hiç yoksa EKSIK. */
function oranDurumu(pay: number, payda: number): AdimDurumu {
  if (payda <= 0) return 'UYGULANMAZ';
  if (pay / payda >= KAPSAM_ESIGI) return 'TAMAM';
  return pay > 0 ? 'KISMEN' : 'EKSIK';
}
const varYok = (n: number): AdimDurumu => (n > 0 ? 'TAMAM' : 'EKSIK');
const bitti = (d: AdimDurumu) => d === 'TAMAM' || d === 'UYGULANMAZ';

export function kurulumDurumu(g: KurulumGirdisi, acilis: Date): KurulumSonucu {
  const adim = (kod: AdimKodu, durum: AdimDurumu, kanit: Record<string, number>): Adim => ({
    kod,
    zorunlu: ZORUNLU_ADIMLAR.includes(kod),
    durum,
    kanit,
    yol: ADIM_YOLU[kod],
  });
  const firmaVar = [g.firma.vergiNo, g.firma.adres, g.firma.telefon].filter(Boolean).length;
  // Kiralık yoksa fiyat ve sayaç bu bayi için anlamsız (yalnız servis yapıyor):
  // UYGULANMAZ, "Hazır"ı engellemez. Kiralık varsa ama hiç cihaz yoksa zaten CIHAZ eksik.
  const sayacDurumu = oranDurumu(g.okunanKiralik, g.kiralik);

  const adimlar: Adim[] = [
    adim('FIRMA', firmaVar === 3 ? 'TAMAM' : firmaVar > 0 ? 'KISMEN' : 'EKSIK', {
      vergiNo: g.firma.vergiNo ? 1 : 0,
      adres: g.firma.adres ? 1 : 0,
      telefon: g.firma.telefon ? 1 : 0,
      n: firmaVar,
    }),
    adim('CIHAZ', varYok(g.cihaz), { n: g.cihaz, kiralik: g.kiralik }),
    adim('FIYAT', oranDurumu(g.fiyatliKiralik, g.kiralik), { n: g.fiyatliKiralik, toplam: g.kiralik }),
    adim('SAYAC', sayacDurumu, {
      n: g.okunanKiralik,
      toplam: g.kiralik,
      okuma: g.okuma,
      kendiliginden: g.kendiliginden,
      // Kendiliğinden gelen pay: okuma yoksa -1 (ekranda "bilinmiyor", %0 değil).
      pay: g.okuma > 0 ? Math.round((g.kendiliginden / g.okuma) * 100) : -1,
    }),
    adim('FATURA', varYok(g.faturaSayisi), { n: g.faturaSayisi }),
    adim('EKIP', varYok(g.ekip), { n: g.ekip }),
    adim('FIS', varYok(g.fis), { n: g.fis }),
    adim('TARAYICI', varYok(g.tarama), { n: g.tarama }),
    adim('ARAC', varYok(g.arac), { n: g.arac }),
    adim('SOZLESME', varYok(g.sozlesme), { n: g.sozlesme }),
    adim('WHATSAPP', g.whatsapp ? 'TAMAM' : 'EKSIK', {}),
    // e-Fatura yalnız Türkiye'de. Test modu açık ama gerçek sağlayıcı yoksa
    // KISMEN: kurulum başlamış, müşteriye belge gitmiyor.
    adim(
      'EFATURA',
      g.ulke !== 'TR' ? 'UYGULANMAZ' : g.eFatura === 'GERCEK' ? 'TAMAM' : g.eFatura === 'TEST' ? 'KISMEN' : 'EKSIK',
      {},
    ),
    adim('PORTAL', varYok(g.portal), { n: g.portal }),
  ];

  const zorunlu = adimlar.filter((a) => a.zorunlu);
  const zorunluTamam = zorunlu.filter((a) => bitti(a.durum)).length;
  const hazir = zorunluTamam === zorunlu.length;
  const sonrakiAdim =
    zorunlu.find((a) => !bitti(a.durum)) ?? adimlar.find((a) => !a.zorunlu && !bitti(a.durum)) ?? null;
  const hazirGunu = hazir && g.ilkFatura ? gunFarki(acilis, g.ilkFatura) : null;

  return { adimlar, zorunluTamam, zorunluToplam: zorunlu.length, hazir, sonrakiAdim, hazirGunu };
}

/** a → b arası tam gün (aynı gün 0; ters sırada 0). */
export function gunFarki(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / GUN));
}

/** Ortanca — boş listede null (ekranda "bilinmiyor"). */
export function ortanca(sayilar: number[]): number | null {
  if (!sayilar.length) return null;
  const s = [...sayilar].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : Math.round((s[o - 1] + s[o]) / 2);
}

// ── TARİH: İSTANBUL ─────────────────────────────────────────────────────
// "Ayın 10'u", "bugün" ekibin ve bayilerin çoğunun saatine göre. Türkiye 2016'dan
// beri yaz saati uygulamıyor: sabit UTC+3. (Avrupa'daki bayi için birkaç saatlik
// kayma kabul edildi; eşikler gün düzeyinde.)
const TR_SAAT = 3 * 3_600_000;

export function istanbulGunu(t: Date): { yil: number; ay: number; gun: number } {
  const d = new Date(t.getTime() + TR_SAAT);
  return { yil: d.getUTCFullYear(), ay: d.getUTCMonth() + 1, gun: d.getUTCDate() };
}
/** İstanbul'da bu ayın ilk anı. */
export function ayBasi(t: Date): Date {
  const { yil, ay } = istanbulGunu(t);
  return new Date(Date.UTC(yil, ay - 1, 1) - TR_SAAT);
}
/** İstanbul'da günün ilk anı. */
export function gunBasi(t: Date): Date {
  const { yil, ay, gun } = istanbulGunu(t);
  return new Date(Date.UTC(yil, ay - 1, gun) - TR_SAAT);
}
/** 'YYYY-MM-DD' (İstanbul günü) — tarih kutusunun değeri. */
export function gunMetni(t: Date): string {
  const { yil, ay, gun } = istanbulGunu(t);
  return `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
}
/** 'YYYY-MM-DD' → İstanbul'da o günün ilk anı; geçersizse null. */
export function gunOku(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, a, g] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(y, a - 1, g));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== a - 1 || d.getUTCDate() !== g) return null;
  return new Date(d.getTime() - TR_SAAT);
}

// ── SAĞLIK ──────────────────────────────────────────────────────────────

export type SaglikKodu = 'SESSIZ' | 'SAYAC_DUSTU' | 'FATURA_YOK' | 'DENEME_BITIYOR' | 'ACIK_SORUN';
export type Renk = 'KIRMIZI' | 'SARI' | 'YESIL';

export interface SaglikGirdisi {
  acilis: Date;
  /** Bayinin kendi kullanıcısının son kaydı (süper admin ve sistem sayılmaz). */
  sonHareket: Date | null;
  kiralik: number;
  /** Bu ay (İstanbul) en az bir okuması olan kiralık. */
  buAyOkunanKiralik: number;
  /** Şimdiye kadar kesilen müşteri faturası ve sonuncusunun tarihi. */
  faturaSayisi: number;
  sonFatura: Date | null;
  denemede: boolean;
  denemeBitis: Date | null;
  odedi: boolean;
  acikSorun: number;
  durduranSorun: number;
}

export interface SaglikNedeni {
  kod: SaglikKodu;
  renk: Exclude<Renk, 'YESIL'>;
  deger: Record<string, number>;
}
export interface SaglikSonucu {
  renk: Renk;
  /** Ağırdan hafife: ilk neden satırda gösterilir. */
  nedenler: SaglikNedeni[];
}

export function saglikDurumu(s: SaglikGirdisi, simdi: Date): SaglikSonucu {
  const nedenler: SaglikNedeni[] = [];
  const bugun = istanbulGunu(simdi).gun;
  const buAy = ayBasi(simdi);

  // Açık sorun: bayiyi DURDURAN bir sorun her şeyden önce gelir — kullanamıyorsa
  // kurulumun geri kalanını konuşmanın anlamı yok.
  if (s.acikSorun > 0) {
    nedenler.push({ kod: 'ACIK_SORUN', renk: s.durduranSorun > 0 ? 'KIRMIZI' : 'SARI', deger: { n: s.acikSorun, durduran: s.durduranSorun } });
  }

  if (s.denemede && !s.odedi && s.denemeBitis) {
    const kalan = Math.ceil((s.denemeBitis.getTime() - simdi.getTime()) / GUN);
    if (kalan <= DENEME_UYARI_GUN) {
      nedenler.push({ kod: 'DENEME_BITIYOR', renk: kalan <= DENEME_ACIL_GUN ? 'KIRMIZI' : 'SARI', deger: { n: Math.max(0, kalan) } });
    }
  }

  // Fatura yok: yalnız daha önce fatura kesmiş, kiralığı olan bayide. Hiç
  // fatura kesmemiş bayi zaten kurulumda (FATURA adımı eksik) — onu her ay
  // kırmızıya boyamak "kurulumda" ile "faturayı bıraktı"yı karıştırır.
  // Kırmızı: fatura kesilmemesi bayinin ve bizim gelirimizin durması demek.
  if (s.kiralik > 0 && s.faturaSayisi > 0 && bugun > FATURA_GECIKME_GUNU && !(s.sonFatura && s.sonFatura >= buAy)) {
    nedenler.push({ kod: 'FATURA_YOK', renk: 'KIRMIZI', deger: { gun: bugun } });
  }

  // Sayaç düştü: yalnız bu aydan önce açılmış bayide — bu ay açılan bayinin
  // ilk ayı kurulumdur, düşüş değil.
  if (s.kiralik > 0 && bugun > SAYAC_DUSUS_GUNU && s.acilis < buAy) {
    const oran = s.buAyOkunanKiralik / s.kiralik;
    if (oran < SAYAC_DUSUS_ESIGI) {
      nedenler.push({ kod: 'SAYAC_DUSTU', renk: 'SARI', deger: { n: s.buAyOkunanKiralik, toplam: s.kiralik, yuzde: Math.round(oran * 100) } });
    }
  }

  // Sessiz: hiç hareketi olmayan bayide açılış günü sayılır (yeni açılmış
  // hesap ilk 7 gün sessiz sayılmaz).
  const son = s.sonHareket ?? s.acilis;
  const sessizGun = Math.floor((simdi.getTime() - son.getTime()) / GUN);
  if (sessizGun >= SESSIZ_GUN) {
    nedenler.push({ kod: 'SESSIZ', renk: sessizGun >= SESSIZ_KIRMIZI_GUN ? 'KIRMIZI' : 'SARI', deger: { gun: sessizGun } });
  }

  // Sıra: önce kırmızılar; aynı renkte yukarıdaki ekleme sırası (önem) korunur.
  const sirali = [...nedenler.filter((n) => n.renk === 'KIRMIZI'), ...nedenler.filter((n) => n.renk === 'SARI')];
  const renk: Renk = sirali[0]?.renk ?? 'YESIL';
  return { renk, nedenler: sirali };
}

/** Bugün aranacak mı: sonraki temas günü geldi (ya da geçti) ya da sağlık kırmızı. */
export function bugunAranacak(sonrakiTemas: Date | null, renk: Renk, simdi: Date): boolean {
  if (renk === 'KIRMIZI') return true;
  if (!sonrakiTemas) return false;
  return sonrakiTemas.getTime() < gunBasi(simdi).getTime() + GUN;
}

// ── GİRDİ DOĞRULAMA (uçlar) ─────────────────────────────────────────────

export const NOT_TURLERI = ['ARAMA', 'ZIYARET', 'NOT'] as const;
export type NotTuru = (typeof NOT_TURLERI)[number];
export const NOT_EN_UZUN = 1000;

/**
 * Yeni not. Metin kırpılır, boş ya da 1000 karakterden uzunsa reddedilir.
 * Kart numarasına benzeyen 13-19 haneli dizi reddedilir: ekran "şifre ya da kart
 * bilgisi yazmayın" diyor; notlar bütün ekibe açık ve denetimde saklanıyor.
 */
export function notGirdisi(x: unknown): { tur: NotTuru; metin: string } | { hata: 'NOT_TURU' | 'NOT_BOS' | 'NOT_UZUN' | 'NOT_KART' } {
  const o = (x ?? {}) as { tur?: unknown; metin?: unknown };
  const tur = NOT_TURLERI.find((t) => t === o.tur);
  if (!tur) return { hata: 'NOT_TURU' };
  const metin = typeof o.metin === 'string' ? o.metin.trim() : '';
  if (!metin) return { hata: 'NOT_BOS' };
  if (metin.length > NOT_EN_UZUN) return { hata: 'NOT_UZUN' };
  if (/(?:\d[ -]?){13,19}/.test(metin)) return { hata: 'NOT_KART' };
  return { tur, metin };
}

/**
 * Takip değişikliği: sorumlu (SuperAdmin id ya da null) ve sonraki temas
 * ('YYYY-MM-DD' ya da null). Gönderilmeyen alan değişmez (undefined).
 */
export function takipGirdisi(
  x: unknown,
): { sorumluId?: string | null; sonrakiTemas?: Date | null } | { hata: 'TAKIP_GECERSIZ' } {
  const o = (x ?? {}) as { sorumluId?: unknown; sonrakiTemas?: unknown };
  const out: { sorumluId?: string | null; sonrakiTemas?: Date | null } = {};
  if ('sorumluId' in o) {
    if (o.sorumluId === null || o.sorumluId === '') out.sorumluId = null;
    else if (typeof o.sorumluId === 'string' && o.sorumluId.length <= 64) out.sorumluId = o.sorumluId;
    else return { hata: 'TAKIP_GECERSIZ' };
  }
  if ('sonrakiTemas' in o) {
    if (o.sonrakiTemas === null || o.sonrakiTemas === '') out.sonrakiTemas = null;
    else {
      const d = typeof o.sonrakiTemas === 'string' ? gunOku(o.sonrakiTemas) : null;
      if (!d) return { hata: 'TAKIP_GECERSIZ' };
      out.sonrakiTemas = d;
    }
  }
  if (!('sorumluId' in out) && !('sonrakiTemas' in out)) return { hata: 'TAKIP_GECERSIZ' };
  return out;
}

/**
 * wa.me bağlantısı — yalnız Türkiye cep numarası (sabit hatta WhatsApp yok).
 * Tek tek açılır, toplu gönderim YOK: mesaj kişiye özel ve ekip göndermeden okur.
 */
export function waAdresi(telefon: string | null | undefined, metin: string): string | null {
  if (!telefon) return null;
  let d = telefon.replace(/\D/g, '');
  if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  if (!/^905\d{9}$/.test(d)) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(metin)}`;
}
