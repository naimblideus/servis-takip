/**
 * "O AN" — ödeyen bayilerin ilk 7 günde ne yaptığı ve haftalık tek sayı.
 *
 * Büyüyen her üründe kullanıcının "bu ne?"den "buna ihtiyacım var"a geçtiği
 * bir an var (Facebook: ilk 10 günde 7 arkadaş). O anı tahminle seçmiyoruz:
 * ödeyenlerin ilk 7 günde yaptığı işlerle ödemeyenlerinkini yan yana koyup
 * en çok ayıran işi buluyoruz. Sonra tek sayı izliyoruz: her hafta açılan
 * hesapların yüzde kaçı ilk 7 günde o ana vardı. Kurulumda yaptığımız her
 * değişiklik bu sayıyı ya artırır ya artırmaz; başka türlü göremeyiz.
 *
 * Saf dosya: veritabanı yok, saat dışarıdan gelir (scripts/test-aktivasyon-an).
 * Veriyi lib/aktivasyon-an-veri.ts toplar.
 */

export const PENCERE_GUN = 7;
/** Ödeyen bundan azsa tablo kesin cevap değil, ipucudur; ekran bunu söyler. */
export const AZ_ODEYEN = 10;
const GUN = 86_400_000;
/** Türkiye 2016'dan beri sabit UTC+3 (yaz saati yok): hafta Pazartesi 00:00 İstanbul. */
const TR_FARK = 3 * 3_600_000;

/** İlk 7 günde sayılan kayıtlar. */
export type SayiKodu = 'giris' | 'musteri' | 'cihaz' | 'okuma' | 'fis' | 'kullanici' | 'stok' | 'fatura' | 'tahsilat';

export const IS_KODLARI = [
  'GIRIS',
  'MUSTERI',
  'CIHAZ',
  'CIHAZ_10',
  'SAYAC',
  'SAYAC_10',
  'FIS',
  'EKIP',
  'STOK',
  'FATURA',
  'TAHSILAT',
] as const;
export type IsKodu = (typeof IS_KODLARI)[number];

/** Her iş hangi sayıya bakar ve kaçta "yaptı" sayılır. "10+" satırları Facebook'un "7 arkadaş"ı gibi eşikli. */
const ESIK: Record<IsKodu, { sayi: SayiKodu; en: number }> = {
  GIRIS: { sayi: 'giris', en: 1 },
  MUSTERI: { sayi: 'musteri', en: 1 },
  CIHAZ: { sayi: 'cihaz', en: 1 },
  CIHAZ_10: { sayi: 'cihaz', en: 10 },
  SAYAC: { sayi: 'okuma', en: 1 },
  SAYAC_10: { sayi: 'okuma', en: 10 },
  FIS: { sayi: 'fis', en: 1 },
  // Bayiyi açan kişi + en az bir kişi daha (davet edilmiş olması yeter).
  EKIP: { sayi: 'kullanici', en: 2 },
  STOK: { sayi: 'stok', en: 1 },
  FATURA: { sayi: 'fatura', en: 1 },
  TAHSILAT: { sayi: 'tahsilat', en: 1 },
};

/** Karşılaştırma yapılamazken (ödeyen ya da ödemeyen yok) varsayılan an: Kaçan Gelir'de rakam sayaçla çıkar. */
export const VARSAYILAN_AN: IsKodu = 'SAYAC';

export function isKoduMu(s: unknown): s is IsKodu {
  return typeof s === 'string' && (IS_KODLARI as readonly string[]).includes(s);
}

export interface AnHesabi {
  acilis: Date;
  denemeBitis: Date | null;
  plan: string;
  odedi: boolean;
  /** İlk 7 günde yapılan iş sayıları. */
  ilk7: Partial<Record<SayiKodu, number>>;
}

export type Grup = 'ODEYEN' | 'ODEMEYEN' | 'BELIRSIZ';

/** Hesabın ilk 7 günü bitti mi? Bitmediyse "yapmadı" demek erken. */
export function pencereBitti(h: Pick<AnHesabi, 'acilis'>, simdi: Date): boolean {
  return h.acilis.getTime() + PENCERE_GUN * GUN <= simdi.getTime();
}

/**
 * Ödeyen: bize ödemesi kayıtlı. Ödemeyen: denemesi bitmiş ve ödememiş.
 * Hâlâ denemede olan ya da elle pakete alınmış ama ödemesi yazılmamış hesap
 * BELİRSİZ: ikisine de katılmaz, yoksa "ödemedi" sayısı şişer.
 */
export function grupBul(h: AnHesabi, simdi: Date): Grup {
  if (!pencereBitti(h, simdi)) return 'BELIRSIZ';
  if (h.odedi) return 'ODEYEN';
  if (h.plan === 'trial' && h.denemeBitis && h.denemeBitis.getTime() < simdi.getTime()) return 'ODEMEYEN';
  return 'BELIRSIZ';
}

