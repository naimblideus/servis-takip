/**
 * EMANET — MÜŞTERİDE DURAN TONER (saf kurallar; veritabanı yok, test edilir).
 *
 * ── SORUN ────────────────────────────────────────────────────────────────
 * Büyük müşteriye (hastane, okul, holding) yedek toner bırakılır. Birkaç ay
 * sonra rafta kaç tane kaldığını kimse bilmez; sözleşme bitince yarısı kayıp
 * çıkar. Rakiplerde (Printlio, Paperpan) bu bir DEFTER: teslim, tüketim,
 * iade, kayıp elle yazılır. Elle yazılmayan tek bir tüketim defteri ilk ayda
 * bozar ve bozuk defterin "kayıp" dediği şeye kimse inanmaz.
 *
 * ── BİZDE DEFTER KENDİNİ TUTUYOR ─────────────────────────────────────────
 * Tüketimi ağ tarayıcı ya da servis fişi zaten görüyor (TonerChange). O
 * müşterinin makinesinde toner değişince ve o toner bayiden yola çıkmış bir
 * sevk değilse, raftaki UYGUN yedekten −1 düşülür (emanet-veri.emanettenDus).
 * Elle yazılan yalnız bırakmak, geri almak ve saymak. Sayımda eksik çıkarsa
 * o eksik kayıp tonerin KANITIDIR: tüketim görülmeden raftan çıkmış.
 *
 * ── DEFTER = TEK GERÇEK ──────────────────────────────────────────────────
 * Bakiye ayrı bir alanda tutulmaz: Σ adet (işaretli). Defterle bakiye hiçbir
 * zaman ayrışamaz; düzeltme de SAYIM satırı olarak görünür kalır, sessizce
 * yapılmaz.
 */

export type EmanetTuru = 'BIRAKILDI' | 'TAKILDI' | 'IADE' | 'KAYIP' | 'SAYIM';
export const EMANET_TURLERI: readonly EmanetTuru[] = ['BIRAKILDI', 'TAKILDI', 'IADE', 'KAYIP', 'SAYIM'];

export type EmanetIslemi = 'birak' | 'iade' | 'kayip' | 'sayim';
export const EMANET_ISLEMLERI: readonly EmanetIslemi[] = ['birak', 'iade', 'kayip', 'sayim'];

/** Elle yapılan işlemin deftere düştüğü tür. TAKILDI elle yazılmaz: onu sistem görür. */
export const ISLEM_TURU: Readonly<Record<EmanetIslemi, EmanetTuru>> = {
  birak: 'BIRAKILDI', iade: 'IADE', kayip: 'KAYIP', sayim: 'SAYIM',
};

const GUN = 86_400_000;

/** Defterin bir satırı — hesaplar yalnız bunlara bakar. */
export interface EmanetSatiri {
  tur: string;
  /** İşaretli: + müşteride artar, − azalır. */
  adet: number;
  tarih: Date;
  partId: string | null;
  parcaAdi: string;
  birimMaliyet: number | null;
}

/**
 * Kalemin (müşteri × parça) anahtarı. Parça kartı silinmişse (partId boş,
 * şemada SetNull) kalem ADIYLA izlenir: defter yine okunur, bakiye kaybolmaz.
 */
export function kalemAnahtari(s: { partId: string | null; parcaAdi: string | null }): string {
  return s.partId ?? `ad:${(s.parcaAdi ?? '').trim().toLocaleLowerCase('tr-TR')}`;
}

/** Satırları kaleme göre gruplar (sıra korunur). */
export function kalemlereAyir<T extends { partId: string | null; parcaAdi: string }>(satirlar: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const s of satirlar) {
    const k = kalemAnahtari(s);
    const l = m.get(k);
    if (l) l.push(s); else m.set(k, [s]);
  }
  return m;
}

/** Bakiye = Σ adet. `an` verilirse o ana kadarki (o an dahil) satırlar. */
export function bakiye(satirlar: readonly { adet: number; tarih: Date }[], an?: Date): number {
  let n = 0;
  for (const s of satirlar) if (!an || s.tarih.getTime() <= an.getTime()) n += s.adet;
  return n;
}

