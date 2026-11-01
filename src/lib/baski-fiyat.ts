// BASKI FİYAT MOTORU — saf (veritabanı yok, React yok). Testte doğrudan derlenir.
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// Baskı merkezinde her iş aynı soruyla başlıyor: "fiyatı ne?". Cevap
// tezgahtaki kişinin kafasında: A4 renkli kaç lira, 500 sayfadan sonra kaç,
// spiral 100 yaprağa kadar kaç. Bu motor o listeyi kurala çeviriyor; tezgah,
// sipariş sayfası ve iş ayrıntısı AYNI hesabı kullanıyor. İki yerde iki
// hesap olsaydı müşteri sayfada bir fiyat, tezgahta başka fiyat görürdü.
//
// ── KURALLAR ─────────────────────────────────────────────────────────────
// Tutarlar KURUŞ tam sayı; kayan nokta hatası kalemler toplanırken büyümesin.
//
// Fiyat modeli işin ölçü birimini belirler:
//   SAYFA  baskı yüzü = sayfa × nüsha. Fotokopi, çıktı.
//   ADET   adet. Roll-up, kaşe, laminasyon yaprağı.
//   ALAN   m² = en × boy × adet. Poster, vinil, canvas. Asgari tutar burada önemli.
//   SABIT  adet başı tek fiyat, kademe yok.
// Kademe: toplam miktar >= min olan EN BÜYÜK kademenin birim fiyatı bütün
// miktara uygulanır (500 sayfa ve üstü sayfası 0,80 ₺).
//
// Seçenek kuralı:
//   CARPAN  ana tutarı çarpar (çift yüz ×0,9; mat kâğıt ×1,2).
//   BIRIM   taban başına eklenir: ölçü birimi, nüsha ya da yaprak
//           (kuşgözü nüsha başı, laminasyon yaprak başı). Cilt gibi kalınlığa
//           göre değişen ek işte yaprak aralığına göre fiyat seçilir.
//   SABIT   işe bir kez eklenir (tasarım, acil).
//
// Sayfa sayısı dosyadan gelmediyse sonuç "tahmini"dir: son fiyatı personel
// "Kabul"de onaylar. Müşteri tarayıcısının bildirdiği sayıya körü körüne
// güvenilmez.

export type FiyatModeli = 'SAYFA' | 'ADET' | 'ALAN' | 'SABIT';
export type KuralTuru = 'BIRIM' | 'SABIT' | 'CARPAN';
export type Taban = 'BIRIM' | 'NUSHA' | 'YAPRAK';

export const FIYAT_MODELLERI: readonly FiyatModeli[] = ['SAYFA', 'ADET', 'ALAN', 'SABIT'];
export const KURAL_TURLERI: readonly KuralTuru[] = ['BIRIM', 'SABIT', 'CARPAN'];

export interface Kademe {
  /** Bu miktar ve üstü. İlk kademe 1 olmalı (değilse 1'e çekilir). */
  min: number;
  /** Birim fiyat (kuruş). */
  fiyat: number;
}

/** Yaprak aralığına göre fiyat: nüsha başına yaprak sayısı <= max ise bu değer. */
export interface Aralik {
  max: number;
  deger: number;
}

export interface SecenekDegeri {
  kod: string;
  ad: string;
  tur: KuralTuru;
  /** CARPAN'da çarpan (1 = etkisiz); BIRIM ve SABIT'te kuruş. */
  deger: number;
  /** Yalnız BIRIM: neyin başına eklenir. Verilmezse ölçü birimi. */
  taban?: Taban;
  /** Yalnız BIRIM: yaprak aralığına göre değer (cilt). Verilirse `deger`in yerine geçer. */
  araliklar?: Aralik[];
  /** Çift yüz: yaprak sayısı yarıya iner (laminasyon, cilt kalınlığı). */
  ciftYuz?: boolean;
  varsayilan?: boolean;
}

export interface SecenekGrubu {
  kod: string;
  ad: string;
  /** Zorunlu grupta seçim yoksa varsayılan kullanılır; o da yoksa hata. */
  zorunlu: boolean;
  degerler: SecenekDegeri[];
}

