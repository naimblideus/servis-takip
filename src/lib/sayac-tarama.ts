/**
 * SAYAÇ TARAMASI (SNMP) — tarayıcının getirdiğinden ne yazılır.
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Rakibin elindeki tek net üstünlük "sayaçlar günlük otomatik toplanır"
 * cümlesiydi. Sayaç e-postası kanalımız çalışıyor ama cihazın ayarına
 * adres girilmesini istiyor ve sahada hiçbir cihaz henüz göndermiyor.
 * Tarayıcı bu adımı atlıyor: müşterinin ağındaki bir bilgisayarda bir kez
 * çalışıyor, yazıcıları kendisi buluyor, sayacı cihazın kendisinden
 * okuyor. Cihazda hiçbir ayar değişmiyor.
 *
 * ── TARAYICI APTAL, SUNUCU AKILLI ────────────────────────────────────────
 * Tarayıcı (public/tarayici/*.ps1) yalnız HAM değerleri getirir: seri,
 * model, standart toplam sayaç (RFC 3805 prtMarkerLifeCount), renk
 * listesi, sarf seviyeleri ve markaya özel sayaç dalları. Neyin fatura
 * sayacı sayılacağına BURADA karar verilir. Karar tarayıcıda olsaydı her
 * düzeltme için müşterilerdeki bilgisayarlara yeni dosya dağıtmak gerekirdi.
 *
 * ── RENK AYRIMI YALNIZ DOĞRULANABİLİYORSA ────────────────────────────────
 * Standart MIB toplamı verir, siyah/renkli ayrımını vermez. Ayrımı
 * UYDURMAK yanlış fatura demektir; bu yüzden üç durum var:
 *   · Cihaz tek renkliyse (renk listesinde yalnız siyah) toplam = siyah.
 *   · Markanın kendi sayaçları varsa (şimdilik Kyocera) siyah + renkli
 *     STANDART TOPLAMA BİREBİR eşitse ayrım kabul edilir. Markaya özel
 *     adreslerin anlamını yanlış biliyorsak aritmetik tutmaz ve yazılmaz.
 *   · Diğer her durumda okuma YAZILMAZ; bayi panelde neden yazılmadığını
 *     görür. Eksik okuma bir sonraki turda tamamlanır, yanlış fatura
 *     müşteriyi kaybettirir.
 *
 * Saf modül: veritabanı yok, testte doğrudan sürülür.
 */

/** Tek bir taramada kabul edilen en fazla cihaz — bir müşteri ağı için bol. */
export const EN_FAZLA_CIHAZ = 2000;
/** Markaya özel sayaç dalından alınan en fazla değer. */
export const EN_FAZLA_OZEL = 64;

export interface SarfHam {
  ad: string;
  max: number;
  seviye: number;
}

/** Tarayıcının bir cihaz için getirdiği, doğrulanmış ham veri. */
export interface TaranmisCihaz {
  ip: string;
  sysObjectID: string | null;
  sysDescr: string | null;
  model: string | null;
  seri: string | null;
  /** RFC 3805 prtMarkerLifeCount — cihazın ömür boyu toplam baskısı. */
  toplam: number | null;
  /** prtMarkerColorantValue — "black", "cyan"... (küçük harf) */
  renkler: string[];
  sarf: SarfHam[];
  /** Markaya özel dal: OID → sayı. */
  ozel: Record<string, number>;
}

export interface TaramaGovdesi {
  bilgisayar: string | null;
  taranan: number;
  cihazlar: TaranmisCihaz[];
}

const metin = (v: unknown, azami: number): string | null => {
  if (typeof v !== 'string') return null;
  // Yazıcılar seriyi boşluk ve NUL ile doldurabiliyor.
  const s = v.replace(/\u0000/g, '').trim();
  return s ? s.slice(0, azami) : null;
};
const tamsayi = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) ? v : null;
const OID_DESENI = /^\d+(\.\d+){2,63}$/;

