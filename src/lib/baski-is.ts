// BASKI İŞİ KURALLARI — saf (veritabanı yok). Testte doğrudan derlenir.
//
// ── AKIŞ ─────────────────────────────────────────────────────────────────
//   Gelen → Sırada → Baskıda → Bitiş → Hazır → Teslim        (+ İptal)
//
//   GELEN    sipariş sayfasından düştü, fiyat henüz onaylanmadı ("Kabul et").
//   SIRADA   kabul edildi, makine bekliyor. Tezgah işi doğrudan buradan başlar.
//   BASKIDA  makinede.
//   BITIS    cilt, laminasyon, kesim. Bitiş işi olmayan iş buradan geçmez.
//   HAZIR    teslim bekliyor; müşteriye haber verilir.
//   TESLIM   müşteri aldı.
//
// Panoda her kartta TEK düğme var: "sonraki adım". Hangi adımın sonraki
// olduğu, kimin hangi adımı atabileceği ve ne zaman iptal edilebileceği
// burada; ekran ve uç aynı kuralı kullanır.
//
// ── PARA KAPISI ──────────────────────────────────────────────────────────
// Parası alınmamış iş teslim edilmez: kayıp işin en sık biçimi "sonra
// öderim" diyen müşteri. İstisna cari: kayıtlı müşterinin işi cariye borç
// yazılır, teslim edilebilir. Parası alınmış iş iptal edilmez: önce iade.

import { fiyatHesapla, kalemOzeti, urunTanimi, type DokumKalemi, type FiyatHatasi } from './baski-fiyat';

export type IsDurumu = 'GELEN' | 'SIRADA' | 'BASKIDA' | 'BITIS' | 'HAZIR' | 'TESLIM' | 'IPTAL';
export type Kanal = 'ONLINE' | 'TEZGAH' | 'WHATSAPP' | 'TELEFON';
export type OdemeYolu = 'NAKIT' | 'KART' | 'HAVALE';
export type OdemeDurumu = 'BEKLIYOR' | 'KISMI' | 'ODENDI' | 'CARI';

/** Panodaki sütunlar, sırasıyla. İptal sütun değil. */
export const AKIS: readonly IsDurumu[] = ['GELEN', 'SIRADA', 'BASKIDA', 'BITIS', 'HAZIR', 'TESLIM'];
export const DURUMLAR: readonly IsDurumu[] = [...AKIS, 'IPTAL'];
export const KANALLAR: readonly Kanal[] = ['ONLINE', 'TEZGAH', 'WHATSAPP', 'TELEFON'];
export const ODEME_YOLLARI: readonly OdemeYolu[] = ['NAKIT', 'KART', 'HAVALE'];

/** Bitti sayılan durumlar: gecikme, "bugün" listesi ve pano dışı. */
export const KAPALI: readonly IsDurumu[] = ['TESLIM', 'IPTAL'];

export function isDurumu(x: unknown): IsDurumu | null {
  return (DURUMLAR as readonly string[]).includes(x as string) ? (x as IsDurumu) : null;
}
export function kanal(x: unknown): Kanal {
  return (KANALLAR as readonly string[]).includes(x as string) ? (x as Kanal) : 'TEZGAH';
}

// ── İŞ NUMARASI ──────────────────────────────────────────────────────────

/** İlk iş B-1001: yeni matbaanın ilk fişi "B-1" yazmasın. */
export const ILK_NO = 1001;

/** Gösterim: 1042 → "B-1042". */
export function isNo(no: number): string {
  return `B-${no}`;
}

/** "B-1042", "b1042", "1042" → 1042. Arama kutusu için; tanınmazsa null. */
export function isNoCoz(x: unknown): number | null {
  const m = /^\s*(?:b\s*-?\s*)?(\d{1,9})\s*$/i.exec(String(x ?? ''));
  return m ? Number(m[1]) : null;
}

/** Veritabanındaki en büyük numaradan sonraki (hiç iş yoksa ILK_NO). */
export function sonrakiNo(enBuyuk: number | null | undefined): number {
  const n = Number(enBuyuk ?? 0);
  return Number.isFinite(n) && n >= ILK_NO ? Math.floor(n) + 1 : ILK_NO;
}