export interface UrunTanimi {
  ad: string;
  fiyatModeli: FiyatModeli;
  kademeler: Kademe[];
  secenekler: SecenekGrubu[];
  /** Asgari iş tutarı (kuruş; girilen fiyatlarla aynı tabanda: kdvDahil ise KDV dahil). */
  minTutar: number;
  /** % */
  kdvOrani: number;
  /** Girilen fiyatlar KDV dahil mi. */
  kdvDahil: boolean;
  /** Toplam bu kuruşun katına YUKARI yuvarlanır (100 = tam lira). 0 = yok. */
  yuvarlama: number;
}

export interface FiyatGirdisi {
  /** Nüsha (SAYFA) ya da adet. */
  adet: number;
  /** SAYFA: bir nüshanın sayfa sayısı. */
  sayfa?: number;
  /** ALAN: santimetre. */
  enCm?: number;
  boyCm?: number;
  /** grup kodu → değer kodu. */
  secimler?: Record<string, string>;
  /** Sayfa sayısı dosyadan mı okundu? Değilse SAYFA modelinde sonuç tahminidir. */
  sayfaDosyadan?: boolean;
}

export type FiyatHatasi = 'ADET_GECERSIZ' | 'SAYFA_GEREKLI' | 'OLCU_GEREKLI' | 'SECENEK_EKSIK' | 'SECENEK_GECERSIZ' | 'FIYAT_YOK';

export interface DokumKalemi {
  /** 'ANA' ana tutar, 'SECENEK' ek, 'ASGARI' asgari tamamlama, 'YUVARLAMA'. */
  tur: 'ANA' | 'SECENEK' | 'ASGARI' | 'YUVARLAMA';
  ad: string;
  tutar: number;
}

export interface FiyatSonucu {
  ok: true;
  /** Ölçü birimi miktarı: yüz, adet ya da m² (m² iki ondalık). */
  miktar: number;
  /** Uygulanan kademe birim fiyatı (kuruş). */
  birimFiyat: number;
  dokum: DokumKalemi[];
  /** KDV hariç / KDV / KDV dahil (kuruş). */
  kdvHaric: number;
  kdv: number;
  toplam: number;
  asgariUygulandi: boolean;
  /** Sayfa sayısı dosyadan gelmedi: personel onaylamalı. */
  tahmini: boolean;
  /** Seçilen değerler: grup kodu → değer (özet ve kayıt için). */
  secilenler: { grup: string; grupAd: string; kod: string; ad: string }[];
}

export type FiyatCevabi = FiyatSonucu | { ok: false; kod: FiyatHatasi; grup?: string };

// ── NORMALLEŞTİRME ───────────────────────────────────────────────────────
// Ürün Json alanlarından geliyor: form, Excel'den yapıştırma, eski kayıt.
// Bozuk değer motoru çökertmesin, sessizce yanlış fiyat da üretmesin.

const sayi = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : NaN);
const kurus = (x: unknown): number => { const n = sayi(x); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };
const yazi = (x: unknown, azami = 80): string => (typeof x === 'string' ? x.trim().slice(0, azami) : '');

export function fiyatModeli(x: unknown): FiyatModeli {
  return (FIYAT_MODELLERI as readonly string[]).includes(x as string) ? (x as FiyatModeli) : 'ADET';
}

export function kademeleriNormallestir(ham: unknown): Kademe[] {
  if (!Array.isArray(ham)) return [];
  // Miktarı okunmayan satır (boş, metin) atılır; fiyatı okunmayan satır 0
  // kalır ve ürünü fiyatsız yapar: yanlış satır sessizce ucuz fiyat vermesin.
  const l = ham
    .filter((k) => Number.isFinite(sayi((k as Kademe)?.min)))
    .map((k) => ({ min: Math.max(1, Math.floor(sayi((k as Kademe).min))), fiyat: kurus((k as Kademe).fiyat) }))
    .sort((a, b) => a.min - b.min);
  // Aynı min iki kez: sonraki geçerli (yapıştırılan listede düzeltme satırı).
  const tekil: Kademe[] = [];
  for (const k of l) {
    if (tekil.length && tekil[tekil.length - 1].min === k.min) tekil[tekil.length - 1] = k;
    else tekil.push(k);
  }
  if (tekil.length) tekil[0] = { ...tekil[0], min: 1 };
  return tekil;
}