/** Tarayıcıdan gelen tek cihazı süzer; kullanılamazsa null. */
export function taranmisCihazAyikla(ham: unknown): TaranmisCihaz | null {
  if (!ham || typeof ham !== 'object') return null;
  const h = ham as Record<string, unknown>;
  const ip = metin(h.ip, 64);
  if (!ip) return null;
  const toplam = tamsayi(h.toplam);
  const renkler = Array.isArray(h.renkler)
    ? h.renkler.map((r) => metin(r, 40)?.toLowerCase()).filter((r): r is string => Boolean(r)).slice(0, 16)
    : [];
  const sarf = Array.isArray(h.sarf)
    ? h.sarf.flatMap((s): SarfHam[] => {
        if (!s || typeof s !== 'object') return [];
        const o = s as Record<string, unknown>;
        const ad = metin(o.ad, 80);
        const max = tamsayi(o.max);
        const seviye = tamsayi(o.seviye);
        return ad && max !== null && seviye !== null ? [{ ad, max, seviye }] : [];
      }).slice(0, 24)
    : [];
  const ozel: Record<string, number> = {};
  if (h.ozel && typeof h.ozel === 'object') {
    for (const [k, v] of Object.entries(h.ozel as Record<string, unknown>).slice(0, EN_FAZLA_OZEL)) {
      const n = tamsayi(v);
      if (OID_DESENI.test(k) && n !== null && n >= 0) ozel[k] = n;
    }
  }
  const oid = metin(h.sysObjectID, 128);
  return {
    ip,
    sysObjectID: oid && OID_DESENI.test(oid) ? oid : null,
    sysDescr: metin(h.sysDescr, 200),
    model: metin(h.model, 120),
    seri: metin(h.seri, 64),
    toplam: toplam !== null && toplam >= 0 ? toplam : null,
    renkler,
    sarf,
    ozel,
  };
}

/** Tarayıcının gönderdiği gövde; biçimsizse null. */
export function taramaGovdesiAyikla(ham: unknown): TaramaGovdesi | null {
  if (!ham || typeof ham !== 'object') return null;
  const h = ham as Record<string, unknown>;
  if (!Array.isArray(h.cihazlar) || h.cihazlar.length > EN_FAZLA_CIHAZ) return null;
  const cihazlar = h.cihazlar.map(taranmisCihazAyikla).filter((c): c is TaranmisCihaz => c !== null);
  const taranan = tamsayi(h.taranan);
  return {
    bilgisayar: metin(h.bilgisayar, 64),
    taranan: taranan !== null && taranan >= 0 ? Math.min(taranan, 1_000_000) : 0,
    cihazlar,
  };
}

// ── MARKA ────────────────────────────────────────────────────────────────

/**
 * IANA kurum numarası → marka. Yalnız GÖSTERİM için; bilinmeyen marka
 * hatası sayılmaz, sysDescr gösterilir. Listede yalnız emin olunanlar var.
 */
export const MARKALAR: Readonly<Record<number, string>> = {
  11: 'HP',
  236: 'Samsung',
  253: 'Xerox',
  367: 'Ricoh',
  641: 'Lexmark',
  1248: 'Epson',
  1347: 'Kyocera',
  1602: 'Canon',
  2385: 'Sharp',
  2435: 'Brother',
  18334: 'Konica Minolta',
};

export function kurumNo(sysObjectID: string | null): number | null {
  const m = sysObjectID?.match(/^1\.3\.6\.1\.4\.1\.(\d+)/);
  return m ? Number(m[1]) : null;
}

export function marka(c: Pick<TaranmisCihaz, 'sysObjectID'>): string | null {
  const n = kurumNo(c.sysObjectID);
  return n !== null ? MARKALAR[n] ?? null : null;
}

// ── RENK ─────────────────────────────────────────────────────────────────

const RENKLI_ADI = /cyan|magenta|yellow|camg[öo]be[ğg]i|macenta|sar[ıi]|cian|gelb/i;
const SIYAH_ADI = /black|siyah|schwarz|noir|negro/i;