// ── BİTİŞ İŞİ ────────────────────────────────────────────────────────────

/**
 * Bitiş işi sayılan seçenek grupları (baski-sablon kodları). Seçilen değer
 * etkisiz değilse (ciltsiz, kuşgözüsüz) iş Baskıda'dan sonra Bitiş'e gider.
 */
export const BITIS_GRUPLARI: readonly string[] = ['cilt', 'lam', 'laminasyon', 'kusgozu', 'kasnak'];
const ETKISIZ: readonly string[] = ['yok', 'tek'];

/** Bitiş kategorisindeki ürün (spiral, laminasyon) de bitiş işidir. */
export function bitisGerekliMi(kalemler: readonly { kategori?: string | null; secilenler: readonly { grup: string; kod: string }[] }[]): boolean {
  return kalemler.some((k) => k.kategori === 'CILT'
    || k.secilenler.some((s) => BITIS_GRUPLARI.includes(s.grup) && !ETKISIZ.includes(s.kod)));
}

// ── DURUM GEÇİŞİ ─────────────────────────────────────────────────────────

/** Panodaki "sonraki adım" düğmesinin götürdüğü durum; yoksa null. */
export function sonrakiDurum(durum: IsDurumu, bitisGerekli: boolean): IsDurumu | null {
  switch (durum) {
    case 'GELEN': return 'SIRADA';
    case 'SIRADA': return 'BASKIDA';
    case 'BASKIDA': return bitisGerekli ? 'BITIS' : 'HAZIR';
    case 'BITIS': return 'HAZIR';
    case 'HAZIR': return 'TESLIM';
    default: return null;
  }
}

export type GecisHatasi =
  | 'GECIS_YOK'        // atlanamaz (Sırada → Teslim) ya da kapalı işten çıkış
  | 'YETKI_YOK'        // operatör kabul, teslim, iptal yapmaz
  | 'ODEME_EKSIK'      // parası alınmamış iş teslim edilmez (cari değilse)
  | 'ODENMIS_IPTAL'    // parası alınmış iş iptal edilmez: önce iade
  | 'FIYAT_TAHMINI';   // sayfa sayısı onaylanmadan kabul edilmez

export interface GecisBaglami {
  rol: string;
  toplam: number;
  odenen: number;
  /** Kayıtlı müşteri + cari: borç yazılır, teslim edilebilir. */
  cari: boolean;
  bitisGerekli: boolean;
  /** Fiyat tahmini (sayfa dosyadan gelmedi) ve personel onaylamadı. */
  tahmini?: boolean;
}

/** Operatörün (TECHNICIAN) atabildiği adımlar: üretim. Kabul, teslim, iptal tezgahın. */
const OPERATOR_GECISLERI: readonly string[] = ['SIRADA>BASKIDA', 'BASKIDA>BITIS', 'BASKIDA>HAZIR', 'BITIS>HAZIR',
  'BASKIDA>SIRADA', 'BITIS>BASKIDA', 'HAZIR>BITIS', 'HAZIR>BASKIDA'];

/**
 * Bu geçiş yapılabilir mi? İleri: bir adım (Bitiş gerekmiyorsa Baskıda →
 * Hazır). Geri: bir adım, yanlış dokunuşu düzeltmek için (Teslim → Hazır
 * dahil; kapı teslim kaydını geri alır). İptal: teslim edilmemiş ve parası
 * alınmamış işte. İptalden dönüş yalnız yöneticide, Sırada'ya.
 */