function degerNormallestir(ham: unknown): SecenekDegeri | null {
  const d = (ham ?? {}) as Record<string, unknown>;
  const kod = yazi(d.kod, 40);
  if (!kod) return null;
  const tur = (KURAL_TURLERI as readonly string[]).includes(d.tur as string) ? (d.tur as KuralTuru) : 'BIRIM';
  const n = sayi(d.deger);
  const deger = tur === 'CARPAN' ? (Number.isFinite(n) && n > 0 ? n : 1) : kurus(d.deger);
  const out: SecenekDegeri = { kod, ad: yazi(d.ad) || kod, tur, deger };
  if (tur === 'BIRIM' && (d.taban === 'NUSHA' || d.taban === 'YAPRAK')) out.taban = d.taban;
  if (tur === 'BIRIM' && Array.isArray(d.araliklar)) {
    const a = d.araliklar
      .map((x) => ({ max: Math.floor(sayi((x as Aralik)?.max)), deger: kurus((x as Aralik)?.deger) }))
      .filter((x) => x.max > 0)
      .sort((x, y) => x.max - y.max);
    if (a.length) out.araliklar = a;
  }
  if (d.ciftYuz === true) out.ciftYuz = true;
  if (d.varsayilan === true) out.varsayilan = true;
  return out;
}

export function secenekleriNormallestir(ham: unknown): SecenekGrubu[] {
  if (!Array.isArray(ham)) return [];
  const out: SecenekGrubu[] = [];
  for (const g of ham) {
    const r = (g ?? {}) as Record<string, unknown>;
    const kod = yazi(r.kod, 40);
    if (!kod || out.some((x) => x.kod === kod)) continue;
    const degerler: SecenekDegeri[] = [];
    for (const d of Array.isArray(r.degerler) ? r.degerler : []) {
      const n = degerNormallestir(d);
      if (n && !degerler.some((x) => x.kod === n.kod)) degerler.push(n);
    }
    if (!degerler.length) continue;
    // Tek varsayılan: birden çok işaretliyse ilki.
    let goruldu = false;
    for (const d of degerler) { if (d.varsayilan) { if (goruldu) delete d.varsayilan; goruldu = true; } }
    out.push({ kod, ad: yazi(r.ad) || kod, zorunlu: r.zorunlu === true, degerler });
  }
  return out;
}

/** Veritabanı satırından (ya da formdan) güvenli tanım. */
export function urunTanimi(ham: Record<string, unknown>): UrunTanimi {
  const kdv = Math.floor(sayi(ham.kdvOrani));
  const yuv = Math.floor(sayi(ham.yuvarlama));
  return {
    ad: yazi(ham.ad, 120),
    fiyatModeli: fiyatModeli(ham.fiyatModeli),
    kademeler: kademeleriNormallestir(ham.kademeler),
    secenekler: secenekleriNormallestir(ham.secenekler),
    minTutar: kurus(ham.minTutar),
    kdvOrani: kdv >= 0 && kdv <= 100 ? kdv : 20,
    kdvDahil: ham.kdvDahil !== false,
    yuvarlama: yuv > 0 ? yuv : 0,
  };
}

/**
 * Fiyatı girilmiş mi? Hazır şablon fiyatsız gelir; fiyatsız ürün sipariş
 * sayfasında GÖRÜNMEZ ve tezgahta "fiyat girin" der. Sıfır liralık iş
 * çıkmasın.
 */
export function fiyatliMi(u: Pick<UrunTanimi, 'kademeler' | 'secenekler'>): boolean {
  return u.kademeler.length > 0 && u.kademeler.every((k) => k.fiyat > 0) && eksikFiyatlar(u).length === 0;
}