/**
 * Cihaz renkli baskı yapabiliyor mu? Önce renk listesi (prtMarkerColorant),
 * yoksa sarf adları. İkisi de sessizse BİLİNMİYOR: tahmin edilmez.
 */
export function renkliMi(c: Pick<TaranmisCihaz, 'renkler' | 'sarf'>): boolean | null {
  if (c.renkler.length) {
    if (c.renkler.some((r) => RENKLI_ADI.test(r))) return true;
    if (c.renkler.every((r) => SIYAH_ADI.test(r))) return false;
  }
  const sarflar = c.sarf.map((s) => s.ad);
  if (sarflar.some((s) => RENKLI_ADI.test(s))) return true;
  if (sarflar.some((s) => SIYAH_ADI.test(s)) && !sarflar.some((s) => RENKLI_ADI.test(s))) return false;
  return null;
}

// ── RENK AYRIMI ──────────────────────────────────────────────────────────

/**
 * Kyocera'nın işlev × renk kipi sayaç dalı:
 *   1.3.6.1.4.1.1347.42.3.1.2.1.1.<işlev>.<kip>
 *   işlev: 1 yazıcı, 2 fotokopi, ...    kip: 1 siyah-beyaz, 3 tam renk
 * Ortadaki kip (2) kaynaklarda farklı anlatılıyor (tek renk / faks). Anlamı
 * kesin olmadığı için sıfır değilse ayrım YAPILMAZ.
 */
export const KYOCERA_DAL = '1.3.6.1.4.1.1347.42.3.1.2.1.1.';

export type AyrimYokSebebi =
  | 'SAYAC_YOK'        // cihaz standart toplamı vermedi
  | 'RENK_BILINMIYOR'  // renkli mi tek renkli mi anlaşılamadı
  | 'PROFIL_YOK'       // renkli, ama markanın ayrım sayacı bilinmiyor
  | 'BELIRSIZ_KIP'     // markanın anlamı kesin olmayan sayacı dolu
  | 'TOPLAM_TUTMUYOR'; // siyah + renkli, standart toplama eşit değil

export type Ayrim =
  | { tur: 'TEK_RENK'; siyah: number }
  | { tur: 'DOGRULANDI'; siyah: number; renkli: number; profil: 'KYOCERA' }
  | { tur: 'YOK'; sebep: AyrimYokSebebi };

export function kyoceraAyrimi(ozel: Record<string, number>): { siyah: number; belirsiz: number; renkli: number } | null {
  let siyah = 0, belirsiz = 0, renkli = 0, bulundu = false;
  for (const [oid, deger] of Object.entries(ozel)) {
    if (!oid.startsWith(KYOCERA_DAL)) continue;
    const kuyruk = oid.slice(KYOCERA_DAL.length).split('.');
    if (kuyruk.length !== 2) continue;
    bulundu = true;
    const kip = kuyruk[1];
    if (kip === '1') siyah += deger;
    else if (kip === '3') renkli += deger;
    else belirsiz += deger;
  }
  return bulundu ? { siyah, belirsiz, renkli } : null;
}

export function renkAyrimi(c: TaranmisCihaz): Ayrim {
  if (c.toplam === null || c.toplam <= 0) return { tur: 'YOK', sebep: 'SAYAC_YOK' };
  const renkli = renkliMi(c);
  if (renkli === false) return { tur: 'TEK_RENK', siyah: c.toplam };
  if (renkli === null) return { tur: 'YOK', sebep: 'RENK_BILINMIYOR' };

  if (kurumNo(c.sysObjectID) === 1347) {
    const k = kyoceraAyrimi(c.ozel);
    if (!k) return { tur: 'YOK', sebep: 'PROFIL_YOK' };
    if (k.belirsiz > 0) return { tur: 'YOK', sebep: 'BELIRSIZ_KIP' };
    if (k.siyah + k.renkli !== c.toplam) return { tur: 'YOK', sebep: 'TOPLAM_TUTMUYOR' };
    return { tur: 'DOGRULANDI', siyah: k.siyah, renkli: k.renkli, profil: 'KYOCERA' };
  }
  return { tur: 'YOK', sebep: 'PROFIL_YOK' };
}