// ── RAFTAKİ PARTİLER ─────────────────────────────────────────────────────

/** Rafta duran bir parti: hangi gün, kaç tane, hangi maliyetle bırakıldı. */
export interface Parti { tarih: Date; adet: number; birimMaliyet: number | null }

/**
 * Raftaki partiler — EN ESKİ ÖNCE TÜKENİR sayılır (FIFO).
 *
 * NEDEN FIFO (stok-maliyet ortalama kullanırken): burada sorulan "maliyet"
 * değil "ne zamandır duruyor". Raftaki tonerin hangisinin takıldığını kimse
 * bilmiyor; FIFO, "en eski toner N gündür rafta" iddiasının EN KÜÇÜK
 * değerini verir. Gerçek sıra ne olursa olsun söylenen gün abartılı olmaz —
 * dürüst bir alt sınır.
 *
 * Satırlar sıralı gelmek zorunda değil: tarihe göre sıralanır, eşit tarihte
 * girdi sırası korunur. Defter bir an eksiye düşmüşse (olmaması gereken; ör.
 * veritabanına elle yazılmış satır) açık BORÇ olarak tutulur ve sonraki
 * giriş önce onu kapatır — partilerin toplamı her zaman bakiyeyle tutar.
 */
export function partiler(satirlar: readonly EmanetSatiri[]): Parti[] {
  const sirali = satirlar
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.tarih.getTime() - b.s.tarih.getTime() || a.i - b.i);
  const kuyruk: Parti[] = [];
  let borc = 0;
  for (const { s } of sirali) {
    if (s.adet > 0) {
      const odenen = Math.min(borc, s.adet);
      borc -= odenen;
      const gelen = s.adet - odenen;
      if (gelen > 0) kuyruk.push({ tarih: s.tarih, adet: gelen, birimMaliyet: s.birimMaliyet });
      continue;
    }
    let kalan = -s.adet;
    while (kalan > 0 && kuyruk.length) {
      const ilk = kuyruk[0];
      const al = Math.min(ilk.adet, kalan);
      ilk.adet -= al;
      kalan -= al;
      if (ilk.adet === 0) kuyruk.shift();
    }
    borc += kalan;
  }
  return kuyruk;
}

/**
 * Raftan `adet` tane çıkarsa (FIFO) birim maliyeti. Bir tanesinin bile
 * maliyeti bilinmiyorsa ya da rafta o kadar yoksa null — uydurulmaz.
 */
export function cikanBirimMaliyet(p: readonly Parti[], adet: number): number | null {
  if (!(adet > 0)) return null;
  let kalan = adet, toplam = 0;
  for (const x of p) {
    if (kalan <= 0) break;
    const al = Math.min(x.adet, kalan);
    if (x.birimMaliyet === null) return null;
    toplam += al * x.birimMaliyet;
    kalan -= al;
  }
  if (kalan > 0) return null;
  return yuvarla(toplam / adet);
}

const yuvarla = (n: number) => Math.round(n * 100) / 100;

// ── FAZLA DURUYOR ────────────────────────────────────────────────────────

/**
 * "FAZLA DURUYOR" — raftaki toner bu müşterinin harcadığından çok; bayinin
 * parası rafta yatıyor. Eşik bilerek kaba ve tek cümlede anlatılabilir:
 *
 *   · en az FAZLA_EN_AZ (3) toner rafta — 1-2 yedek emanetin olağan hâli;
 *   · en eski toner en az GOZLEM_GUN (90) gündür rafta — yeni bırakılan
 *     kutuyu "fazla" saymamak için: 90 günlük tüketim ölçülmeden hüküm yok;
 *   · son 90 günün hızıyla raf 180 günden uzun yeter:
 *     bakiye > FAZLA_KAT (2) × son 90 günde takılan. Hiç takılmadıysa
 *     (0) rafta 3 ve üstü toner bu koşulu zaten sağlar.
 *
 * Ne yapılır: ya iade alınır ya da bir sonraki bırakış atlanır.
 */
export const FAZLA_EN_AZ = 3;
export const GOZLEM_GUN = 90;
export const FAZLA_KAT = 2;