export function gecisIzinli(once: IsDurumu, sonra: IsDurumu, b: GecisBaglami): { ok: true } | { ok: false; kod: GecisHatasi } {
  if (once === sonra) return { ok: false, kod: 'GECIS_YOK' };
  const yonetici = b.rol === 'ADMIN' || b.rol === 'SUPER_ADMIN';
  const operator = b.rol === 'TECHNICIAN';

  if (sonra === 'IPTAL') {
    if (operator) return { ok: false, kod: 'YETKI_YOK' };
    if (once === 'TESLIM') return { ok: false, kod: 'GECIS_YOK' };
    if (b.odenen > 0) return { ok: false, kod: 'ODENMIS_IPTAL' };
    return { ok: true };
  }
  if (once === 'IPTAL') {
    if (!yonetici) return { ok: false, kod: 'YETKI_YOK' };
    return sonra === 'SIRADA' ? { ok: true } : { ok: false, kod: 'GECIS_YOK' };
  }

  const i = AKIS.indexOf(once), j = AKIS.indexOf(sonra);
  const ileri = sonra === sonrakiDurum(once, b.bitisGerekli)
    // Bitiş gerekse de operatör "bitişe gerek kalmadı" diyebilir.
    || (once === 'BASKIDA' && sonra === 'HAZIR');
  const geri = j === i - 1 || (once === 'HAZIR' && sonra === 'BASKIDA' && !b.bitisGerekli);
  if (!ileri && !geri) return { ok: false, kod: 'GECIS_YOK' };
  if (operator && !OPERATOR_GECISLERI.includes(`${once}>${sonra}`)) return { ok: false, kod: 'YETKI_YOK' };

  if (once === 'GELEN' && sonra === 'SIRADA' && b.tahmini) return { ok: false, kod: 'FIYAT_TAHMINI' };
  if (sonra === 'TESLIM' && !b.cari && b.odenen < b.toplam) return { ok: false, kod: 'ODEME_EKSIK' };
  return { ok: true };
}

// ── PARA ─────────────────────────────────────────────────────────────────

export function kalan(toplam: number, odenen: number): number {
  return Math.max(0, toplam - odenen);
}

export function odemeDurumu(toplam: number, odenen: number, cari = false): OdemeDurumu {
  if (toplam > 0 && odenen >= toplam) return 'ODENDI';
  if (odenen > 0) return 'KISMI';
  return cari ? 'CARI' : 'BEKLIYOR';
}

export type OdemeHatasi = 'TUTAR_GECERSIZ' | 'FAZLA_ODEME' | 'YOL_GECERSIZ' | 'IS_KAPALI';

/**
 * Ödeme kaydı geçerli mi? Kalanı aşan ödeme reddedilir: para üstü kasada
 * verilir, sisteme fazla tutar yazılırsa kasa gün sonunda fazla görünür.
 * İptal edilmiş işe ödeme girilmez. Teslim edilmiş işe (cari) girilebilir.
 */
export function odemeGecerli(o: { tutar: unknown; yol: unknown }, is: { toplam: number; odenen: number; durum: IsDurumu }): { ok: true; tutar: number; yol: OdemeYolu } | { ok: false; kod: OdemeHatasi } {
  if (is.durum === 'IPTAL') return { ok: false, kod: 'IS_KAPALI' };
  const tutar = typeof o.tutar === 'number' ? o.tutar : Number(o.tutar);
  if (!Number.isInteger(tutar) || tutar <= 0) return { ok: false, kod: 'TUTAR_GECERSIZ' };
  if (!(ODEME_YOLLARI as readonly string[]).includes(o.yol as string)) return { ok: false, kod: 'YOL_GECERSIZ' };
  if (tutar > kalan(is.toplam, is.odenen)) return { ok: false, kod: 'FAZLA_ODEME' };
  return { ok: true, tutar, yol: o.yol as OdemeYolu };
}

// ── ZAMAN ────────────────────────────────────────────────────────────────

/** Söz verilen saat geçti ve iş hâlâ hazır değil. */
export function gecikiyorMu(is: { durum: IsDurumu; sozVerilenAt: Date | string | null }, simdi: Date): boolean {
  if (!is.sozVerilenAt || is.durum === 'HAZIR' || KAPALI.includes(is.durum)) return false;
  return new Date(is.sozVerilenAt).getTime() < simdi.getTime();
}

/** Hazır ama müşteriye haber verilmemiş: Bugün'deki "WhatsApp'tan haber ver" satırı. */
export function haberBekliyorMu(is: { durum: IsDurumu; haberVerildiAt: Date | string | null }): boolean {
  return is.durum === 'HAZIR' && !is.haberVerildiAt;
}

