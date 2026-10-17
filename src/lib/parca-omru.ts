/**
 * PARÇA ÖMRÜ — drum, fırın, bakım kiti: hangisi ne zaman bitiyor.
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Büyük filoda drum, fırın ve bakım kitinin ömrü dolunca önce kalite
 * şikâyeti, sonra arıza gelir: acil servis, ikinci ziyaret, SLA ihlali.
 * Planlı değişimde aynı parça bir sonraki rutin ziyarette takılır ve stokta
 * hazır bekler. Rakipler bunun için parça tanımlarını tek tek elle
 * girdiriyor. Burada iki kaynak var; ikisi de ek veri girişi istemiyor:
 *
 *   1. CİHAZIN KENDİSİ. Ağ tarayıcısı bağlı yazıcı, sarf tablosunda drum,
 *      fırın, bakım kiti ve atık kutusunun kalan yüzdesini zaten söylüyor
 *      (Device.olcumSarf, tur PARCA). Kurulum yok, tanım yok.
 *   2. SAYAÇ. Söylemeyen cihazda parça kartına ömür (sayfa) yazılırsa,
 *      fişte takıldığı andaki sayaçtan (TicketPart.takilmaSayaci) bu yana
 *      basılan sayfa sayılır. Kart başına bir kez yazılır; o parçanın
 *      takıldığı bütün cihazlara kendiliğinden uygulanır.
 *
 * ── UYDURMUYORUZ ─────────────────────────────────────────────────────────
 *   · Üreticinin ömrünü biz yazmayız: bayi kartına yazar ya da cihaz söyler.
 *   · Takıldığı sayaç kayıtlı değilse (alan eklenmeden önceki fiş) fişin
 *     tarihine en yakın okumadan YAKLAŞIK hesaplanır ve ekranda "yaklaşık"
 *     yazar; o yakınlıkta okuma yoksa "bilinmiyor" der, sayı uydurmaz.
 *   · Gün TAHMİNDİR: son 90 günün sayfa hızından. Hız yoksa gün yazılmaz.
 *   · Cihazın kendi ölçümü sayaç hesabının ÖNÜNE geçer, ikisi karıştırılmaz:
 *     sayaç hesabı "takıldığından beri basılan ÷ ömür" der ve parça yarıda
 *     değiştiyse ya da müşteri yoğun kapsamlı basıyorsa yanılır; cihazın
 *     ölçümü bunlardan etkilenmez. Sayaç hesabı o satırın ayrıntısında kalır.
 *
 * Bu dosya SAFtır: React yok, Prisma yok. Veritabanı işleri parca-omru-veri.ts.
 */
import { dailyRate } from '@/lib/toner';
import { PARCA_KRITIK } from '@/lib/sayac-tarama';
import { katla } from '@/lib/tr-katla';

const GUN_MS = 86_400_000;

// ── EŞİKLER ──────────────────────────────────────────────────────────────

/**
 * Kalan bu yüzde ve altındaysa KRİTİK: parça bir sonraki ziyarette değişmeli.
 * Ağ Tarayıcı ve cihaz kartındaki eşikle AYNI sayı (sayac-tarama
 * PARCA_KRITIK); iki ekran aynı drum için farklı renk göstermesin.
 */
export const KRITIK_YUZDE = PARCA_KRITIK;
/** Kalan bu yüzde ve altındaysa YAKINDA: rotaya ve sipariş listesine girmeli. */
export const YAKINDA_YUZDE = 20;
/**
 * "Önümüzdeki 30 gün": tepedeki sayı ve stok ihtiyacı bu ufka göre.
 * Tedarikçiden parçanın gelmesi + bir rutin ziyaret turu ≈ bir ay.
 */
export const UFUK_GUN = 30;
/**
 * Günlük sayfa hızı bu kadar günlük okumadan. Üç ay: tek bir yoğun hafta
 * tahmini şişirmesin, mevsimsel değişim de aylarca geç yansımasın.
 */
export const HIZ_PENCERESI_GUN = 90;
/**
 * Cihazın ölçümü bundan eskiyse "eski ölçüm" yazılır: tarayıcı o makineyi
 * bir aydır görmüyor, yüzde o günden bu yana düştü.
 */
export const ESKI_OLCUM_GUN = 30;
/**
 * Takılma sayacı kayıtlı olmayan eski fişte en yakın okuma bundan uzaksa
 * yaklaşık hesap YAPILMAZ: 45 günden büyük kayma, günde yüzlerce sayfa
 * basan makinede on binlerce sayfalık hata demek — "yaklaşık" bile değil.
 */
export const YAKLASIK_EN_FAZLA_GUN = 45;
/**
 * Kartta kabul edilen en uzun ömür. Üretim makinelerinin transfer kayışı
 * bile birkaç milyon sayfa; ondan büyük sayı yazım hatasıdır.
 */