export function fazlaDuruyor(k: { bakiye: number; enEskiGun: number | null; tuketim90: number }): boolean {
  return k.bakiye >= FAZLA_EN_AZ
    && k.enEskiGun !== null && k.enEskiGun >= GOZLEM_GUN
    && k.bakiye > FAZLA_KAT * Math.max(0, k.tuketim90);
}

// ── KALEM ÖZETİ ──────────────────────────────────────────────────────────

export interface KalemOzeti {
  anahtar: string;
  partId: string | null;
  /** Son satırdaki ad (veri katmanı bugünkü kart adını tercih eder). */
  ad: string;
  bakiye: number;
  /**
   * Raftakilerin değeri — bırakıldıkları andaki maliyetle. Bir kısmının
   * maliyeti bilinmiyorsa yalnız bilinenler toplanır ve degerEksik doğru
   * olur; ekran "en az" der, sıfırı değer diye göstermez.
   */
  deger: number;
  degerEksik: boolean;
  /** En eski toner kaç gündür rafta (FIFO alt sınırı). Rafta yoksa null. */
  enEskiGun: number | null;
  /** Son 90 günde takılan adet (yalnız TAKILDI; iade ve kayıp tüketim değil). */
  tuketim90: number;
  fazla: boolean;
  sonHareket: Date | null;
  /** Son 90 gündeki en son sayım farkı (eksik negatif, fazla pozitif) ve satırın birim maliyeti. */
  sonSayimFarki: { tarih: Date; fark: number; birimMaliyet: number | null } | null;
}

export function kalemOzeti(satirlar: readonly EmanetSatiri[], simdi: Date): KalemOzeti {
  const ilk = satirlar[0];
  const p = partiler(satirlar);
  let deger = 0, degerEksik = false;
  for (const x of p) {
    if (x.birimMaliyet === null) degerEksik = true;
    else deger += x.adet * x.birimMaliyet;
  }
  const sinir = simdi.getTime() - GOZLEM_GUN * GUN;
  let tuketim90 = 0;
  let son: EmanetSatiri | null = null;
  let sayim: EmanetSatiri | null = null;
  for (const s of satirlar) {
    if (s.tur === 'TAKILDI' && s.tarih.getTime() >= sinir) tuketim90 -= s.adet;
    if (!son || s.tarih.getTime() >= son.tarih.getTime()) son = s;
    if (s.tur === 'SAYIM' && s.tarih.getTime() >= sinir && (!sayim || s.tarih.getTime() >= sayim.tarih.getTime())) sayim = s;
  }
  const b = bakiye(satirlar);
  const enEskiGun = b > 0 && p.length ? Math.max(0, Math.floor((simdi.getTime() - p[0].tarih.getTime()) / GUN)) : null;
  return {
    anahtar: ilk ? kalemAnahtari(ilk) : '',
    partId: ilk?.partId ?? null,
    ad: son?.parcaAdi ?? ilk?.parcaAdi ?? '',
    bakiye: b,
    deger: yuvarla(deger),
    degerEksik,
    enEskiGun,
    tuketim90,
    fazla: fazlaDuruyor({ bakiye: b, enEskiGun, tuketim90 }),
    sonHareket: son?.tarih ?? null,
    sonSayimFarki: sayim ? { tarih: sayim.tarih, fark: sayim.adet, birimMaliyet: sayim.birimMaliyet } : null,
  };
}

/** Müşterinin kalemlerinden tek satır özet. */
export function musteriToplami(kalemler: readonly KalemOzeti[]): {
  bakiye: number; deger: number; degerEksik: boolean; enEskiGun: number | null; tuketim90: number; fazla: boolean;
} {
  let bakiyeT = 0, deger = 0, degerEksik = false, tuketim90 = 0, fazla = false;
  let enEskiGun: number | null = null;
  for (const k of kalemler) {
    bakiyeT += k.bakiye;
    if (k.bakiye > 0) { deger += k.deger; degerEksik ||= k.degerEksik; }
    tuketim90 += k.tuketim90;
    fazla ||= k.fazla;
    if (k.enEskiGun !== null && (enEskiGun === null || k.enEskiGun > enEskiGun)) enEskiGun = k.enEskiGun;
  }
  return { bakiye: bakiyeT, deger: yuvarla(deger), degerEksik, enEskiGun, tuketim90, fazla };
}

