/**
 * SLA — SÖZLEŞMEDEKİ MÜDAHALE VE ÇÖZÜM SÜRESİ.
 *
 * ── NİYE VAR ─────────────────────────────────────────────────────────────
 * Büyük müşterinin sözleşmesinde tek bir cümle vardır ve her şey ona bakar:
 * "arıza bildiriminden itibaren 4 saat içinde müdahale, 24 saat içinde
 * çözüm". Bayi bu cümleyi imzalıyor ama tutup tutmadığını ÖLÇEMİYOR.
 * Yıl sonunda müşteri "siz geciktiniz" dediğinde elinde rakam yok; müşteri
 * de kendi rakamını getiriyor ve pazarlık oradan başlıyor.
 *
 * Bu dosya o cümleyi ölçülebilir hale getirir. Tahmin üretmez: yalnız fişin
 * GERÇEK aşama geçişlerine bakar.
 *
 * ── ÇALIŞMA SAATİ, DUVAR SAATİ DEĞİL ─────────────────────────────────────
 * Bu ölçümün tek zor yeri budur ve yanlış yapılırsa rapor işe yaramaz.
 * Cuma 17:30'da açılan, pazartesi 09:00'da müdahale edilen fiş 63 saat
 * GEÇMEMİŞTİR: sözleşme mesai saatini konuşur. Ham süreyi gösteren bir
 * rapor bayiyi haksız yere suçlu çıkarır ve kimse ona güvenmez.
 *
 * Takvim bayinindir (ne zaman çalışıyoruz), hedef sözleşmenindir (ne söz
 * verdik). İkisi ayrı yerde durur.
 *
 * ── SAAT DURUYOR MU ──────────────────────────────────────────────────────
 * "Parça bekleniyor" sürerken saatin durup durmayacağı sözleşmeden
 * sözleşmeye değişir ve en çok tartışılan maddedir. Bu yüzden:
 *   · seçenek sözleşmede tutulur, varsayılan KAPALI (katı olan dürüst olandır),
 *   · rapor HER ZAMAN iki sayıyı da taşır — ham ve duraklamalı.
 * Böylece kimse tek bir ayarı değiştirip sessizce ihlali yok edemez.
 *
 * ── TÜRETİLMİŞ GEÇMİŞ ÖLÇÜME GİRMEZ ──────────────────────────────────────
 * Eski fişlerin ara aşamaları bilinmiyordu; `kaynak: 'GECMIS'` satırları
 * createdAt/statusUpdatedAt'ten TÜRETİLDİ. Bunları ölçüme katmak, uydurulmuş
 * zaman damgasından uyum oranı üretmek olurdu. Kapsam dışı bırakılır ve kaç
 * fişin bu sebeple dışarıda kaldığı raporda yazar.
 *
 * Bu dosya SAFtır: React yok, Prisma yok. Testi veritabanı istemez.
 */

/** Bayinin çalışma takvimi — "ne zaman çalışıyoruz". */
export interface CalismaTakvimi {
  /** IANA saat dilimi, ör. 'Europe/Istanbul'. Yaz saati bununla çözülür. */
  zamanDilimi: string;
  /** Çalışılan günler: 0=Pazar … 6=Cumartesi. */
  gunler: number[];
  /** Gün içi başlangıç, gece yarısından dakika (09:00 → 540). */
  baslangicDk: number;
  /** Gün içi bitiş (18:00 → 1080). baslangicDk'dan büyük olmalı. */
  bitisDk: number;
  /** Kapalı günler — 'YYYY-MM-DD' (bayinin yerel tarihi). */
  tatiller: string[];
}

/** Sözleşmedeki söz — "ne vaat ettik". null = o kalem konuşulmamış. */
export interface SlaHedefi {
  /** Müdahale süresi, ÇALIŞMA dakikası. */
  mudahaleDk: number | null;
  /** Çözüm süresi, ÇALIŞMA dakikası. */
  cozumDk: number | null;
  /** "Parça bekleniyor" sürerken saat dursun mu? */
  parcaDurdurur: boolean;
}