// ── MÜŞTERİNİN GÖRDÜĞÜ ADIMLAR ───────────────────────────────────────────

export type TakipAdimi = 'ALINDI' | 'HAZIRLANIYOR' | 'HAZIR' | 'TESLIM';
export const TAKIP_ADIMLARI: readonly TakipAdimi[] = ['ALINDI', 'HAZIRLANIYOR', 'HAZIR', 'TESLIM'];

/** İçerideki altı durum müşteriye dört adım: sıra ve bitiş onun derdi değil. */
export function takipAdimi(durum: IsDurumu): TakipAdimi | null {
  switch (durum) {
    case 'GELEN': case 'SIRADA': return 'ALINDI';
    case 'BASKIDA': case 'BITIS': return 'HAZIRLANIYOR';
    case 'HAZIR': return 'HAZIR';
    case 'TESLIM': return 'TESLIM';
    default: return null;
  }
}

/**
 * Takip sayfasındaki çizelge. Saat, o adıma SON girişin saatidir (iş geri
 * alınıp yeniden hazırlandıysa ilk "hazır" saati yanıltır). İptal edilmiş
 * işte çizelge yok (boş dizi).
 */
export function takipCizelgesi(
  is: { durum: IsDurumu; createdAt: Date | string; teslimAt?: Date | string | null },
  olaylar: readonly { durumSonra: string | null; createdAt: Date | string }[],
): { adim: TakipAdimi; tamam: boolean; simdi: boolean; zaman: Date | null }[] {
  const su = takipAdimi(is.durum);
  if (!su) return [];
  const sira = TAKIP_ADIMLARI.indexOf(su);
  const son = (...durumlar: string[]) => {
    let z: Date | null = null;
    for (const o of olaylar) if (o.durumSonra && durumlar.includes(o.durumSonra)) { const t = new Date(o.createdAt); if (!z || t > z) z = t; }
    return z;
  };
  const zaman: Record<TakipAdimi, Date | null> = {
    ALINDI: new Date(is.createdAt),
    HAZIRLANIYOR: son('BASKIDA', 'BITIS'),
    HAZIR: son('HAZIR'),
    TESLIM: is.teslimAt ? new Date(is.teslimAt) : son('TESLIM'),
  };
  return TAKIP_ADIMLARI.map((adim, i) => ({ adim, tamam: i <= sira, simdi: i === sira, zaman: i <= sira ? zaman[adim] : null }));
}

// ── PROVA ────────────────────────────────────────────────────────────────

export type ProvaDurumu = 'BEKLIYOR' | 'ONAYLANDI' | 'DUZELTME';
/** Prova bağlantısı kaç gün geçerli. */
export const PROVA_GUN = 7;

export function provaSonTarihi(simdi: Date): Date {
  return new Date(simdi.getTime() + PROVA_GUN * 86_400_000);
}

/**
 * Prova yanıtlanabilir mi? Bağlantı SÜRELİ ve TEK KULLANIMLIK: yanıt
 * verilmişse ya da süre dolmuşsa işlem yapılmaz. Kapanmış işin provası da
 * yanıtlanmaz (iptal edilmiş işi müşteri "onaylayamaz").
 */
export function provaYanitlanir(p: { durum: string; sonTarih: Date | string }, isDurumu: string, simdi: Date): { ok: true } | { ok: false; kod: 'PROVA_YANITLANDI' | 'PROVA_SURESI_DOLDU' } {
  if (p.durum !== 'BEKLIYOR') return { ok: false, kod: 'PROVA_YANITLANDI' };
  if (new Date(p.sonTarih).getTime() <= simdi.getTime() || KAPALI.includes(isDurumu as IsDurumu)) return { ok: false, kod: 'PROVA_SURESI_DOLDU' };
  return { ok: true };
}