export const EN_FAZLA_OMUR = 10_000_000;
/** Ekranda ilk gösterilen satır sayısı (en acilden); "Tümü" hepsini getirir. */
export const ILK_SATIR = 200;

// ── TÜRLER ───────────────────────────────────────────────────────────────

/** Parçanın makinedeki yeri. Cihazın bildirdiği kalemle stok kartını eşlemek için. */
export type ParcaTuru = 'DRUM' | 'FIRIN' | 'BAKIM' | 'ATIK' | 'GELISTIRICI' | 'KAYIS' | 'MERDANE';
export type ParcaRengi = 'K' | 'C' | 'M' | 'Y';
export type OmurDurumu = 'KRITIK' | 'YAKINDA' | 'IYI' | 'BILINMIYOR';
export type OmurKaynagi = 'CIHAZ' | 'SAYAC';
/** Hesap yapılamadıysa NEDEN — ekran bayiye ne eksik olduğunu söyler. */
export type BilinmiyorSebebi =
  | 'SAYAC_YOK'       // cihazın hiç sayacı yok
  | 'BASLANGIC_YOK'   // parçanın takıldığı sayaç bilinmiyor
  | 'SAYAC_GERILEDI'; // şimdiki sayaç takıldığı sayaçtan düşük: sayaç sıfırlanmış ya da makine değişmiş

export interface Sayac { counterBlack: number | null | undefined; counterColor: number | null | undefined }
export interface SayacNoktasi { readingDate: Date | string; counterBlack: number; counterColor: number }

// ── GİRDİ ────────────────────────────────────────────────────────────────

export type OmurAyiklama = { gecerli: true; deger: number | null } | { gecerli: false };

/**
 * Parça kartından gelen ömür. Boş = izlenmiyor (null). Yalnız tam sayı
 * kabul edilir: "100.000" gibi ayraçlı metin REDDEDİLİR — Number("100.000")
 * 100 eder ve drum 100 sayfada "doldu" görünürdü.
 */
export function omurSayfaAyikla(v: unknown): OmurAyiklama {
  if (v === null || v === undefined) return { gecerli: true, deger: null };
  if (typeof v === 'string' && v.trim() === '') return { gecerli: true, deger: null };
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\s*\d+\s*$/.test(v)) n = Number(v);
  else return { gecerli: false };
  if (!Number.isInteger(n) || n < 1 || n > EN_FAZLA_OMUR) return { gecerli: false };
  return { gecerli: true, deger: n };
}

// ── SAYAÇ ────────────────────────────────────────────────────────────────

/**
 * Toplam sayaç (siyah + renkli). Sıfır ya da eksi BİLİNMİYOR sayılır: boş
 * kartta 0 yer tutucudur ve 0'dan sayılan bir ömür ilk okumada "doldu" der.
 */
export function toplamSayac(o: Sayac | null | undefined): number | null {
  if (!o) return null;
  const s = (o.counterBlack ?? 0) + (o.counterColor ?? 0);
  return Number.isFinite(s) && s > 0 ? Math.round(s) : null;
}

/**
 * Parça fişe eklenirken yazılacak takılma sayacı.
 *   1. Fişin kendi okuması (birden çoksa en yenisi, işin sonundaki sayaç):
 *      parça fişe ertesi gün ofisten girilse de takıldığı an o ziyarettir;
 *      o arada tarayıcıdan gelen okumalar parçanın ömründen düşülmemeli.
 *   2. Yoksa cihazın son bilinen sayacı: son okuma, okuma hiç yoksa kart.
 *   3. O da yoksa null. Uydurulmuş bir başlangıç bütün hesabı kaydırır;
 *      null kalan kayıt ekranda en yakın okumadan "yaklaşık" hesaplanır.
 * Yalnız ömürlü parçalarda değil HER parçada yazılır: kartına sonradan
 * ömür girilirse geçmişi hazır olsun.
 */
export function takilmaSayaciSec(k: { fisOkumasi?: Sayac | null; sonOkuma?: Sayac | null; kart?: Sayac | null }): number | null {
  return toplamSayac(k.fisOkumasi) ?? toplamSayac(k.sonOkuma) ?? toplamSayac(k.kart);
}

/**
 * Günlük ortalama TOPLAM sayfa — son HIZ_PENCERESI_GUN günün okumalarından.
 * Toner ve bakım ekranıyla AYNI formül (lib/toner dailyRate): iki ekran
 * aynı makine için farklı hız söylemesin. Toplam, çünkü drum ve fırın
 * siyah/renkli ayırmadan her sayfada aşınır. Pencerede iki okuma yoksa null.
 */
export function gunlukSayfa(okumalar: readonly SayacNoktasi[], bugun: Date): number | null {
  const bas = bugun.getTime() - HIZ_PENCERESI_GUN * GUN_MS;
  const son = bugun.getTime() + GUN_MS;
  const icinde = okumalar
    .filter((o) => {
      const t = new Date(o.readingDate).getTime();
      return Number.isFinite(t) && t >= bas && t <= son;
    })
    .map((o) => ({ readingDate: o.readingDate, counterBlack: o.counterBlack + o.counterColor, counterColor: 0 }));
  return dailyRate(icinde, 'black');
}