export const VARSAYILAN_TAKVIM: CalismaTakvimi = {
  zamanDilimi: 'Europe/Istanbul',
  gunler: [1, 2, 3, 4, 5],
  baslangicDk: 9 * 60,
  bitisDk: 18 * 60,
  tatiller: [],
};

// ─────────────────────────────────────────────────────────────────────────
// Saat dilimi yardımcıları
// ─────────────────────────────────────────────────────────────────────────

interface YerelDamga {
  yil: number;
  ay: number;   // 1-12
  gun: number;  // 1-31
  dakika: number; // gece yarısından
  haftaGunu: number; // 0=Pazar
}

const BICIM = new Map<string, Intl.DateTimeFormat>();
function bicimleyici(tz: string): Intl.DateTimeFormat {
  let f = BICIM.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short',
    });
    BICIM.set(tz, f);
  }
  return f;
}

const HAFTA: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Bir ANI, verilen saat diliminde yerel damgaya çevirir. */
export function yerelDamga(an: Date, tz: string): YerelDamga {
  const p = bicimleyici(tz).formatToParts(an);
  const al = (t: string) => p.find((x) => x.type === t)?.value ?? '0';
  // hour12:false bazı ortamlarda gece yarısını '24' verir.
  const saat = Number(al('hour')) % 24;
  return {
    yil: Number(al('year')),
    ay: Number(al('month')),
    gun: Number(al('day')),
    dakika: saat * 60 + Number(al('minute')),
    haftaGunu: HAFTA[p.find((x) => x.type === 'weekday')?.value ?? 'Sun'] ?? 0,
  };
}

/** Saat diliminin o andaki UTC farkı (dakika). */
function fark(an: Date, tz: string): number {
  const y = yerelDamga(an, tz);
  const yerelUtc = Date.UTC(y.yil, y.ay - 1, y.gun, 0, 0, 0, 0) + y.dakika * 60_000;
  return (yerelUtc - an.getTime()) / 60_000;
}

/**
 * YEREL duvar saatini ANA çevirir.
 *
 * İki turlu: ilk tahminin farkıyla düzeltip farkı yeniden ölçüyoruz. Yaz
 * saati geçişinde fark değişir ve tek turlu hesap bir saat kayardı — bu,
 * yılda iki kez yanlış rapor demektir.
 */
export function anaCevir(yil: number, ay: number, gun: number, dakika: number, tz: string): Date {
  const kaba = Date.UTC(yil, ay - 1, gun, 0, 0, 0, 0) + dakika * 60_000;
  let an = new Date(kaba - fark(new Date(kaba), tz) * 60_000);
  an = new Date(kaba - fark(an, tz) * 60_000);
  return an;
}

const gunAnahtari = (y: YerelDamga) =>
  `${y.yil}-${String(y.ay).padStart(2, '0')}-${String(y.gun).padStart(2, '0')}`;

// ─────────────────────────────────────────────────────────────────────────
// Çalışma süresi
// ─────────────────────────────────────────────────────────────────────────

/** Takvim kullanılabilir mi — bozuk ayar sessizce sıfır süre üretmesin. */
export function takvimGecerli(t: CalismaTakvimi): boolean {
  return (
    Array.isArray(t.gunler) && t.gunler.length > 0 &&
    Number.isFinite(t.baslangicDk) && Number.isFinite(t.bitisDk) &&
    t.baslangicDk >= 0 && t.bitisDk <= 24 * 60 && t.bitisDk > t.baslangicDk
  );
}

/**
 * İki an arasındaki ÇALIŞMA dakikası.
 *
 * Gün gün yürür; her günün çalışma penceresiyle [bas, son] aralığının
 * kesişimini toplar. Tatil ve çalışılmayan gün sayılmaz.
 * Takvim bozuksa null döner — sıfır DÖNMEZ, çünkü sıfır "hemen müdahale
 * edildi" gibi okunur ve ihlali gizler.
 */