export function isYapti(h: Pick<AnHesabi, 'ilk7'>, kod: IsKodu): boolean {
  const e = ESIK[kod];
  return (h.ilk7[e.sayi] ?? 0) >= e.en;
}

export interface TabloSatiri {
  kod: IsKodu;
  /** Yüzde, tam sayı; grup boşsa null. */
  odeyen: number | null;
  odemeyen: number | null;
  /** Yüzde puanı farkı (ödeyen − ödemeyen); karşılaştırılamıyorsa null. */
  fark: number | null;
}

export interface OdeyenTablosu {
  odeyenN: number;
  odemeyenN: number;
  /** Fark büyükten küçüğe; karşılaştırılamıyorsa iş sırası. */
  satirlar: TabloSatiri[];
  /** Farkı en büyük iş; hiçbir iş ödeyeni ayırmıyorsa ya da karşılaştırılamıyorsa null. */
  an: IsKodu | null;
}

const oran = (pay: number, payda: number) => (payda > 0 ? pay / payda : null);
const yuzde = (o: number | null) => (o == null ? null : Math.round(o * 100));

export function odeyenlerTablosu(hesaplar: AnHesabi[], simdi: Date): OdeyenTablosu {
  const odeyen = hesaplar.filter((h) => grupBul(h, simdi) === 'ODEYEN');
  const odemeyen = hesaplar.filter((h) => grupBul(h, simdi) === 'ODEMEYEN');
  const karsilastirilir = odeyen.length > 0 && odemeyen.length > 0;

  const ham = IS_KODLARI.map((kod, sira) => {
    const a = oran(odeyen.filter((h) => isYapti(h, kod)).length, odeyen.length);
    const b = oran(odemeyen.filter((h) => isYapti(h, kod)).length, odemeyen.length);
    return { kod, sira, a, b, f: a != null && b != null ? a - b : null };
  });
  // Sıralama yuvarlanmamış farkla: %33,4 ile %33,2 ekranda eşit görünse de ayrılır.
  if (karsilastirilir) ham.sort((x, y) => y.f! - x.f! || x.sira - y.sira);

  const satirlar = ham.map((s) => ({
    kod: s.kod,
    odeyen: yuzde(s.a),
    odemeyen: yuzde(s.b),
    fark: s.f == null ? null : Math.round(s.f * 100),
  }));
  const an = karsilastirilir && ham[0].f! > 0 ? ham[0].kod : null;
  return { odeyenN: odeyen.length, odemeyenN: odemeyen.length, satirlar, an };
}

/** Bir anın İstanbul'daki haftasının Pazartesi'si, 'YYYY-AA-GG'. */
export function haftaBasi(t: Date): string {
  const yerel = new Date(t.getTime() + TR_FARK);
  const geri = (yerel.getUTCDay() + 6) % 7; // Pazartesi 0 … Pazar 6
  const pzt = new Date(Date.UTC(yerel.getUTCFullYear(), yerel.getUTCMonth(), yerel.getUTCDate() - geri));
  return pzt.toISOString().slice(0, 10);
}

export interface HaftaSatiri {
  /** Haftanın Pazartesi'si, 'YYYY-AA-GG'. */
  hafta: string;
  acilan: number;
  varan: number;
  yuzde: number | null;
  /** Bu hafta açılan bir hesabın 7 günü henüz dolmadı: sayı artabilir. */
  suruyor: boolean;
}

/** Son `kac` hafta, eskiden yeniye (bu hafta en sağda). Ödeyen-ödemeyen ayrımı yok: herkes sayılır. */
export function haftalikOran(hesaplar: AnHesabi[], an: IsKodu, simdi: Date, kac = 8): HaftaSatiri[] {
  const bu = haftaBasi(simdi);
  const buGun = Date.parse(`${bu}T00:00:00Z`);
  const haftalar: HaftaSatiri[] = [];
  const dizin = new Map<string, HaftaSatiri>();
  for (let i = kac - 1; i >= 0; i--) {
    const h = new Date(buGun - i * PENCERE_GUN * GUN).toISOString().slice(0, 10);
    const satir: HaftaSatiri = { hafta: h, acilan: 0, varan: 0, yuzde: null, suruyor: false };
    haftalar.push(satir);
    dizin.set(h, satir);
  }
  for (const h of hesaplar) {
    const s = dizin.get(haftaBasi(h.acilis));
    if (!s) continue;
    s.acilan++;
    if (isYapti(h, an)) s.varan++;
    if (!pencereBitti(h, simdi)) s.suruyor = true;
  }
  for (const s of haftalar) s.yuzde = yuzde(oran(s.varan, s.acilan));
  return haftalar;
}

/** Tepedeki tek sayı: 7 günü dolmuş, hesap açılmış en son hafta. */
export function sonBitenHafta(haftalar: HaftaSatiri[]): HaftaSatiri | null {
  for (let i = haftalar.length - 1; i >= 0; i--) {
    if (!haftalar[i].suruyor && haftalar[i].acilan > 0) return haftalar[i];
  }
  return null;
}