/** Ekranda gösterilecek durum: süresi dolmuş bekleyen prova ayrı yazılır. */
export function provaGorunum(p: { durum: string; sonTarih: Date | string }, simdi: Date): ProvaDurumu | 'SURESI_DOLDU' {
  if (p.durum === 'ONAYLANDI' || p.durum === 'DUZELTME') return p.durum;
  return new Date(p.sonTarih).getTime() <= simdi.getTime() ? 'SURESI_DOLDU' : 'BEKLIYOR';
}

// ── İŞ HESABI ────────────────────────────────────────────────────────────

/** Fiyat listesindeki ürün satırı (BaskiUrunu). */
export type UrunSatiri = Record<string, unknown> & { id: string; kategori?: string | null; aktif?: boolean };

export interface KalemGirdisi {
  urunId: string;
  adet: number;
  sayfa?: number;
  enCm?: number;
  boyCm?: number;
  secimler?: Record<string, string>;
  sayfaDosyadan?: boolean;
}

export interface HesaplananKalem {
  urunId: string;
  urunAd: string;
  secimler: Record<string, string>;
  adet: number;
  sayfa: number | null;
  enCm: number | null;
  boyCm: number | null;
  birimFiyat: number;
  tutar: number;
  ozet: string;
  dokum: DokumKalemi[];
  sira: number;
}

export type IsHesapHatasi = { ok: false; kod: 'KALEM_YOK' | 'URUN_YOK' | FiyatHatasi; sira?: number; grup?: string };

/**
 * İşin kalemlerini fiyat listesinden SUNUCUDA hesaplar: istemcinin
 * gönderdiği tutara güvenilmez (sipariş sayfasında tutarı değiştirilmiş
 * istek gelir). Personel girişinde sayfa sayısını personel saymıştır;
 * tahmini yalnız müşteriden gelen (online) işte olur.
 */
export function isHesapla(urunler: readonly UrunSatiri[], girdiler: readonly KalemGirdisi[], o: { personel: boolean; dil?: 'tr' | 'en' }):
  | { ok: true; kalemler: HesaplananKalem[]; kdvHaric: number; kdv: number; toplam: number; tahmini: boolean; bitisGerekli: boolean }
  | IsHesapHatasi {
  if (!Array.isArray(girdiler) || !girdiler.length || girdiler.length > 50) return { ok: false, kod: 'KALEM_YOK' };
  const kalemler: HesaplananKalem[] = [];
  let kdvHaric = 0, kdv = 0, toplam = 0, tahmini = false;
  const bitisIcin: { kategori?: string | null; secilenler: { grup: string; kod: string }[] }[] = [];
  for (let i = 0; i < girdiler.length; i++) {
    const g = girdiler[i];
    const satir = urunler.find((u) => u.id === g?.urunId && u.aktif !== false);
    if (!satir) return { ok: false, kod: 'URUN_YOK', sira: i };
    const u = urunTanimi(satir);
    const fg = { adet: g.adet, sayfa: g.sayfa, enCm: g.enCm, boyCm: g.boyCm, secimler: g.secimler ?? {}, sayfaDosyadan: o.personel || g.sayfaDosyadan === true };
    const r = fiyatHesapla(u, fg);
    if (!r.ok) return { ok: false, kod: r.kod, sira: i, grup: r.grup };
    kalemler.push({
      urunId: satir.id, urunAd: u.ad,
      secimler: Object.fromEntries(r.secilenler.map((s) => [s.grup, s.kod])),
      adet: Math.floor(Number(g.adet)),
      sayfa: u.fiyatModeli === 'SAYFA' ? Math.floor(Number(g.sayfa)) : null,
      enCm: u.fiyatModeli === 'ALAN' ? Number(g.enCm) : null,
      boyCm: u.fiyatModeli === 'ALAN' ? Number(g.boyCm) : null,
      birimFiyat: r.birimFiyat, tutar: r.toplam,
      ozet: kalemOzeti(u, fg, r.secilenler, o.dil),
      dokum: r.dokum, sira: i,
    });
    kdvHaric += r.kdvHaric; kdv += r.kdv; toplam += r.toplam;
    tahmini ||= r.tahmini;
    bitisIcin.push({ kategori: satir.kategori, secilenler: r.secilenler });
  }
  return { ok: true, kalemler, kdvHaric, kdv, toplam, tahmini, bitisGerekli: bitisGerekliMi(bitisIcin) };
}