// ── SAYIM ────────────────────────────────────────────────────────────────

/**
 * Sayılan ile defter arasındaki fark, kalem kalem. fark = sayılan − defter:
 * eksik negatif, fazla pozitif. İkisi de görünür kalır; fark sıfır olan
 * kalem defterde satır AÇMAZ (veri katmanı yalnız fark ≠ 0 yazar).
 */
export function sayimFarklari(
  sayilan: readonly { anahtar: string; sayilan: number }[],
  defter: ReadonlyMap<string, number>,
): { anahtar: string; defterde: number; sayilan: number; fark: number }[] {
  return sayilan.map((s) => {
    const defterde = defter.get(s.anahtar) ?? 0;
    return { anahtar: s.anahtar, defterde, sayilan: s.sayilan, fark: s.sayilan - defterde };
  });
}

// ── OTOMATİK TÜKETİM KARARI ──────────────────────────────────────────────

export type TuketimSebebi = 'PARCA_RAFTA_YOK' | 'ADAY_YOK' | 'BELIRSIZ';

/**
 * Toner değişimi raftaki hangi yedekten düşülür?
 *
 *   · Değişimin parçası biliniyorsa (fişte yazılı) YALNIZ o: rafta yoksa
 *     raftan takılmamıştır, düşülmez.
 *   · Bilinmiyorsa (tarayıcı gördü, kart elle işaretlendi): rafta duran ve
 *     bu makineye/modele uyduğu BİLİNEN tek toner. Birden çok aday varsa
 *     DÜŞÜLMEZ — yanlış kaleme yazılan tüketim iki kalemi birden bozar;
 *     sayım farkı yakalar. Hiç aday yoksa da düşülmez (toner başka yerden
 *     gelmiş olabilir: kaçan toner ekranının işi).
 *
 * `adaylar`: müşterinin rafında bakiyesi olan toner kalemleri; `uyar`
 * veri katmanının kanıtıdır (aynı cihaza/modele daha önce takılmış, cihazın
 * fişinde kullanılmış ya da bu makine için bırakılmış).
 */
export function tuketimKarari(g: {
  degisimParcasi: string | null;
  adaylar: readonly { partId: string; bakiye: number; uyar: boolean }[];
}): { partId: string } | { sebep: TuketimSebebi } {
  const rafta = g.adaylar.filter((a) => a.bakiye > 0);
  if (g.degisimParcasi) {
    return rafta.some((a) => a.partId === g.degisimParcasi) ? { partId: g.degisimParcasi } : { sebep: 'PARCA_RAFTA_YOK' };
  }
  const uyan = [...new Set(rafta.filter((a) => a.uyar).map((a) => a.partId))];
  if (uyan.length === 1) return { partId: uyan[0] };
  return { sebep: uyan.length === 0 ? 'ADAY_YOK' : 'BELIRSIZ' };
}

// ── İSTEK DOĞRULAMA ──────────────────────────────────────────────────────

export type EmanetHatasi =
  | 'EMANET_ISLEM_GECERSIZ' | 'EMANET_MUSTERI_YOK' | 'EMANET_KALEM_YOK' | 'EMANET_ADET_GECERSIZ'
  | 'EMANET_PARCA_YOK' | 'EMANET_CIHAZ_YOK' | 'EMANET_STOK_YETERSIZ' | 'EMANET_BAKIYE_ASIMI';

/** Hata kodunun HTTP karşılığı. Çakışma (stok/bakiye yetmedi) 409. */
export const HATA_DURUMU: Readonly<Record<EmanetHatasi, number>> = {
  EMANET_ISLEM_GECERSIZ: 400,
  EMANET_KALEM_YOK: 400,
  EMANET_ADET_GECERSIZ: 400,
  EMANET_MUSTERI_YOK: 404,
  EMANET_PARCA_YOK: 404,
  EMANET_CIHAZ_YOK: 404,
  EMANET_STOK_YETERSIZ: 409,
  EMANET_BAKIYE_ASIMI: 409,
};