/**
 * Takılma noktası: kayıtlıysa o (kesin). Değilse fişin tarihine EN YAKIN
 * okuma (yaklaşık) — eşitlikte önceki okuma seçilir: takılmadan önce basılanı
 * da saymak ömrü kısa gösterir, yani uyarı erken gelir (güvenli taraf).
 * O yakınlıkta okuma yoksa sayaç null: "bilinmiyor".
 */
export function takilmaNoktasi(
  kayitli: number | null | undefined, fisTarihi: Date, adaylar: readonly SayacNoktasi[],
): { sayac: number | null; yaklasik: boolean } {
  if (typeof kayitli === 'number' && Number.isFinite(kayitli) && kayitli > 0) return { sayac: Math.round(kayitli), yaklasik: false };
  const an = fisTarihi.getTime();
  let en: { fark: number; sayac: number } | null = null;
  for (const o of adaylar) {
    const sayac = toplamSayac(o);
    const t = new Date(o.readingDate).getTime();
    if (sayac === null || !Number.isFinite(t)) continue;
    const fark = Math.abs(t - an);
    if (!en || fark < en.fark || (fark === en.fark && t <= an)) en = { fark, sayac };
  }
  if (!en || en.fark > YAKLASIK_EN_FAZLA_GUN * GUN_MS) return { sayac: null, yaklasik: true };
  return { sayac: en.sayac, yaklasik: true };
}

// ── PARÇA TÜRÜ VE RENGİ ──────────────────────────────────────────────────
// Ad, Türkçe güvenli katlanarak (tr-katla) okunur: "FIRIN ÜNİTESİ" ile
// "fuser unit" aynı yere düşer; `/i` bayrağı "İ"yi katlamıyor.

const TUR_KALIPLARI: readonly [ParcaTuru, RegExp][] = [
  // "Waste Toner Box": adında toner geçse de atık kutusudur — önce bakılır.
  ['ATIK', /waste|atik/],
  // "Fuser Maintenance Kit": takılan birim bakım kitidir, fırından önce.
  ['BAKIM', /maintenance|bakim/],
  // Canon fırına "Fixing Assembly" der.
  ['FIRIN', /fuser|firin|fixing/],
  ['DRUM', /drum|imaging|tambur|photoconductor|\bopc\b|\bdram\b/],
  ['GELISTIRICI', /developer|gelistirici/],
  ['KAYIS', /belt|kayis/],
  // "Transfer Rulosu" kayış değil merdane: kayıştan SONRA bakılır, kayış
  // kalıbı yalnız "belt/kayış" der.
  ['MERDANE', /roller|merdane|paten|\brulo|pick ?up/],
];

/** Parçanın türü — önce adından, ad bir şey söylemiyorsa stok grubundan. Bilinmiyorsa null. */
export function parcaTuru(ad: string | null | undefined, grup?: string | null): ParcaTuru | null {
  const k = katla(ad);
  for (const [tur, kalip] of TUR_KALIPLARI) if (kalip.test(k)) return tur;
  if (grup === 'DRUM') return 'DRUM';
  if (grup === 'FUSER') return 'FIRIN';
  if (grup === 'ROLLER') return 'MERDANE';
  return null;
}

// Tek harf (K, C...) BİLEREK aranmıyor: "C-EXV49" kodundaki C camgöbeği sanılırdı.
const RENK_KALIPLARI: readonly [ParcaRengi, RegExp][] = [
  ['K', /black|siyah|schwarz|noir/],
  ['C', /cyan|camgobegi/],
  ['M', /magenta|macenta/],
  ['Y', /yellow|\bsari\b/],
];

export function parcaRengi(ad: string | null | undefined): ParcaRengi | null {
  const k = katla(ad);
  for (const [renk, kalip] of RENK_KALIPLARI) if (kalip.test(k)) return renk;
  return null;
}

export interface Yuva { tur: ParcaTuru | null; renk: ParcaRengi | null }

/** İki parça makinede aynı yere mi takılır: aynı tür, renkleri çelişmiyor. */
export function ayniYuva(a: Yuva, b: Yuva): boolean {
  return a.tur !== null && a.tur === b.tur && (a.renk === null || b.renk === null || a.renk === b.renk);
}

export function yuvaBul(ad: string | null | undefined, grup?: string | null): Yuva {
  return { tur: parcaTuru(ad, grup), renk: parcaRengi(ad) };
}

/**
 * Plânlı değişim fişinin arıza kategorisi. Ömrü dolan parçayı değiştirmek
 * ARIZA DEĞİLDİR, kullanıma bağlı sarf değişimidir: DRUM/FUSER (arıza)
 * seçilseydi model güvenilirlik raporu planlı her değişimi arıza sayardı.
 * Bakım kiti takvimli bakımın kendisidir.
 */