// ── BUGÜN LİSTESİ ────────────────────────────────────────────────────────

export type BugunTuru = 'gelen' | 'prova' | 'haber' | 'gec' | 'bugun' | 'odeme';
export const BUGUN_SIRASI: readonly BugunTuru[] = ['gelen', 'prova', 'haber', 'gec', 'bugun', 'odeme'];

export interface BugunIsi {
  id: string;
  durum: string;
  sozVerilenAt: Date | null;
  haberVerildiAt: Date | null;
  toplam: number;
  odenen: number;
  customerId: string | null;
  odemeYolu: string | null;
  /** Son provanın durumu (yoksa null). */
  sonProva?: string | null;
}

/**
 * İşin Bugün listesindeki satırı; null = bugün yapılacak bir şey yok.
 * Her iş TEK satırda, en acil sebebiyle: online gelen kabul bekler; müşteri
 * provada düzeltme istediyse iş onu bekliyor; hazır
 * olup haber verilmemiş iş müşteriyi "hazır mı?" diye yazdırır; geciken
 * ve bugün söz verilen iş makineye; haber verilmiş ama parası alınmamış iş
 * kasaya.
 */
export function bugunTuru(is: BugunIsi, simdi: Date, gunSonu: Date): BugunTuru | null {
  const durum = isDurumu(is.durum);
  if (!durum || KAPALI.includes(durum)) return null;
  if (durum === 'GELEN') return 'gelen';
  if (is.sonProva === 'DUZELTME' && durum !== 'HAZIR') return 'prova';
  if (haberBekliyorMu({ durum, haberVerildiAt: is.haberVerildiAt })) return 'haber';
  if (gecikiyorMu({ durum, sozVerilenAt: is.sozVerilenAt }, simdi)) return 'gec';
  if (durum !== 'HAZIR' && is.sozVerilenAt && +new Date(is.sozVerilenAt) <= +gunSonu) return 'bugun';
  const cari = !!is.customerId && is.odemeYolu === 'CARI';
  if (durum === 'HAZIR' && !cari && kalan(is.toplam, is.odenen) > 0) return 'odeme';
  return null;
}

/** Bugün satırları sıralı: önce sebep (BUGUN_SIRASI), sonra söz verilen saat. */
export function bugunSatirlari<T extends BugunIsi>(isler: readonly T[], simdi: Date, gunSonu: Date): { tur: BugunTuru; is: T }[] {
  const saat = (d: Date | null) => (d ? +new Date(d) : Number.MAX_SAFE_INTEGER);
  return isler
    .map((is) => ({ tur: bugunTuru(is, simdi, gunSonu), is }))
    .filter((x): x is { tur: BugunTuru; is: T } => x.tur !== null)
    .sort((a, b) => BUGUN_SIRASI.indexOf(a.tur) - BUGUN_SIRASI.indexOf(b.tur) || saat(a.is.sozVerilenAt) - saat(b.is.sozVerilenAt));
}

/**
 * Bayinin saat diliminde "bugün"ün başı ve sonu (UTC Date). Sunucu UTC'de
 * çalışıyor; İstanbul'da gece 01:00'de açılan iş UTC'de dünkü güne düşerdi.
 * `gun` verilirse ("2026-11-02") o gün.
 */
export function gunAraligi(tz: string, simdi: Date, gun?: string | null): { bas: Date; bit: Date; gun: string } {
  const tarihi = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const g = gun && /^\d{4}-\d{2}-\d{2}$/.test(gun) ? gun : tarihi(simdi);
  // Dilimin o günkü farkı: yerel gece yarısını UTC'de bul (yaz saati dahil).
  const tahmin = new Date(`${g}T00:00:00Z`);
  const parca = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(tahmin);
  const p = (t: string) => Number(parca.find((x) => x.type === t)?.value);
  const yerel = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'));
  const fark = yerel - +tahmin;
  const bas = new Date(+tahmin - fark);
  return { bas, bit: new Date(+bas + 86_400_000 - 1), gun: g };
}