export const EN_COK_KALEM = 30;
export const EN_COK_ADET = 100;
export const EN_COK_SAYIM = 1000;
export const EN_COK_NOT = 300;

export interface IstekKalemi {
  partId: string | null;
  /** Yalnız kartı silinmiş kalemi geri almak/saymak için (partId boşken). */
  parcaAdi: string | null;
  /** birak/iade/kayip: adet (≥1) · sayim: sayılan (≥0). */
  adet: number;
}

export interface EmanetIstegi {
  islem: EmanetIslemi;
  customerId: string;
  kalemler: IstekKalemi[];
  bosAdet: number;
  deviceId: string | null;
  not: string | null;
}

const kimlik = (v: unknown, enCok: number): string | null =>
  typeof v === 'string' && v.trim() && v.trim().length <= enCok ? v.trim() : null;

const tamSayi = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN;
  return Number.isInteger(n) ? n : null;
};

const bosMu = (v: unknown) => v === null || v === undefined || v === '';

/**
 * POST gövdesini doğrular; hatalıysa KOD döner (cümleyi uç kurar).
 * Aynı kalem iki kez gelirse adetler toplanır: ekranda iki satıra bölünmüş
 * aynı toner iki ayrı hareket değil, tek bırakıştır.
 */
export function istegiAyikla(x: unknown): EmanetIstegi | EmanetHatasi {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  if (typeof o.islem !== 'string' || !(EMANET_ISLEMLERI as readonly string[]).includes(o.islem)) return 'EMANET_ISLEM_GECERSIZ';
  const islem = o.islem as EmanetIslemi;
  const customerId = kimlik(o.customerId, 64);
  if (!customerId) return 'EMANET_MUSTERI_YOK';
  if (!Array.isArray(o.kalemler) || o.kalemler.length === 0 || o.kalemler.length > EN_COK_KALEM) return 'EMANET_KALEM_YOK';

  const sayim = islem === 'sayim';
  const enCok = sayim ? EN_COK_SAYIM : EN_COK_ADET;
  const birlesik = new Map<string, IstekKalemi>();
  for (const k of o.kalemler) {
    const ko = (k && typeof k === 'object' ? k : {}) as Record<string, unknown>;
    const partId = bosMu(ko.partId) ? null : kimlik(ko.partId, 64);
    if (!bosMu(ko.partId) && !partId) return 'EMANET_PARCA_YOK';
    // Bırakmak için stok kartı şart (stoktan düşülecek). Kartı silinmiş
    // kalem yalnız adıyla geri alınır, kayıp yazılır ya da sayılır.
    const parcaAdi = partId ? null : kimlik(ko.parcaAdi, 200);
    if (!partId && (islem === 'birak' || !parcaAdi)) return 'EMANET_PARCA_YOK';
    const n = tamSayi(sayim ? ko.sayilan : ko.adet);
    if (n === null || n < (sayim ? 0 : 1) || n > enCok) return 'EMANET_ADET_GECERSIZ';
    const anahtar = kalemAnahtari({ partId, parcaAdi });
    const onceki = birlesik.get(anahtar);
    if (onceki) onceki.adet += n;
    else birlesik.set(anahtar, { partId, parcaAdi, adet: n });
  }
  for (const k of birlesik.values()) if (k.adet > enCok) return 'EMANET_ADET_GECERSIZ';

  let bosAdet = 0;
  if (islem === 'birak' && !bosMu(o.bosAdet)) {
    const b = tamSayi(o.bosAdet);
    if (b === null || b < 0 || b > EN_COK_ADET) return 'EMANET_ADET_GECERSIZ';
    bosAdet = b;
  }
  let deviceId: string | null = null;
  if (islem === 'birak' && !bosMu(o.deviceId)) {
    deviceId = kimlik(o.deviceId, 64);
    if (!deviceId) return 'EMANET_CIHAZ_YOK';
  }
  const not = typeof o.not === 'string' && o.not.trim() ? o.not.trim().slice(0, EN_COK_NOT) : null;
  return { islem, customerId, kalemler: [...birlesik.values()], bosAdet, deviceId, not };
}