export function planliKategori(tur: ParcaTuru | null): 'CONSUMABLE' | 'PERIODIC_MAINTENANCE' {
  return tur === 'BAKIM' ? 'PERIODIC_MAINTENANCE' : 'CONSUMABLE';
}

/** Aynı model mi: marka + model, harf/boşluk farkı gözetmeden. */
export function modelAnahtari(marka: string | null | undefined, model: string | null | undefined): string {
  const sade = (s: string | null | undefined) => katla(s).replace(/[\s._/-]+/g, ' ').trim();
  return `${sade(marka)}|${sade(model)}`;
}

// ── DEĞİŞİM ZİNCİRİ ──────────────────────────────────────────────────────

/** Fişte takılmış, kartında ömür yazılı bir parça. */
export interface Takilis {
  /** TicketPart kimliği. */
  id: string;
  deviceId: string;
  partId: string;
  parcaAdi: string;
  grup: string | null;
  /** Kartın ömrü (sayfa, > 0). */
  omurSayfa: number;
  adet: number;
  /** Kayıtlı takılma sayacı; null = alan eklenmeden önceki fiş. */
  takilmaSayaci: number | null;
  fisId: string;
  fisNo: string;
  /** Fişin tarihi: zincirin sırası ve yaklaşık hesap buna göre. */
  fisTarihi: Date;
  /** Parçanın fişe eklendiği an (aynı fişte iki kayıt varsa sıra için). */
  parcaTarihi: Date;
  marka?: string | null;
  model?: string | null;
}

const yeniOnce = (a: Takilis, b: Takilis) =>
  (b.fisTarihi.getTime() - a.fisTarihi.getTime())
  || (b.parcaTarihi.getTime() - a.parcaTarihi.getTime())
  || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/**
 * Her cihazın her yuvasında EN SON takılan ömürlü parça. Daha yenisi
 * takıldıysa eskisi değişmiş sayılır ve listeye girmez — yoksa iki yıl önce
 * çıkarılmış bir drum "ömrü çoktan doldu" diye her gün kırmızı yanardı.
 *
 * "Yuva": türü bilinen parçada aynı tür ve renk. Orijinal kartın yerine
 * muadil kart takılınca da eskisi değişmiş sayılır. Türü bilinmeyen parçada
 * yalnız aynı kart. Kartında ömür YAZILMAMIŞ parçalar (fırın film kılıfı,
 * paten) zincire hiç girmez: alt parça değişimi ünitenin ömrünü sıfırlamaz.
 */
export function sonTakilislar<T extends Takilis>(liste: readonly T[]): T[] {
  const sirali = [...liste].sort(yeniOnce);
  const tutulan: T[] = [];
  const cihazda = new Map<string, { t: T; yuva: Yuva }[]>();
  for (const t of sirali) {
    const yuva = yuvaBul(t.parcaAdi, t.grup);
    const yeniler = cihazda.get(t.deviceId) ?? [];
    if (yeniler.some((y) => y.t.partId === t.partId || ayniYuva(yuva, y.yuva))) continue;
    yeniler.push({ t, yuva });
    cihazda.set(t.deviceId, yeniler);
    tutulan.push(t);
  }
  return tutulan;
}

// ── HESAP ────────────────────────────────────────────────────────────────

export interface OmurHesabi {
  /** Kalan yüzde, 0–100. Hesaplanamadıysa null. */
  yuzde: number | null;
  /** Kalan sayfa. Eksi = ömür aşıldı. Bilinmiyorsa null. */
  kalanSayfa: number | null;
  /** Tahmini gün (sayfa hızından). Eksi = o kadar gün önce doldu. Hız yoksa null. */
  gun: number | null;
  durum: OmurDurumu;
  sebep: BilinmiyorSebebi | null;
}

const bilinmiyor = (sebep: BilinmiyorSebebi): OmurHesabi =>
  ({ yuzde: null, kalanSayfa: null, gun: null, durum: 'BILINMIYOR', sebep });

/**
 * Durum: KRİTİK = kalan ≤ %10 ya da ömür doldu; YAKINDA = kalan ≤ %20 ya da
 * tahmini gün ≤ 30 (çok basan makinede yüzde yüksek görünse de tarih yakın);
 * gerisi İYİ. Yüzde yoksa BİLİNMİYOR — yeşil GÖSTERİLMEZ.
 */
export function durumBul(yuzde: number | null, gun: number | null, kalanSayfa?: number | null): OmurDurumu {
  if (yuzde === null) return 'BILINMIYOR';
  if (yuzde <= KRITIK_YUZDE || (kalanSayfa != null && kalanSayfa <= 0) || (gun !== null && gun <= 0)) return 'KRITIK';
  if (yuzde <= YAKINDA_YUZDE || (gun !== null && gun <= UFUK_GUN)) return 'YAKINDA';
  return 'IYI';
}