// ── SERİ EŞLEŞTİRME ──────────────────────────────────────────────────────

/** Karşılaştırma için seri: büyük harf, boşluk ve ayraçsız. */
export function seriNormal(s: string | null | undefined): string | null {
  if (!s) return null;
  const n = s.normalize('NFKC').toUpperCase().replace(/[\s\-_./]/g, '');
  // Cihazın "bilmiyorum" deme biçimleri seri sayılmaz: eşleşirse iki
  // farklı makine aynı kayda yazılır.
  if (!n || /^0+$/.test(n) || ['NA', 'NONE', 'UNKNOWN', 'SERIALNUMBER', 'XXXXXXXX'].includes(n)) return null;
  return n;
}

export interface SistemCihazi {
  id: string;
  serialNo: string;
  reportedSerial: string | null;
  counterBlack: number | null;
  counterColor: number | null;
}

/** Seriyi bayinin cihazlarıyla eşler: etiketteki seri ya da cihazın bildirdiği. */
export function seriEsle(seri: string | null, cihazlar: readonly SistemCihazi[]): SistemCihazi[] {
  const s = seriNormal(seri);
  if (!s) return [];
  const bulunan = new Map<string, SistemCihazi>();
  for (const c of cihazlar) {
    if (seriNormal(c.serialNo) === s || seriNormal(c.reportedSerial) === s) bulunan.set(c.id, c);
  }
  return [...bulunan.values()];
}

// ── DURUM ────────────────────────────────────────────────────────────────

export type TaramaDurumu =
  | 'YAZILABILIR' // doğrulandı, eşleşti, sayaç ilerlemiş
  | 'YAZILDI'     // sayaç okuması olarak kaydedildi
  | 'DEGISMEDI'   // cihaz son okumadan beri basmamış
  | 'GERILEDI'    // cihaz son okumadan DÜŞÜK gösteriyor — başka sayaç ya da değişim
  | 'ESLESMEDI'   // seri sistemde yok
  | 'BIRDEN_FAZLA'// seri birden çok cihaza uyuyor
  | 'AYRIM_YOK'   // renkli cihaz, ayrım doğrulanamadı
  | 'SAYAC_YOK'   // cihaz toplam sayacı vermedi
  | 'HATA';       // yazarken okuma katmanı reddetti

export interface CihazSonucu {
  ip: string;
  marka: string | null;
  model: string | null;
  seri: string | null;
  deviceId: string | null;
  toplam: number | null;
  /** Yazılacak değerler (ayrım yapılabildiyse). */
  siyah: number | null;
  renkli: number | null;
  ayrim: Ayrim['tur'];
  sebep: AyrimYokSebebi | null;
  sonSiyah: number | null;
  sonRenkli: number | null;
  durum: TaramaDurumu;
  /** Yazma sırasında okuma katmanının döndürdüğü hata kodu. */
  hataKodu?: string | null;
  sarf: { ad: string; yuzde: number | null }[];
}

/** Sarf seviyesi yüzdesi. -1/-2/-3 (sınırsız / bilinmiyor / biraz var) sayı değildir. */
export function sarfYuzdesi(s: SarfHam): number | null {
  if (s.max <= 0 || s.seviye < 0) return null;
  return Math.max(0, Math.min(100, Math.round((s.seviye / s.max) * 100)));
}

/**
 * Bir cihazın taramadaki kararı. `cihazlar` bayinin sistemdeki cihazları.
 *
 * Tek renkli cihazda renkli sayaç DEĞİŞMEZ: sistemdeki son renkli değer
 * aynen korunur (fark 0). Sıfıra çekilseydi sayaç "geriledi" sayılırdı.
 */
