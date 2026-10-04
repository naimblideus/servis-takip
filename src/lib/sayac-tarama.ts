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
  /** hrDeviceStatus: 1 bilinmiyor · 2 çalışıyor · 3 uyarı · 4 test · 5 arızalı. */
  durumKodu: number | null;
  /** hrPrinterDetectedErrorState — ham bit maskesi, onaltılık ("0140"). */
  hata: string | null;
}

export interface TaramaGovdesi {
  bilgisayar: string | null;
  taranan: number;
  cihazlar: TaranmisCihaz[];
  /** Tarayıcı betiğinin sürümü ($SURUM). Eski betik arıza durumunu okumaz. */
  surum: number | null;
}

/** Panelden indirilen güncel tarayıcının sürümü (public/tarayici/*.ps1 $SURUM). */
export const TARAYICI_SURUMU = 3;

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
  const durumKodu = tamsayi(h.durumKodu);
  const hata = typeof h.hata === 'string' && /^[0-9a-f]{0,16}$/i.test(h.hata) ? h.hata.toLowerCase() : null;
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
    durumKodu: durumKodu !== null && durumKodu >= 1 && durumKodu <= 5 ? durumKodu : null,
    hata: hata || null,
  };
}

/** Tarayıcının gönderdiği gövde; biçimsizse null. */
export function taramaGovdesiAyikla(ham: unknown): TaramaGovdesi | null {
  if (!ham || typeof ham !== 'object') return null;
  const h = ham as Record<string, unknown>;
  if (!Array.isArray(h.cihazlar) || h.cihazlar.length > EN_FAZLA_CIHAZ) return null;
  const cihazlar = h.cihazlar.map(taranmisCihazAyikla).filter((c): c is TaranmisCihaz => c !== null);
  const taranan = tamsayi(h.taranan);
  const surum = tamsayi(h.surum);
  return {
    bilgisayar: metin(h.bilgisayar, 64),
    taranan: taranan !== null && taranan >= 0 ? Math.min(taranan, 1_000_000) : 0,
    cihazlar,
    surum: surum !== null && surum >= 1 && surum <= 1000 ? surum : null,
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
  /** Cihazın kendi bildirdiği durum (sıkışma, servis gerekli...). */
  uyarilar: UyariKodu[];
  /** Sarf adlarından çıkarılan toner seviyeleri. */
  olcum: SarfOlcumu;
  /**
   * Cihaz durum tablosunu verdi mi. Vermediyse (eski betik ya da bu tabloyu
   * bilmeyen cihaz) "uyarı yok" DEĞİL "bilinmiyor"dur: karttaki uyarılar ve
   * açık olaylar silinmez.
   */
  durumOkundu?: boolean;
  /** Bütün sarf kalemleri (toner + parça ömrü), yüzdesi okunabilenler. */
  kalemler?: SarfKalemi[];
  /** Parça ömrünün en düşüğü (drum, fırın, bakım kiti, atık kutusu). */
  parca?: number | null;
  /** Bu taramada siyah toner değişimi görüldü ve kaydedildi. */
  tonerDegisti?: boolean;
  /** Bu taramada kendiliğinden açılan fişin numarası. */
  fisAcildi?: string | null;
  /** Sistemde yoktu; bayi bu taramadan cihaz olarak ekledi (taramadanCihazEkle). */
  eklendi?: boolean;
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
    uyarilar: cihazUyarilari(c),
    olcum: sarfOlcumu(c),
    durumOkundu: c.hata !== null || c.durumKodu !== null,
    kalemler: sarfKalemleri(c),
    parca: parcaEnAz(sarfKalemleri(c)),
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

// ── CİHAZ DURUMU (ARIZA) ─────────────────────────────────────────────────
//
// Yönetilen baskı hizmeti veren büyük firmaların vaadi: "makinenin arıza
// durumunu online izliyoruz". Bunun standart kaynağı RFC 3805 / RFC 2790'daki
// hrPrinterDetectedErrorState: BÜTÜN markalarda aynı yerde duran bir bit
// maskesi. Bit 0 ilk baytın EN SOLDAKİ bitidir.
//
// Sınıflama bayinin işine göre:
//   SERVIS — teknisyen gerektirir (servis istendi, bakım gecikti, sıkışma,
//            sarf takılı değil, cihaz arızalı)
//   SARF   — toner gönderilmeli
//   BILGI  — müşterinin kendi çözdüğü (kâğıt, kapak, tepsi, kapalı)

export type UyariKodu =
  | 'SERVIS_GEREKLI' | 'BAKIM_GECIKTI' | 'SIKISMA' | 'SARF_TAKILI_DEGIL' | 'CIHAZ_ARIZALI'
  | 'TONER_YOK' | 'TONER_AZ'
  | 'KAGIT_YOK' | 'KAGIT_AZ' | 'KAPAK_ACIK' | 'CEVRIMDISI' | 'KASET_YOK' | 'KASET_BOS'
  | 'CIKIS_TEPSISI_YOK' | 'CIKIS_DOLU' | 'CIKIS_DOLMAK_UZERE';

export type UyariTuru = 'SERVIS' | 'SARF' | 'BILGI';

export const UYARI_TURU: Readonly<Record<UyariKodu, UyariTuru>> = {
  SERVIS_GEREKLI: 'SERVIS', BAKIM_GECIKTI: 'SERVIS', SIKISMA: 'SERVIS', SARF_TAKILI_DEGIL: 'SERVIS', CIHAZ_ARIZALI: 'SERVIS',
  TONER_YOK: 'SARF', TONER_AZ: 'SARF',
  KAGIT_YOK: 'BILGI', KAGIT_AZ: 'BILGI', KAPAK_ACIK: 'BILGI', CEVRIMDISI: 'BILGI', KASET_YOK: 'BILGI', KASET_BOS: 'BILGI',
  CIKIS_TEPSISI_YOK: 'BILGI', CIKIS_DOLU: 'BILGI', CIKIS_DOLMAK_UZERE: 'BILGI',
};

// [bayt, maske, kod] — RFC 2790 hrPrinterDetectedErrorState
const HATA_BITLERI: readonly [number, number, UyariKodu][] = [
  [0, 0x80, 'KAGIT_AZ'], [0, 0x40, 'KAGIT_YOK'], [0, 0x20, 'TONER_AZ'], [0, 0x10, 'TONER_YOK'],
  [0, 0x08, 'KAPAK_ACIK'], [0, 0x04, 'SIKISMA'], [0, 0x02, 'CEVRIMDISI'], [0, 0x01, 'SERVIS_GEREKLI'],
  [1, 0x80, 'KASET_YOK'], [1, 0x40, 'CIKIS_TEPSISI_YOK'], [1, 0x20, 'SARF_TAKILI_DEGIL'], [1, 0x10, 'CIKIS_DOLMAK_UZERE'],
  [1, 0x08, 'CIKIS_DOLU'], [1, 0x04, 'KASET_BOS'], [1, 0x02, 'BAKIM_GECIKTI'],
];

const TUR_SIRASI: Record<UyariTuru, number> = { SERVIS: 0, SARF: 1, BILGI: 2 };

/** Cihazın bildirdiği uyarılar — servis önce, sarf sonra, bilgi en sonda. */
export function cihazUyarilari(c: Pick<TaranmisCihaz, 'hata' | 'durumKodu'>): UyariKodu[] {
  const kodlar = new Set<UyariKodu>();
  const hex = c.hata ?? '';
  const bayt = (i: number) => (hex.length >= (i + 1) * 2 ? parseInt(hex.slice(i * 2, i * 2 + 2), 16) : 0);
  for (const [i, maske, kod] of HATA_BITLERI) if (bayt(i) & maske) kodlar.add(kod);
  if (c.durumKodu === 5) kodlar.add('CIHAZ_ARIZALI');
  return [...kodlar].sort((a, b) => TUR_SIRASI[UYARI_TURU[a]] - TUR_SIRASI[UYARI_TURU[b]]);
}

// ── TONER SEVİYESİ ───────────────────────────────────────────────────────
//
// Sarf tablosunda toner dışında atık toner kutusu, drum, fırın, bakım kiti
// de var; onlar toner yüzdesi sanılırsa "toner %3" uyarısı atık kutusundan
// gelir. Toner adayı: toner olmayanlar elendikten sonra adında toner/kartuş
// ya da renk geçen kalem.
const TONER_DISI = /drum|imaging|waste|at[ıi]k|fuser|f[ıi]r[ıi]n|belt|kay[ıi][sş]|maintenance|bak[ıi]m|developer|geli[sş]tirici|staple|z[ıi]mba|transfer|roller|merdane/i;
const TONER_ADI = /toner|cartridge|kartu[sş]|ink|m[üu]rekkep/i;

export interface SarfOlcumu {
  /** Siyah toner yüzdesi. */
  siyah: number | null;
  /** Renkli tonerlerin en düşüğü — ilk biten renk. */
  renkli: number | null;
}

const tonerAdayi = (ad: string) => !TONER_DISI.test(ad) && (TONER_ADI.test(ad) || SIYAH_ADI.test(ad) || RENKLI_ADI.test(ad));

export function sarfOlcumu(c: Pick<TaranmisCihaz, 'sarf'>): SarfOlcumu {
  const adaylar = c.sarf
    .filter((s) => tonerAdayi(s.ad))
    .map((s) => ({ ad: s.ad, yuzde: sarfYuzdesi(s) }))
    .filter((s): s is { ad: string; yuzde: number } => s.yuzde !== null);
  const enAz = (l: number[]) => (l.length ? Math.min(...l) : null);
  const siyahlar = adaylar.filter((s) => SIYAH_ADI.test(s.ad)).map((s) => s.yuzde);
  const renkliler = adaylar.filter((s) => RENKLI_ADI.test(s.ad)).map((s) => s.yuzde);
  // Tek tonerli makine ("Toner Cartridge") renk söylemez: renkli kalem yoksa o tek kalem siyahtır.
  const siyah = siyahlar.length ? enAz(siyahlar) : !renkliler.length && adaylar.length === 1 ? adaylar[0].yuzde : null;
  return { siyah, renkli: enAz(renkliler) };
}

/**
 * Toner değişti mi? Önceki ölçüm bitmeye yakın, yeni ölçüm dolu ve arada
 * büyük bir sıçrama varsa evet. Ölçüm gürültüsü (%42 → %45) ya da toneri
 * yarıda değiştirme bu eşiklere takılmaz: emin olmadığımız değişim yazılmaz,
 * çünkü yanlış bir değişim kaydı toner verimini bozar.
 */
export const DEGISIM_ESIGI = { onceEnFazla: 30, sonraEnAz: 80, sicramaEnAz: 50 } as const;

export function tonerDegistiMi(onceki: number | null | undefined, simdi: number | null | undefined): boolean {
  if (onceki == null || simdi == null) return false;
  return onceki <= DEGISIM_ESIGI.onceEnFazla && simdi >= DEGISIM_ESIGI.sonraEnAz && simdi - onceki >= DEGISIM_ESIGI.sicramaEnAz;
}

// ── PANEL ────────────────────────────────────────────────────────────────

/** Bu yüzde ve altındaki toner "bitmek üzere" sayılır. */
export const TONER_KRITIK = 15;
/** Bundan eski ölçüm ekranda "güncel" sayılmaz (tarayıcı her gün çalışır). */
export const DURUM_TAZE_MS = 3 * 86_400_000;
/** Bu kadar süre tarama göndermeyen bilgisayar "sessiz" sayılır. */
export const SESSIZ_MS = 3 * 86_400_000;

/**
 * Uyarıdan fiş açılırken önerilen arıza kategorisi. Teknisyenin teşhis
 * edeceği uyarılarda (servis gerekli, cihaz arızalı) öneri YOK: cihaz
 * "bir şey bozuk" diyor, neyin bozuk olduğunu söylemiyor.
 */
export const UYARI_KATEGORISI: Partial<Record<UyariKodu, string>> = {
  SIKISMA: 'PAPER_JAM',
  BAKIM_GECIKTI: 'PERIODIC_MAINTENANCE',
  SARF_TAKILI_DEGIL: 'CONSUMABLE',
  TONER_YOK: 'CONSUMABLE',
  TONER_AZ: 'CONSUMABLE',
};

/** Teknisyen gerektiren uyarı kodları (veritabanı sorgusu için). */
export const SERVIS_UYARILARI = (Object.keys(UYARI_TURU) as UyariKodu[]).filter((k) => UYARI_TURU[k] === 'SERVIS');

/** Ekrandaki sıra: servis isteyenler → toneri bitenler → parça ömrü → bilgi. Aynı türde en düşük yüzde önce. */
export function dikkatSirasi(c: { uyarilar: readonly UyariKodu[]; olcumSiyah: number | null; olcumRenkli: number | null; olcumParca?: number | null }): number {
  const enAz = Math.min(c.olcumSiyah ?? 101, c.olcumRenkli ?? 101);
  if (c.uyarilar.some((u) => UYARI_TURU[u] === 'SERVIS')) return 0;
  if (c.uyarilar.some((u) => UYARI_TURU[u] === 'SARF') || enAz <= TONER_KRITIK) return 1000 + enAz;
  if ((c.olcumParca ?? 101) <= PARCA_KRITIK) return 1500 + (c.olcumParca as number);
  return 2000;
}

// ── PARÇA ÖMRÜ ───────────────────────────────────────────────────────────
//
// Toner dışındaki kalemler (drum, fırın, transfer kayışı, bakım kiti, atık
// toner kutusu) servis ziyareti demektir: biri bitince teknisyen gider.
// RFC 3805: atık kutusu gibi DOLAN kalemlerde seviye KALAN BOŞ YER'dir —
// yani her kalemde düşük yüzde "değişmeli" anlamına gelir.

/** Bu yüzde ve altındaki parça "bitmek üzere" sayılır. */
export const PARCA_KRITIK = 10;

export interface SarfKalemi { ad: string; yuzde: number; tur: 'TONER' | 'PARCA' }

export function sarfKalemleri(c: Pick<TaranmisCihaz, 'sarf'>): SarfKalemi[] {
  const l: SarfKalemi[] = [];
  for (const s of c.sarf) {
    const yuzde = sarfYuzdesi(s);
    if (yuzde === null) continue;
    l.push({ ad: s.ad.slice(0, 80), yuzde, tur: tonerAdayi(s.ad) ? 'TONER' : 'PARCA' });
  }
  return l.slice(0, 24);
}

/** Biten parçadan fiş açılırken önerilen kategori. Ad bir şey söylemiyorsa öneri yok. */
export function parcaKategorisi(ad: string | null | undefined): string | null {
  const a = ad ?? '';
  if (/drum|imaging|dram/i.test(a)) return 'DRUM';
  if (/fuser|f[ıi]r[ıi]n/i.test(a)) return 'FUSER';
  if (/maintenance|bak[ıi]m/i.test(a)) return 'PERIODIC_MAINTENANCE';
  if (/waste|at[ıi]k/i.test(a)) return 'CONSUMABLE';
  if (/roller|merdane|pick/i.test(a)) return 'ROLLER';
  return null;
}

export function parcaEnAz(kalemler: readonly SarfKalemi[]): number | null {
  const p = kalemler.filter((k) => k.tur === 'PARCA').map((k) => k.yuzde);
  return p.length ? Math.min(...p) : null;
}

// ── UYARI GEÇMİŞİ VE OTOMATİK FİŞ ───────────────────────────────────────

/** Açık olaylarla bu taramanın uyarıları: hangisi yeni başladı, hangisi sürüyor, hangisi bitti. */
export function olayFarki(acik: readonly string[], simdi: readonly string[]): { yeni: string[]; suren: string[]; biten: string[] } {
  const a = new Set(acik), s = new Set(simdi);
  return {
    yeni: [...s].filter((k) => !a.has(k)),
    suren: [...s].filter((k) => a.has(k)),
    biten: [...a].filter((k) => !s.has(k)),
  };
}

/**
 * Servis uyarısı kaç taramada üst üste görülürse fiş kendiliğinden açılır.
 * İki: müşterinin kendisinin giderdiği tek seferlik bir sıkışma fiş
 * kuyruğuna düşmesin; ertesi sabah hâlâ duruyorsa gerçek bir iştir.
 */
export const OTOMATIK_FIS_GORULME = 2;

/** Fiş açtıracak olaylar: servis türü, yeterince görülmüş, henüz bir fişe bağlanmamış. */
export function fisAcacakOlaylar<T extends { kod: string; gorulme: number; ticketId: string | null }>(olaylar: readonly T[]): T[] {
  return olaylar.filter((o) => UYARI_TURU[o.kod as UyariKodu] === 'SERVIS' && o.gorulme >= OTOMATIK_FIS_GORULME && !o.ticketId);
}