/** Sayaçtan: takıldığından beri basılan sayfa ömürden düşülür. */
export function sayactanHesap(g: { omurSayfa: number; takilma: number | null; guncel: number | null; gunluk: number | null }): OmurHesabi {
  if (g.guncel === null) return bilinmiyor('SAYAC_YOK');
  if (g.takilma === null) return bilinmiyor('BASLANGIC_YOK');
  const kullanilan = g.guncel - g.takilma;
  // Sayaç geriye gitmiş: makine değişmiş ya da sayaç sıfırlanmış. "Hiç
  // basılmamış" demek de "bilmem kaç sayfa" demek de uydurmak olurdu.
  if (kullanilan < 0) return bilinmiyor('SAYAC_GERILEDI');
  const kalanSayfa = g.omurSayfa - kullanilan;
  const yuzde = Math.max(0, Math.min(100, Math.round((kalanSayfa / g.omurSayfa) * 100)));
  const gun = g.gunluk && g.gunluk > 0 ? Math.floor(kalanSayfa / g.gunluk) : null;
  return { yuzde, kalanSayfa, gun, durum: durumBul(yuzde, gun, kalanSayfa), sebep: null };
}

/**
 * Cihazdan: yüzde cihazın KENDİ ölçümü. Kartın ömrü biliniyorsa kalan
 * sayfa ve gün bundan TAHMİN edilir; bilinmiyorsa yalnız yüzde (gün uydurulmaz).
 */
export function cihazdanHesap(g: { yuzde: number; omurSayfa: number | null; gunluk: number | null }): OmurHesabi {
  const yuzde = Math.max(0, Math.min(100, Math.round(g.yuzde)));
  const kalanSayfa = g.omurSayfa && g.omurSayfa > 0 ? Math.round((g.omurSayfa * yuzde) / 100) : null;
  const gun = kalanSayfa !== null && g.gunluk && g.gunluk > 0 ? Math.floor(kalanSayfa / g.gunluk) : null;
  return { yuzde, kalanSayfa, gun, durum: durumBul(yuzde, gun, kalanSayfa), sebep: null };
}

/**
 * Önümüzdeki UFUK_GUN içinde mi? Gün tahmini varsa ona göre. Yoksa cihazın
 * kendisi kritik bildiriyorsa (≤ %10) sayılır: gün bilinmese de makine
 * "bitmek üzere" diyor. Ekran bu ikinci grubun sayısını ayrıca yazar.
 */
export function ufuktaMi(h: Pick<OmurHesabi, 'durum' | 'gun' | 'yuzde'>): boolean {
  if (h.durum === 'BILINMIYOR' || h.yuzde === null) return false;
  return h.gun !== null ? h.gun <= UFUK_GUN : h.yuzde <= KRITIK_YUZDE;
}

// ── BİRLEŞTİRME ──────────────────────────────────────────────────────────

export interface CihazGirdisi {
  deviceId: string;
  marka: string;
  model: string;
  seri: string;
  publicCode: string;
  konum: string | null;
  musteriId: string | null;
  musteri: string | null;
  /** Şimdiki toplam sayaç: son okuma, okuma yoksa kart. */
  guncelSayac: number | null;
  /** Son okumanın tarihi (ISO); sayaç karttan geldiyse null. */
  sayacTarihi: string | null;
  gunlukSayfa: number | null;
  olcumAt: Date | null;
  /** Cihazın bildirdiği PARÇA kalemleri (toner değil). */
  kalemler: readonly { ad: string; yuzde: number }[];
}

export interface CozulmusTakilis extends Takilis {
  takilma: { sayac: number | null; yaklasik: boolean };
}

export type KartKaynagi = 'BU_CIHAZ' | 'AYNI_MODEL';

export interface OmurSatiri {
  anahtar: string;
  deviceId: string;
  cihaz: { marka: string; model: string; seri: string; publicCode: string; konum: string | null };
  musteri: { id: string; ad: string } | null;
  kaynak: OmurKaynagi;
  /** CİHAZ: cihazın verdiği ad (boş = ad vermedi) · SAYAÇ: kartın adı. */
  parca: string;
  tur: ParcaTuru | null;
  /** Stok kartı — sipariş ve gün tahmini için. Bilinmiyorsa null. */
  kart: { id: string; ad: string; omurSayfa: number; kaynak: KartKaynagi } | null;
  hesap: OmurHesabi;
  ufukta: boolean;
  /** SAYAÇ: takılma sayacı kayıtlı değil, en yakın okumadan. */
  yaklasik: boolean;
  /** CİHAZ: ölçüm ESKI_OLCUM_GUN'den eski. */
  eskiOlcum: boolean;
  olcumAt: string | null;
  /** Bu cihazdaki son takılış (fiş). */
  takilis: { fisId: string; fisNo: string; tarih: string; sayac: number | null; adet: number } | null;
  /** CİHAZ satırında aynı parçanın sayaçtan hesabı — ayrıntı, karıştırılmaz. */
  sayactan: (OmurHesabi & { yaklasik: boolean }) | null;
  gunlukSayfa: number | null;
  guncelSayac: number | null;
  sayacTarihi: string | null;
  /** Fiş açarken önerilen arıza kategorisi. */
  kategori: 'CONSUMABLE' | 'PERIODIC_MAINTENANCE';
}