/**
 * Fiyatı girilmemiş ek seçenekler ("Cilt: Spiral"). Fiyatı olmayan değer
 * (ciltsiz, tek yüz) CARPAN 1 olarak yazılır; BIRIM ya da SABIT bir ekin 0
 * olması unutulmuş fiyattır: renkli baskı siyah-beyaz fiyatına giderdi.
 */
export function eksikFiyatlar(u: Pick<UrunTanimi, 'secenekler'>): string[] {
  const out: string[] = [];
  for (const g of u.secenekler) {
    for (const d of g.degerler) {
      if (d.tur === 'CARPAN') continue;
      const bos = d.araliklar ? d.araliklar.some((a) => a.deger <= 0) : d.deger <= 0;
      if (bos) out.push(`${g.ad}: ${d.ad}`);
    }
  }
  return out;
}

// ── HESAP ────────────────────────────────────────────────────────────────

/** Miktara uygulanan kademe (en büyük min <= miktar). */
export function kademeBul(kademeler: readonly Kademe[], miktar: number): Kademe | null {
  let bulunan: Kademe | null = null;
  for (const k of kademeler) if (miktar >= k.min) bulunan = k;
  return bulunan ?? kademeler[0] ?? null;
}

const tamSayi = (x: unknown): number => { const n = sayi(x); return Number.isFinite(n) ? Math.floor(n) : NaN; };

export function fiyatHesapla(u: UrunTanimi, g: FiyatGirdisi): FiyatCevabi {
  const adet = tamSayi(g.adet);
  if (!(adet >= 1) || adet > 1_000_000) return { ok: false, kod: 'ADET_GECERSIZ' };
  if (!fiyatliMi(u)) return { ok: false, kod: 'FIYAT_YOK' };

  // Seçimler: verilen, yoksa varsayılan; zorunlu grupta ikisi de yoksa hata.
  const secilen: { grup: SecenekGrubu; deger: SecenekDegeri }[] = [];
  for (const grup of u.secenekler) {
    const istenen = g.secimler?.[grup.kod];
    let deger: SecenekDegeri | undefined;
    if (istenen) {
      deger = grup.degerler.find((d) => d.kod === istenen);
      if (!deger) return { ok: false, kod: 'SECENEK_GECERSIZ', grup: grup.kod };
    } else {
      deger = grup.degerler.find((d) => d.varsayilan);
      if (!deger && grup.zorunlu) return { ok: false, kod: 'SECENEK_EKSIK', grup: grup.kod };
    }
    if (deger) secilen.push({ grup, deger });
  }
  const ciftYuz = secilen.some((s) => s.deger.ciftYuz);

  // Ölçü birimi.
  let miktar: number;
  let sayfa = 1;
  if (u.fiyatModeli === 'SAYFA') {
    sayfa = tamSayi(g.sayfa);
    if (!(sayfa >= 1) || sayfa > 100_000) return { ok: false, kod: 'SAYFA_GEREKLI' };
    miktar = sayfa * adet;
  } else if (u.fiyatModeli === 'ALAN') {
    const en = sayi(g.enCm), boy = sayi(g.boyCm);
    if (!(en > 0) || !(boy > 0) || en > 10_000 || boy > 10_000) return { ok: false, kod: 'OLCU_GEREKLI' };
    // m², iki ondalık: 85 × 200 cm = 1,70 m².
    miktar = Math.round((en * boy * adet) / 100) / 100;
  } else {
    miktar = adet;
  }
  // Nüsha başına yaprak: çift yüzde yarısı (yukarı).
  const yaprakNusha = u.fiyatModeli === 'SAYFA' ? Math.ceil(sayfa / (ciftYuz ? 2 : 1)) : 1;

  const kademe = u.fiyatModeli === 'SABIT' ? u.kademeler[0] : kademeBul(u.kademeler, miktar)!;
  let ana = miktar * kademe.fiyat;
  for (const s of secilen) if (s.deger.tur === 'CARPAN') ana *= s.deger.deger;
  ana = Math.round(ana);

  const dokum: DokumKalemi[] = [{ tur: 'ANA', ad: u.ad, tutar: ana }];
  for (const s of secilen) {
    const d = s.deger;
    let tutar = 0;
    if (d.tur === 'SABIT') tutar = d.deger;
    else if (d.tur === 'BIRIM') {
      let birim = d.deger;
      if (d.araliklar) {
        // Kalınlık en büyük aralığı aşıyorsa en büyük aralığın fiyatı.
        birim = (d.araliklar.find((a) => yaprakNusha <= a.max) ?? d.araliklar[d.araliklar.length - 1]).deger;
      }
      const taban = d.taban === 'NUSHA' ? adet : d.taban === 'YAPRAK' ? yaprakNusha * adet : miktar;
      tutar = Math.round(birim * taban);
    }
    if (tutar > 0) dokum.push({ tur: 'SECENEK', ad: `${s.grup.ad}: ${d.ad}`, tutar });
  }

  let araToplam = dokum.reduce((t, k) => t + k.tutar, 0);
  let asgariUygulandi = false;
  if (araToplam < u.minTutar) {
    dokum.push({ tur: 'ASGARI', ad: 'ASGARI', tutar: u.minTutar - araToplam });
    araToplam = u.minTutar;
    asgariUygulandi = true;
  }

  // KDV. Girilen fiyat dahilse toplam odur; değilse üstüne eklenir.
  let toplam = u.kdvDahil ? araToplam : araToplam + Math.round((araToplam * u.kdvOrani) / 100);
  let yuvarlandi = false;
  if (u.yuvarlama > 0 && toplam % u.yuvarlama !== 0) {
    const yeni = Math.ceil(toplam / u.yuvarlama) * u.yuvarlama;
    dokum.push({ tur: 'YUVARLAMA', ad: 'YUVARLAMA', tutar: yeni - toplam });
    toplam = yeni;
    yuvarlandi = true;
  }
  // KDV hariç girilmiş ve yuvarlanmamışsa ara toplam zaten KDV hariçtir;
  // geri hesaplamak kuruş kaydırırdı.
  const kdvHaric = u.kdvDahil || yuvarlandi ? Math.round((toplam * 100) / (100 + u.kdvOrani)) : araToplam;

  return {
    ok: true,
    miktar,
    birimFiyat: kademe.fiyat,
    dokum,
    kdvHaric,
    kdv: toplam - kdvHaric,
    toplam,
    asgariUygulandi,
    tahmini: u.fiyatModeli === 'SAYFA' && g.sayfaDosyadan !== true,
    secilenler: secilen.map((s) => ({ grup: s.grup.kod, grupAd: s.grup.ad, kod: s.deger.kod, ad: s.deger.ad })),
  };
}