export function calismaDakikasi(bas: Date, son: Date, t: CalismaTakvimi): number | null {
  if (!takvimGecerli(t)) return null;
  if (!(bas instanceof Date) || !(son instanceof Date)) return null;
  if (!Number.isFinite(bas.getTime()) || !Number.isFinite(son.getTime())) return null;
  if (son.getTime() <= bas.getTime()) return 0;

  const tatil = new Set(t.tatiller ?? []);
  const gunKumesi = new Set(t.gunler);
  let toplam = 0;

  // Başlangıcın yerel gününden başla, bitişin gününü de kapsa.
  const ilk = yerelDamga(bas, t.zamanDilimi);
  let imlec = anaCevir(ilk.yil, ilk.ay, ilk.gun, 0, t.zamanDilimi);

  // Emniyet: 10 yıldan uzun aralıkta dönmeyi bırak (bozuk veri).
  const TAVAN = 3700;
  for (let i = 0; i < TAVAN; i++) {
    const g = yerelDamga(imlec, t.zamanDilimi);
    const gunBasi = anaCevir(g.yil, g.ay, g.gun, 0, t.zamanDilimi);
    if (gunBasi.getTime() > son.getTime()) break;

    if (gunKumesi.has(g.haftaGunu) && !tatil.has(gunAnahtari(g))) {
      const acilis = anaCevir(g.yil, g.ay, g.gun, t.baslangicDk, t.zamanDilimi);
      const kapanis = anaCevir(g.yil, g.ay, g.gun, t.bitisDk, t.zamanDilimi);
      const b = Math.max(acilis.getTime(), bas.getTime());
      const s = Math.min(kapanis.getTime(), son.getTime());
      if (s > b) toplam += (s - b) / 60_000;
    }

    // Sonraki güne geç: 36 saat ekleyip yerel gün başına yasla (yaz saati
    // geçişinde 24 saat eklemek aynı günde bırakabilir ya da bir gün atlatır).
    const sonraki = new Date(gunBasi.getTime() + 36 * 3_600_000);
    const sg = yerelDamga(sonraki, t.zamanDilimi);
    imlec = anaCevir(sg.yil, sg.ay, sg.gun, 0, t.zamanDilimi);
  }

  return Math.round(toplam);
}

// ─────────────────────────────────────────────────────────────────────────
// Fiş ölçümü
// ─────────────────────────────────────────────────────────────────────────

/** Ölçüme giren ham olaylar — aşama geçmişinden türetilir. */
export interface FisOlaylari {
  acilis: Date;
  /** İlk kez işe başlanan an (IN_SERVICE). Hiç başlanmadıysa null. */
  ilkMudahale: Date | null;
  /** İş biten an (READY ya da DELIVERED — hangisi önceyse). Bitmediyse null. */
  cozum: Date | null;
  /** "Parça bekleniyor" aralıkları. son null = hâlâ sürüyor. */
  duraklamalar: { bas: Date; son: Date | null }[];
  /** Geçmişi TÜRETİLMİŞ fiş — ölçüme girmez. */
  turetilmis: boolean;
  /** İptal edilmiş fiş — çözüm beklenmez. */
  iptal: boolean;
}

export interface SlaOlcum {
  /** Ölçüm yapılabildi mi; değilse sebebi. */
  kapsamda: boolean;
  disKalmaKodu: 'TURETILMIS_GECMIS' | 'TAKVIM_GECERSIZ' | 'HEDEF_YOK' | null;
  /** Ham (duraklama düşülmemiş) çalışma dakikası. */
  mudahaleHamDk: number | null;
  cozumHamDk: number | null;
  /** Duraklamalar düşülmüş çalışma dakikası. */
  mudahaleDk: number | null;
  cozumDk: number | null;
  /** Hedefe göre ihlal — hedef yoksa ya da ölçülemiyorsa null. */
  mudahaleIhlal: boolean | null;
  cozumIhlal: boolean | null;
  /** Ölçüm bitmemiş iş için "şu ana kadar" mı? */
  mudahaleAcik: boolean;
  cozumAcik: boolean;
}

const BOS: SlaOlcum = {
  kapsamda: false, disKalmaKodu: null,
  mudahaleHamDk: null, cozumHamDk: null, mudahaleDk: null, cozumDk: null,
  mudahaleIhlal: null, cozumIhlal: null, mudahaleAcik: false, cozumAcik: false,
};