/** Adaylardan en iyisi: rengi birebir tutan önce, sonra en yeni takılış. */
function enIyiEslesme(yuva: Yuva, adaylar: readonly { t: CozulmusTakilis; yuva: Yuva }[]): CozulmusTakilis | null {
  let en: { t: CozulmusTakilis; birebir: boolean } | null = null;
  for (const a of adaylar) {
    if (!ayniYuva(yuva, a.yuva)) continue;
    const birebir = yuva.renk !== null && yuva.renk === a.yuva.renk;
    if (!en || (birebir && !en.birebir) || (birebir === en.birebir && yeniOnce(a.t, en.t) < 0)) en = { t: a.t, birebir };
  }
  return en?.t ?? null;
}

/**
 * Model düzeyinde kart dizini. Popüler bir modelde binlerce takılış olabilir;
 * her cihaz kalemi için hepsini taramak (5.000 cihaz × binlerce aday) sayfayı
 * yavaşlatırdı. Model + tür + renk başına EN SON takılış bir kez çıkarılır,
 * enIyiEslesme ile aynı tercih kuralı (birebir renk önce, sonra en yeni).
 */
function modelDizini(takilislar: readonly CozulmusTakilis[]) {
  const enSon = new Map<string, CozulmusTakilis>();
  const yaz = (k: string, t: CozulmusTakilis) => { const v = enSon.get(k); if (!v || yeniOnce(t, v) < 0) enSon.set(k, t); };
  for (const t of takilislar) {
    if (t.marka == null || t.model == null) continue;
    const y = yuvaBul(t.parcaAdi, t.grup);
    if (!y.tur) continue;
    const mk = modelAnahtari(t.marka, t.model);
    yaz(`${mk}|${y.tur}|${y.renk ?? '-'}`, t); // bu renk (ya da renksiz)
    yaz(`${mk}|${y.tur}|*`, t);                 // her renk: renk söylemeyen kalem için
  }
  return (marka: string, model: string, yuva: Yuva): CozulmusTakilis | null => {
    if (!yuva.tur) return null;
    const mk = modelAnahtari(marka, model);
    if (yuva.renk === null) return enSon.get(`${mk}|${yuva.tur}|*`) ?? null;
    return enSon.get(`${mk}|${yuva.tur}|${yuva.renk}`) ?? enSon.get(`${mk}|${yuva.tur}|-`) ?? null;
  };
}

/**
 * Bütün satırlar, aciliyete göre sıralı.
 *
 * Cihaz bir kalemi bildiriyorsa satır CİHAZ'dır; aynı yuvaya fişle takılmış
 * ömürlü parça varsa onun kartı (gün tahmini ve sipariş için) ve sayaç
 * hesabı (ayrıntı) bu satıra bağlanır, ayrıca SAYAÇ satırı ÇIKMAZ — aynı
 * drum iki satırda iki ayrı yüzdeyle görünmesin. Cihazda o yuvaya takılış
 * yoksa aynı modelde en son takılan ömürlü kart kullanılır (yalnız kart:
 * sayaç hesabı başka makinenin değildir). Cihazın bildirmediği takılışlar
 * SAYAÇ satırı olur.
 */