export function cihazSonucu(c: TaranmisCihaz, cihazlar: readonly SistemCihazi[]): CihazSonucu {
  const ayrim = renkAyrimi(c);
  const esler = seriEsle(c.seri, cihazlar);
  const tek = esler.length === 1 ? esler[0] : null;
  const sonSiyah = tek?.counterBlack ?? null;
  const sonRenkli = tek?.counterColor ?? null;

  let siyah: number | null = null;
  let renkli: number | null = null;
  if (ayrim.tur === 'TEK_RENK') { siyah = ayrim.siyah; renkli = sonRenkli ?? 0; }
  else if (ayrim.tur === 'DOGRULANDI') { siyah = ayrim.siyah; renkli = ayrim.renkli; }

  let durum: TaramaDurumu;
  if (esler.length === 0) durum = 'ESLESMEDI';
  else if (esler.length > 1) durum = 'BIRDEN_FAZLA';
  else if (ayrim.tur === 'YOK') durum = ayrim.sebep === 'SAYAC_YOK' ? 'SAYAC_YOK' : 'AYRIM_YOK';
  else durum = ilerlemeDurumu(siyah!, renkli!, sonSiyah, sonRenkli);

  return {
    ip: c.ip,
    marka: marka(c),
    model: c.model ?? c.sysDescr,
    seri: c.seri,
    deviceId: tek?.id ?? null,
    toplam: c.toplam,
    siyah, renkli,
    ayrim: ayrim.tur,
    sebep: ayrim.tur === 'YOK' ? ayrim.sebep : null,
    sonSiyah, sonRenkli,
    durum,
    sarf: c.sarf.map((s) => ({ ad: s.ad, yuzde: sarfYuzdesi(s) })),
  };
}

/** Okunan değer, sistemdeki son değere göre ne durumda. */
export function ilerlemeDurumu(
  siyah: number, renkli: number, sonSiyah: number | null, sonRenkli: number | null,
): 'YAZILABILIR' | 'DEGISMEDI' | 'GERILEDI' {
  if ((sonSiyah !== null && siyah < sonSiyah) || (sonRenkli !== null && renkli < sonRenkli)) return 'GERILEDI';
  if (siyah === (sonSiyah ?? -1) && renkli === (sonRenkli ?? -1)) return 'DEGISMEDI';
  return 'YAZILABILIR';
}

/**
 * Aynı makine taramada iki kez görünebilir (iki ağ kartı, kablolu +
 * kablosuz). İkisi de yazılsaydı aynı sayaç iki okuma olurdu ve ikincisi
 * sıfır fark ya da "geriledi" üretirdi. İlk görülen kalır, diğerleri
 * BIRDEN_FAZLA olarak işaretlenir ve yazılmaz.
 */
export function tekrarlariAyikla(sonuclar: readonly CihazSonucu[]): CihazSonucu[] {
  const gorulen = new Set<string>();
  return sonuclar.map((s) => {
    if (!s.deviceId) return s;
    if (gorulen.has(s.deviceId)) return { ...s, durum: 'BIRDEN_FAZLA' as const };
    gorulen.add(s.deviceId);
    return s;
  });
}

export interface TaramaOzeti {
  bulunan: number;
  eslesen: number;
  yazilabilir: number;
  yazilan: number;
  durumlar: Partial<Record<TaramaDurumu, number>>;
}

export function taramaOzeti(sonuclar: readonly CihazSonucu[]): TaramaOzeti {
  const durumlar: Partial<Record<TaramaDurumu, number>> = {};
  for (const s of sonuclar) durumlar[s.durum] = (durumlar[s.durum] ?? 0) + 1;
  return {
    bulunan: sonuclar.length,
    eslesen: sonuclar.filter((s) => s.deviceId !== null).length,
    yazilabilir: durumlar.YAZILABILIR ?? 0,
    yazilan: durumlar.YAZILDI ?? 0,
    durumlar,
  };
}