// ── ÖZET ─────────────────────────────────────────────────────────────────

const BIRIM_ADLARI = {
  tr: { nusha: 'nüsha', adet: 'adet', sayfa: 'sf' },
  en: { nusha: 'copies', adet: 'pcs', sayfa: 'pp' },
} as const;

/**
 * İnsan okur tek satır: "A4 Renkli · 2 nüsha · 120 sf · Spiral".
 * Panoda kartta, fişte ve WhatsApp mesajında aynı satır. Varsayılan ve
 * etkisiz seçimler (tek yüz) de yazılır: operatör neyi basacağını görsün.
 */
export function kalemOzeti(u: Pick<UrunTanimi, 'ad' | 'fiyatModeli'>, g: FiyatGirdisi, secilenler: FiyatSonucu['secilenler'], dil: 'tr' | 'en' = 'tr'): string {
  const b = BIRIM_ADLARI[dil];
  const p: string[] = [u.ad];
  const adet = tamSayi(g.adet);
  if (u.fiyatModeli === 'SAYFA') {
    p.push(`${adet} ${b.nusha}`, `${tamSayi(g.sayfa)} ${b.sayfa}`);
  } else if (u.fiyatModeli === 'ALAN') {
    p.push(`${sayi(g.enCm)}×${sayi(g.boyCm)} cm`);
    if (adet > 1) p.push(`${adet} ${b.adet}`);
  } else {
    p.push(`${adet} ${b.adet}`);
  }
  for (const s of secilenler) p.push(s.ad);
  return p.join(' · ');
}