export function omurSatirlari(g: {
  cihazlar: ReadonlyMap<string, CihazGirdisi>;
  /** Zincirden geçmiş (sonTakilislar) ve takılma noktası çözülmüş kayıtlar. */
  takilislar: readonly CozulmusTakilis[];
  bugun: Date;
}): OmurSatiri[] {
  const cihazTakilislari = new Map<string, { t: CozulmusTakilis; yuva: Yuva }[]>();
  for (const t of g.takilislar) {
    const l = cihazTakilislari.get(t.deviceId);
    const k = { t, yuva: yuvaBul(t.parcaAdi, t.grup) };
    if (l) l.push(k); else cihazTakilislari.set(t.deviceId, [k]);
  }
  const modelKarti = modelDizini(g.takilislar);

  const satirlar: OmurSatiri[] = [];
  for (const c of g.cihazlar.values()) {
    const takilislar = cihazTakilislari.get(c.deviceId) ?? [];
    const kullanilan = new Set<string>();
    const ortak = {
      deviceId: c.deviceId,
      cihaz: { marka: c.marka, model: c.model, seri: c.seri, publicCode: c.publicCode, konum: c.konum },
      musteri: c.musteriId ? { id: c.musteriId, ad: c.musteri ?? '' } : null,
      gunlukSayfa: c.gunlukSayfa,
      guncelSayac: c.guncelSayac,
      sayacTarihi: c.sayacTarihi,
    };
    const sayacHesabi = (t: CozulmusTakilis) =>
      sayactanHesap({ omurSayfa: t.omurSayfa, takilma: t.takilma.sayac, guncel: c.guncelSayac, gunluk: c.gunlukSayfa });
    const takilisOzeti = (t: CozulmusTakilis) =>
      ({ fisId: t.fisId, fisNo: t.fisNo, tarih: t.fisTarihi.toISOString(), sayac: t.takilma.sayac, adet: Math.max(1, t.adet) });
    const eskiOlcum = c.olcumAt !== null && g.bugun.getTime() - c.olcumAt.getTime() > ESKI_OLCUM_GUN * GUN_MS;

    c.kalemler.forEach((k, i) => {
      const yuva = yuvaBul(k.ad);
      const eslesen = enIyiEslesme(yuva, takilislar);
      const modelde = eslesen ? null : modelKarti(c.marka, c.model, yuva);
      const kartKaydi = eslesen ?? modelde;
      const kart = kartKaydi
        ? { id: kartKaydi.partId, ad: kartKaydi.parcaAdi, omurSayfa: kartKaydi.omurSayfa, kaynak: (eslesen ? 'BU_CIHAZ' : 'AYNI_MODEL') as KartKaynagi }
        : null;
      if (eslesen) kullanilan.add(eslesen.id);
      const hesap = cihazdanHesap({ yuzde: k.yuzde, omurSayfa: kart?.omurSayfa ?? null, gunluk: c.gunlukSayfa });
      satirlar.push({
        ...ortak,
        anahtar: `${c.deviceId}|c|${i}`,
        kaynak: 'CIHAZ',
        parca: k.ad,
        tur: yuva.tur,
        kart,
        hesap,
        ufukta: ufuktaMi(hesap),
        yaklasik: false,
        eskiOlcum,
        olcumAt: c.olcumAt ? c.olcumAt.toISOString() : null,
        takilis: eslesen ? takilisOzeti(eslesen) : null,
        sayactan: eslesen ? { ...sayacHesabi(eslesen), yaklasik: eslesen.takilma.yaklasik } : null,
        kategori: planliKategori(yuva.tur),
      });
    });

    for (const { t, yuva } of takilislar) {
      if (kullanilan.has(t.id)) continue;
      const hesap = sayacHesabi(t);
      satirlar.push({
        ...ortak,
        anahtar: `${c.deviceId}|s|${t.id}`,
        kaynak: 'SAYAC',
        parca: t.parcaAdi,
        tur: yuva.tur,
        kart: { id: t.partId, ad: t.parcaAdi, omurSayfa: t.omurSayfa, kaynak: 'BU_CIHAZ' },
        hesap,
        ufukta: ufuktaMi(hesap),
        yaklasik: t.takilma.yaklasik,
        eskiOlcum: false,
        olcumAt: null,
        takilis: takilisOzeti(t),
        sayactan: null,
        kategori: planliKategori(yuva.tur),
      });
    }
  }
  return satirlar.sort(aciliyetSirasi);
}

// ── SIRA VE ÖZET ─────────────────────────────────────────────────────────

const DURUM_SIRASI: Record<OmurDurumu, number> = { KRITIK: 0, YAKINDA: 1, IYI: 2, BILINMIYOR: 3 };

/**
 * Sıralamada kullanılan gün (ekranda GÖSTERİLMEZ). Günü bilinmeyen kritik
 * parça "bugün" sayılır, günü bilinmeyen "yakında" parça ufkun sonuna konur:
 * günü belli olanlar arasında bir yere oturmalı, en dibe değil.
 */
function siraGunu(h: OmurHesabi): number {
  if (h.gun !== null) return h.gun;
  if (h.yuzde !== null && h.yuzde <= KRITIK_YUZDE) return 0;
  if (h.yuzde !== null && h.yuzde <= YAKINDA_YUZDE) return UFUK_GUN;
  return 100_000;
}

/** Önce kritik, sonra yakında, iyi, bilinmeyen; her grupta en az gün kalan önce. */
export function aciliyetSirasi(a: OmurSatiri, b: OmurSatiri): number {
  return (DURUM_SIRASI[a.hesap.durum] - DURUM_SIRASI[b.hesap.durum])
    || (siraGunu(a.hesap) - siraGunu(b.hesap))
    || ((a.hesap.yuzde ?? 101) - (b.hesap.yuzde ?? 101))
    || (a.anahtar < b.anahtar ? -1 : a.anahtar > b.anahtar ? 1 : 0);
}

export interface OmurOzeti {
  /** Tepedeki sayı: önümüzdeki 30 günde ömrü dolan (dolmuşlar dahil). */
  ufukta: number;
  /** Bunlardan günü bilinmeyen — cihaz kritik bildirdiği için sayılan. */
  ufuktaGunsuz: number;
  /** Ömrü dolmuş olan (kalan ≤ 0 ya da gün ≤ 0). */
  doldu: number;
  kritik: number;
  yakinda: number;
  iyi: number;
  bilinmiyor: number;
  satir: number;
  cihazdan: number;
  sayactan: number;
  /** Satırı olan farklı cihaz sayısı. */
  cihaz: number;
}