/**
 * Bir aralıktaki DURAKLAMA dakikası — yalnız çalışma saatine denk gelen kısmı.
 * Parça gece beklendiyse zaten çalışılmıyordu; onu ayrıca düşmek süreyi iki
 * kez indirir ve ihlali gizler.
 */
function duraklamaDakikasi(
  duraklamalar: { bas: Date; son: Date | null }[],
  pencereBas: Date, pencereSon: Date, t: CalismaTakvimi,
): number {
  let toplam = 0;
  for (const d of duraklamalar) {
    const b = new Date(Math.max(d.bas.getTime(), pencereBas.getTime()));
    const s = new Date(Math.min((d.son ?? pencereSon).getTime(), pencereSon.getTime()));
    if (s.getTime() <= b.getTime()) continue;
    toplam += calismaDakikasi(b, s, t) ?? 0;
  }
  return toplam;
}

/**
 * Fişin SLA ölçümü.
 *
 * @param simdi Açık işlerde "şu ana kadar" hesabı için. Testin zamanı
 *              sabitleyebilmesi için parametre — modül içinde saat okunmaz.
 */
export function slaOlcumu(
  olay: FisOlaylari,
  hedef: SlaHedefi,
  takvim: CalismaTakvimi,
  simdi: Date,
): SlaOlcum {
  if (olay.turetilmis) return { ...BOS, disKalmaKodu: 'TURETILMIS_GECMIS' };
  if (!takvimGecerli(takvim)) return { ...BOS, disKalmaKodu: 'TAKVIM_GECERSIZ' };
  if (hedef.mudahaleDk === null && hedef.cozumDk === null) {
    return { ...BOS, disKalmaKodu: 'HEDEF_YOK' };
  }

  const mudahaleSonu = olay.ilkMudahale ?? simdi;
  const mudahaleAcik = olay.ilkMudahale === null;
  const mudahaleHamDk = calismaDakikasi(olay.acilis, mudahaleSonu, takvim);

  // ÇÖZÜM: iptal edilmiş fişte çözüm beklenmez — ihlal sayılmaz.
  const cozumSonu = olay.cozum ?? simdi;
  const cozumAcik = olay.cozum === null && !olay.iptal;
  const cozumOlculur = !olay.iptal;
  const cozumHamDk = cozumOlculur ? calismaDakikasi(olay.acilis, cozumSonu, takvim) : null;

  // Duraklama YALNIZCA sözleşme öyle diyorsa düşülür.
  const mudahaleDus = hedef.parcaDurdurur
    ? duraklamaDakikasi(olay.duraklamalar, olay.acilis, mudahaleSonu, takvim) : 0;
  const cozumDus = hedef.parcaDurdurur && cozumOlculur
    ? duraklamaDakikasi(olay.duraklamalar, olay.acilis, cozumSonu, takvim) : 0;

  const mudahaleDk = mudahaleHamDk === null ? null : Math.max(0, mudahaleHamDk - mudahaleDus);
  const cozumDk = cozumHamDk === null ? null : Math.max(0, cozumHamDk - cozumDus);

  // İHLAL KURALI: hedef aşılmışsa ihlaldir. Açık işte de geçerli — "henüz
  // bitmedi" ihlali ertelemez, tersine erken görünmesi gerekir.
  const ihlal = (sure: number | null, hedefDk: number | null) =>
    sure === null || hedefDk === null ? null : sure > hedefDk;

  return {
    kapsamda: true,
    disKalmaKodu: null,
    mudahaleHamDk, cozumHamDk, mudahaleDk, cozumDk,
    mudahaleIhlal: ihlal(mudahaleDk, hedef.mudahaleDk),
    cozumIhlal: ihlal(cozumDk, hedef.cozumDk),
    mudahaleAcik, cozumAcik,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Aşama geçmişinden olay çıkarma
// ─────────────────────────────────────────────────────────────────────────

export interface AsamaSatiri {
  status: string;
  changedAt: Date;
  kaynak: string;
}

/**
 * Aşama geçmişini ölçülebilir olaylara çevirir.
 *
 * `acilisYedegi` fişin createdAt'idir: geçmişte NEW satırı yoksa açılış anı
 * odur. NEW satırı hiç yazılmamış olabilir (fiş eski yoldan açılmış).
 */
export function olaylariCikar(satirlar: AsamaSatiri[], acilisYedegi: Date): FisOlaylari {
  const sirali = [...satirlar].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
  const turetilmis = sirali.length === 0 || sirali.some((s) => s.kaynak === 'GECMIS');

  const ilk = (durum: string) => sirali.find((s) => s.status === durum)?.changedAt ?? null;
  const acilis = ilk('NEW') ?? acilisYedegi;

  const hazir = ilk('READY');
  const teslim = ilk('DELIVERED');
  const cozum = hazir && teslim ? (hazir < teslim ? hazir : teslim) : (hazir ?? teslim);

  // Parça bekleme aralıkları: WAITING_FOR_PART satırından bir sonraki
  // farklı duruma kadar.
  const duraklamalar: { bas: Date; son: Date | null }[] = [];
  for (let i = 0; i < sirali.length; i++) {
    if (sirali[i].status !== 'WAITING_FOR_PART') continue;
    const sonraki = sirali.slice(i + 1).find((s) => s.status !== 'WAITING_FOR_PART');
    duraklamalar.push({ bas: sirali[i].changedAt, son: sonraki?.changedAt ?? null });
  }

  return {
    acilis,
    ilkMudahale: ilk('IN_SERVICE'),
    cozum,
    duraklamalar,
    turetilmis,
    iptal: sirali.some((s) => s.status === 'CANCELLED'),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Özet
// ─────────────────────────────────────────────────────────────────────────

export interface SlaOzeti {
  /** Ölçüme giren fiş sayısı. */
  olculen: number;
  /** Türetilmiş geçmişi olduğu için dışarıda kalan fiş sayısı. */
  turetilmisDisi: number;
  /** Hedefi tanımlı olmadığı için dışarıda kalan fiş sayısı. */
  hedefsizDisi: number;
  mudahaleOlculen: number;
  mudahaleIhlal: number;
  cozumOlculen: number;
  cozumIhlal: number;
  /** Uyum yüzdesi — ölçülen yoksa null (0 demek yanıltıcı olurdu). */
  mudahaleUyumYuzde: number | null;
  cozumUyumYuzde: number | null;
  /** Ortanca süre (dakika) — ortalama değil: tek bir uzun fiş ortalamayı bozar. */
  mudahaleOrtancaDk: number | null;
  cozumOrtancaDk: number | null;
}

const ortanca = (a: number[]): number | null => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : Math.round((s[o - 1] + s[o]) / 2);
};

export function slaOzeti(olcumler: SlaOlcum[]): SlaOzeti {
  const kapsam = olcumler.filter((o) => o.kapsamda);
  const mudahaleler = kapsam.filter((o) => o.mudahaleIhlal !== null);
  const cozumler = kapsam.filter((o) => o.cozumIhlal !== null);
  const mIhlal = mudahaleler.filter((o) => o.mudahaleIhlal).length;
  const cIhlal = cozumler.filter((o) => o.cozumIhlal).length;
  const yuzde = (ihlal: number, toplam: number) =>
    toplam === 0 ? null : Math.round(((toplam - ihlal) / toplam) * 1000) / 10;

  return {
    olculen: kapsam.length,
    turetilmisDisi: olcumler.filter((o) => o.disKalmaKodu === 'TURETILMIS_GECMIS').length,
    hedefsizDisi: olcumler.filter((o) => o.disKalmaKodu === 'HEDEF_YOK').length,
    mudahaleOlculen: mudahaleler.length,
    mudahaleIhlal: mIhlal,
    cozumOlculen: cozumler.length,
    cozumIhlal: cIhlal,
    mudahaleUyumYuzde: yuzde(mIhlal, mudahaleler.length),
    cozumUyumYuzde: yuzde(cIhlal, cozumler.length),
    mudahaleOrtancaDk: ortanca(mudahaleler.map((o) => o.mudahaleDk!).filter((n) => n !== null)),
    cozumOrtancaDk: ortanca(cozumler.map((o) => o.cozumDk!).filter((n) => n !== null)),
  };
}