export function omurOzeti(satirlar: readonly OmurSatiri[]): OmurOzeti {
  const say = (f: (s: OmurSatiri) => boolean) => satirlar.filter(f).length;
  return {
    ufukta: say((s) => s.ufukta),
    ufuktaGunsuz: say((s) => s.ufukta && s.hesap.gun === null),
    doldu: say((s) => (s.hesap.kalanSayfa !== null && s.hesap.kalanSayfa <= 0) || (s.hesap.gun !== null && s.hesap.gun <= 0) || s.hesap.yuzde === 0),
    kritik: say((s) => s.hesap.durum === 'KRITIK'),
    yakinda: say((s) => s.hesap.durum === 'YAKINDA'),
    iyi: say((s) => s.hesap.durum === 'IYI'),
    bilinmiyor: say((s) => s.hesap.durum === 'BILINMIYOR'),
    satir: satirlar.length,
    cihazdan: say((s) => s.kaynak === 'CIHAZ'),
    sayactan: say((s) => s.kaynak === 'SAYAC'),
    cihaz: new Set(satirlar.map((s) => s.deviceId)).size,
  };
}

// ── STOK İHTİYACI ────────────────────────────────────────────────────────

export interface StokKalemi {
  partId: string;
  ad: string;
  /** Önümüzdeki 30 günde gereken adet. */
  gereken: number;
  stok: number;
  /** Eksik adet (gereken − stok, en az 0). */
  eksik: number;
}

/**
 * Önümüzdeki 30 günde hangi karttan kaç adet gerekiyor, stokta kaç var.
 * Sayaç satırı takıldığı adetle (dört renkli drum seti tek seferde takıldıysa
 * dördü birden biter), cihaz satırı bir adetle sayılır. Kartı belli olmayan
 * satırlar ayrı listede adıyla durur: hangi karttan sipariş verileceğini
 * UYDURMAYIZ.
 */
export function stokIhtiyaci(
  satirlar: readonly OmurSatiri[], stoklar: ReadonlyMap<string, number>,
): { kalemler: StokKalemi[]; kartsiz: { ad: string; adet: number }[] } {
  const kartli = new Map<string, StokKalemi>();
  const kartsiz = new Map<string, { ad: string; adet: number }>();
  for (const s of satirlar) {
    if (!s.ufukta) continue;
    const adet = s.kaynak === 'SAYAC' ? (s.takilis?.adet ?? 1) : 1;
    if (s.kart) {
      const k = kartli.get(s.kart.id) ?? { partId: s.kart.id, ad: s.kart.ad, gereken: 0, stok: stoklar.get(s.kart.id) ?? 0, eksik: 0 };
      k.gereken += adet;
      kartli.set(s.kart.id, k);
    } else {
      const anahtar = katla(s.parca).trim();
      const k = kartsiz.get(anahtar) ?? { ad: s.parca, adet: 0 };
      k.adet += adet;
      kartsiz.set(anahtar, k);
    }
  }
  const kalemler = [...kartli.values()].map((k) => ({ ...k, eksik: Math.max(0, k.gereken - Math.max(0, k.stok)) }));
  kalemler.sort((a, b) => (b.eksik - a.eksik) || (b.gereken - a.gereken) || a.ad.localeCompare(b.ad, 'tr'));
  return { kalemler, kartsiz: [...kartsiz.values()].sort((a, b) => b.adet - a.adet || a.ad.localeCompare(b.ad, 'tr')) };
}

/**
 * Cihazın sarf kayıtlarından (Device.olcumSarf) PARÇA kalemleri. Kayıt
 * eskiyse ya da bozuksa boş liste; olcumParca var ama kalem adı yoksa (eski
 * tarama) adsız tek kalem — ekran "cihaz ad vermedi" der.
 */
export function cihazKalemleri(olcumSarf: unknown, olcumParca: number | null | undefined): { ad: string; yuzde: number }[] {
  const liste = Array.isArray(olcumSarf) ? olcumSarf : [];
  const kalemler: { ad: string; yuzde: number }[] = [];
  for (const x of liste) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (o.tur !== 'PARCA') continue;
    const yuzde = typeof o.yuzde === 'number' && Number.isFinite(o.yuzde) && o.yuzde >= 0 && o.yuzde <= 100 ? o.yuzde : null;
    if (yuzde === null) continue;
    kalemler.push({ ad: typeof o.ad === 'string' ? o.ad.slice(0, 80) : '', yuzde });
  }
  if (!kalemler.length && typeof olcumParca === 'number' && olcumParca >= 0 && olcumParca <= 100) kalemler.push({ ad: '', yuzde: olcumParca });
  return kalemler;
}
