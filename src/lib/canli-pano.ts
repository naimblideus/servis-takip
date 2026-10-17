/**
 * CANLI OPERASYON PANOSU — SAF HESAP.
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Operasyon odasındaki televizyonda açık durur; teknisyen, ön büro ve sahip
 * aynı ekrana bakar. Ana panelden farkı: TIKLANMAK için değil UZAKTAN
 * OKUNMAK için. Her kutu tek bir soruya tek bir sayıyla cevap verir: kaç iş
 * açık, hangisinin süresi doluyor, kim nerede, hangi makine ses veriyor.
 *
 * ── PARA YOK ─────────────────────────────────────────────────────────────
 * Ekran herkese açık bir odada durur: misafir, kurye, müşteri görebilir.
 * Buradaki hiçbir yapıda tutar alanı yok; veri katmanı da tutar SEÇMEZ
 * (test kaynağından denetler).
 *
 * ── UYDURMA YOK ──────────────────────────────────────────────────────────
 * · SLA kutusu yalnız SLA hedefi YAZILI sözleşme varsa çıkar. Hedef yokken
 *   "0 gecikme" yazmak "her şey yolunda" demek olurdu — bilmiyoruz.
 * · Süre, SLA raporuyla AYNI motordan (lib/sla.ts): çalışma saati, tatil,
 *   yaz saati, parça beklemesi aynı kuralla. Pano "geçmedi" derken ay sonu
 *   raporu "geçti" demesin.
 * · Teknisyenin "şu anki işi" yalnız kayıttan: "Vardım" denmiş (sahada) ya
 *   da fiş "Serviste". Kayıt yoksa "boşta" denmez, "açık işi yok" denir:
 *   ne yaptığını bilmiyoruz.
 *
 * Bu dosya SAFtır: React yok, Prisma yok. Testte doğrudan derlenir ve
 * istemci bileşeni de buradan okur.
 */
import {
  anaCevir, calismaDakikasi, slaOlcumu, yerelDamga,
  type CalismaTakvimi, type FisOlaylari, type SlaHedefi,
} from '@/lib/sla';

const DK = 60_000;

/** Panoda "açık" sayılan durumlar — sıra, ekrandaki sıradır. */
export const ACIK_DURUMLAR = ['NEW', 'IN_SERVICE', 'WAITING_FOR_PART', 'READY'] as const;
export type AcikDurum = (typeof ACIK_DURUMLAR)[number];

/** İşi henüz bitmemiş durumlar. "Hazır" açıktır ama iş yapılmıştır. */
export const SURUYOR: readonly AcikDurum[] = ['NEW', 'IN_SERVICE', 'WAITING_FOR_PART'];

export function acikMi(s: string): s is AcikDurum {
  return (ACIK_DURUMLAR as readonly string[]).includes(s);
}

/** Ekran kaç saniyede bir tazelenir. */
export const YOKLAMA_SN = 15;

/** SLA "yaklaşıyor" penceresi — DUVAR saati dakikası. */
export const SLA_YAKLASAN_DK = 60;

/**
 * Sayacı geç kalan kiralık cihaz: son okuması bu kadar günden eski ya da hiç
 * okunmamış. Ana paneldeki "Sayacı gelmeyen cihaz" kartı ve /api/sayac/eksik
 * ile AYNI ölçüt — üç ekran üç ayrı sayı söylerse bayi hiçbirine inanmaz
 * (test iki kaynağın da 35 dediğini denetler). "Bu dönem okundu mu" ölçütü
 * ayın başında her cihazı eksik gösterir; o yüzden kullanılmıyor.
 */
export const SAYAC_GEC_GUN = 35;

/** Akışta gösterilen olay sayısı. */
export const OLAY_SAYISI = 10;

// ─────────────────────────────────────────────────────────────────────────
// Fiş sayıları
// ─────────────────────────────────────────────────────────────────────────

export interface FisSayilari {
  toplam: number;
  durum: Record<AcikDurum, number>;
}

/**
 * groupBy satırlarından açık fiş sayıları. Gelmeyen durum SIFIRDIR (kutu
 * boş kalmaz); açık olmayan durum (teslim, iptal) toplama girmez.
 */
export function fisSayilari(satirlar: readonly { status: string; adet: number }[]): FisSayilari {
  const durum: Record<AcikDurum, number> = { NEW: 0, IN_SERVICE: 0, WAITING_FOR_PART: 0, READY: 0 };
  for (const s of satirlar) {
    if (!acikMi(s.status)) continue;
    const n = Math.trunc(Number(s.adet));
    if (n > 0) durum[s.status] += n;
  }
  return { toplam: ACIK_DURUMLAR.reduce((t, k) => t + durum[k], 0), durum };
}

/**
 * Bayinin YEREL gününün başlangıcı.
 *
 * "Bugün açılan" sunucunun saatine göre sayılırsa (sunucu UTC'de) İstanbul'da
 * gün 03:00'te başlar; gece 01:00'de açılan fiş "dün" sayılır. Gün, bayinin
 * çalışma takvimindeki saat diliminden kurulur. Bozuk saat dilimi adı panoyu
 * düşürmesin diye İstanbul'a düşer.
 */
export function gununBasi(simdi: Date, zamanDilimi: string): Date {
  for (const tz of [zamanDilimi, 'Europe/Istanbul']) {
    try {
      const y = yerelDamga(simdi, tz);
      return anaCevir(y.yil, y.ay, y.gun, 0, tz);
    } catch { /* geçersiz saat dilimi: bir sonrakini dene */ }
  }
  return new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
}

// ─────────────────────────────────────────────────────────────────────────
// SLA kutusu
// ─────────────────────────────────────────────────────────────────────────

export interface SlaFisGirdisi {
  id: string;
  ticketNumber: string;
  musteri: string;
  cihaz: string;
  olay: FisOlaylari;
  hedef: SlaHedefi;
}

export type SaatTuru = 'MUDAHALE' | 'COZUM';

export interface SlaSatiri {
  id: string;
  ticketNumber: string;
  musteri: string;
  cihaz: string;
  tur: SaatTuru;
  /** Hedefe kalan ÇALIŞMA dakikası; eksiyse o kadar geçti. */
  kalanDk: number;
  /** Saat şu an duruyor mu (sözleşme parça beklemesini saymıyor, fiş parça bekliyor). */
  durdu: boolean;
}

export interface SlaKutusu {
  /** Çalışma takvimi bozuk: ölçülemiyor. Sıfır yazılmaz — sıfır "yolunda" okunur. */
  olculemiyor: boolean;
  /** Hâlâ işleyen saati hedefi AŞMIŞ fiş sayısı. */
  gecen: number;
  /** Önümüzdeki bir saat içinde aşacak fiş sayısı (geçenler hariç). */
  yaklasan: number;
  /** En acil olanlar: önce en çok geçen, sonra en az kalan. */
  liste: SlaSatiri[];
}

/**
 * SLA kutusu. SLA hedefi tanımlı sözleşme YOKSA null: kutu hiç çizilmez.
 *
 * Yalnız HÂLÂ İŞLEYEN saatlere bakılır — panonun sorusu "şimdi neye
 * koşmalıyız". Müdahalesi geç yapılmış ama çözümü vaktinde ilerleyen fiş
 * burada "geçti" sayılmaz; o ihlal SLA raporunda kalır. Bu kutu geçmişi
 * değil, kurtarılabilecek olanı gösterir.
 *
 * Müdahale saati, iş çözülmüşse (Hazır/Teslim) durmuş sayılır: "Serviste"
 * basılmadan doğrudan Hazır'a alınan fiş için müdahale elbette yapılmıştır.
 *
 * "Yaklaşan" önümüzdeki 60 DUVAR dakikasında saatin kaç ÇALIŞMA dakikası
 * ilerleyeceğiyle ölçülür: cuma 17:45'te 30 dakikası kalan fiş, mesai
 * 18:00'de bittiği için bu saat içinde aşmaz — pazartesi aşar. Saati duran
 * (parça beklenen, sözleşme durduruyor) fiş de bu saatte aşmaz.
 */
export function slaKutusu(
  fisler: readonly SlaFisGirdisi[],
  takvim: CalismaTakvimi,
  simdi: Date,
  hedefliSozlesme: number,
  enFazla = 5,
): SlaKutusu | null {
  if (!(hedefliSozlesme > 0)) return null;
  const pencere = calismaDakikasi(simdi, new Date(simdi.getTime() + SLA_YAKLASAN_DK * DK), takvim);
  if (pencere === null) return { olculemiyor: true, gecen: 0, yaklasan: 0, liste: [] };

  let gecen = 0;
  let yaklasan = 0;
  const satirlar: SlaSatiri[] = [];
  for (const f of fisler) {
    const o = slaOlcumu(f.olay, f.hedef, takvim, simdi);
    if (!o.kapsamda) continue;
    const saatler: { tur: SaatTuru; kalan: number }[] = [];
    if (f.hedef.mudahaleDk !== null && o.mudahaleDk !== null
      && f.olay.ilkMudahale === null && f.olay.cozum === null && !f.olay.iptal) {
      saatler.push({ tur: 'MUDAHALE', kalan: f.hedef.mudahaleDk - o.mudahaleDk });
    }
    if (f.hedef.cozumDk !== null && o.cozumDk !== null && o.cozumAcik) {
      saatler.push({ tur: 'COZUM', kalan: f.hedef.cozumDk - o.cozumDk });
    }
    if (!saatler.length) continue;
    const acil = saatler.reduce((a, b) => (b.kalan < a.kalan ? b : a));
    const durdu = f.hedef.parcaDurdurur && f.olay.duraklamalar.some((d) => d.son === null);
    const satir: SlaSatiri = {
      id: f.id, ticketNumber: f.ticketNumber, musteri: f.musteri, cihaz: f.cihaz,
      tur: acil.tur, kalanDk: acil.kalan, durdu,
    };
    if (acil.kalan < 0) { gecen++; satirlar.push(satir); }
    else if (!durdu && acil.kalan < pencere) { yaklasan++; satirlar.push(satir); }
  }
  satirlar.sort((a, b) => a.kalanDk - b.kalanDk || a.ticketNumber.localeCompare(b.ticketNumber));
  return { olculemiyor: false, gecen, yaklasan, liste: satirlar.slice(0, Math.max(0, enFazla)) };
}

// ─────────────────────────────────────────────────────────────────────────
// Teknisyenler
// ─────────────────────────────────────────────────────────────────────────

export interface PanoKullanicisi {
  id: string;
  ad: string;
}

export interface AcikIs {
  id: string;
  ticketNumber: string;
  musteri: string;
  cihaz: string;
  status: AcikDurum;
  atananId: string | null;
  /** Fişin ŞU ANKİ durumuna geçtiği an (aşama geçmişinden; yoksa son durum damgası). */
  durumBasi: Date;
  varisAt: Date | null;
  ayrilisAt: Date | null;
}

export interface SuankiIs {
  id: string;
  ticketNumber: string;
  musteri: string;
  cihaz: string;
  durum: AcikDurum;
  /** "Vardım" denmiş, ardından "Çıktım" denmemiş: teknisyen müşteride. */
  sahada: boolean;
  /** Sahadaysa varıştan, değilse bu duruma geçişten bu yana dakika. */
  dakika: number;
}

export interface TeknisyenSatiri {
  id: string;
  ad: string;
  suanki: SuankiIs | null;
  /** Ona atanmış, bitmemiş DİĞER işler (yeni / serviste / parça bekliyor). */
  sirada: number;
  /** Bugün teslim edilen, ona atanmış fiş. */
  bugunKapatti: number;
}

/**
 * Teknisyen müşteride mi? Varış var ve sonrasında çıkış yok. Çıkış varıştan
 * ESKİYSE ikinci ziyarettir: yine sahada. Konum tutulmuyor; yalnız saat.
 */
export function sahadaMi(is: Pick<AcikIs, 'varisAt' | 'ayrilisAt'>): boolean {
  if (!is.varisAt) return false;
  return !is.ayrilisAt || is.ayrilisAt.getTime() < is.varisAt.getTime();
}

const dakikaFarki = (simdi: Date, bas: Date) => Math.max(0, Math.floor((simdi.getTime() - bas.getTime()) / DK));

/**
 * Teknisyen satırları.
 *
 * ŞU ANKİ İŞ: önce sahada olduğu iş (en son vardığı), yoksa "Serviste" olan
 * (en son başladığı). İkisi de yoksa şu anki iş YOK — sırada iş olabilir.
 *
 * SIRA: sahadakiler → servistekiler → sırası olanlar → diğerleri; grup içinde
 * en uzun süren önce. Süre her yoklamada hepsi için aynı artar; satırlar
 * televizyonda yerinden zıplamaz, yalnız biri iş değiştirince yer değişir.
 */
export function teknisyenSatirlari(
  kisiler: readonly PanoKullanicisi[],
  isler: readonly AcikIs[],
  bugunKapatilan: ReadonlyMap<string, number>,
  simdi: Date,
): TeknisyenSatiri[] {
  const kisininIsleri = new Map<string, AcikIs[]>();
  for (const i of isler) {
    if (!i.atananId) continue;
    const l = kisininIsleri.get(i.atananId);
    if (l) l.push(i); else kisininIsleri.set(i.atananId, [i]);
  }

  const satirlar: TeknisyenSatiri[] = kisiler.map((k) => {
    const benim = kisininIsleri.get(k.id) ?? [];
    const sahada = benim.filter(sahadaMi)
      .sort((a, b) => (b.varisAt as Date).getTime() - (a.varisAt as Date).getTime());
    const serviste = benim.filter((i) => i.status === 'IN_SERVICE')
      .sort((a, b) => b.durumBasi.getTime() - a.durumBasi.getTime());
    const secilen = sahada[0] ?? serviste[0] ?? null;
    const sirada = benim.filter((i) => SURUYOR.includes(i.status) && i.id !== secilen?.id).length;
    let suanki: SuankiIs | null = null;
    if (secilen) {
      const s = sahadaMi(secilen);
      suanki = {
        id: secilen.id, ticketNumber: secilen.ticketNumber, musteri: secilen.musteri, cihaz: secilen.cihaz,
        durum: secilen.status, sahada: s,
        dakika: dakikaFarki(simdi, s ? (secilen.varisAt as Date) : secilen.durumBasi),
      };
    }
    return { id: k.id, ad: k.ad, suanki, sirada, bugunKapatti: bugunKapatilan.get(k.id) ?? 0 };
  });

  const grup = (s: TeknisyenSatiri) => (s.suanki?.sahada ? 0 : s.suanki ? 1 : s.sirada > 0 ? 2 : 3);
  const harf = new Intl.Collator('tr');
  return satirlar.sort((a, b) => grup(a) - grup(b)
    || (b.suanki?.dakika ?? 0) - (a.suanki?.dakika ?? 0)
    || b.sirada - a.sirada
    || harf.compare(a.ad, b.ad));
}

/**
 * Bugün teslim edilen fişler → teknisyen başına adet + toplam.
 *
 * Aynı fiş gün içinde iki kez teslime alınabilir (geri açılıp yeniden
 * kapatılmış): bir kez sayılır.
 */
export function kapanisSayilari(satirlar: readonly { ticketId: string; atananId: string | null }[]): {
  toplam: number; kisi: Map<string, number>;
} {
  const gorulen = new Set<string>();
  const kisi = new Map<string, number>();
  for (const s of satirlar) {
    if (gorulen.has(s.ticketId)) continue;
    gorulen.add(s.ticketId);
    if (s.atananId) kisi.set(s.atananId, (kisi.get(s.atananId) ?? 0) + 1);
  }
  return { toplam: gorulen.size, kisi };
}

// ─────────────────────────────────────────────────────────────────────────
// Olay akışı
// ─────────────────────────────────────────────────────────────────────────

export type OlayTuru = 'YENI_FIS' | 'DURUM' | 'PORTAL' | 'UYARI';

export interface PanoOlayi {
  id: string;
  tur: OlayTuru;
  /** ISO an. */
  zaman: string;
  ticketNumber: string | null;
  musteri: string | null;
  cihaz: string | null;
  /** DURUM: yeni durum kodu · PORTAL: ARIZA | SAYAC · UYARI: uyarı kodu. Metin ekranda sözlükten. */
  kod: string | null;
  /** DURUM: önceki durum kodu. */
  onceki: string | null;
}

/** Aynı ANDAKİ olayların sırası: cihazın sesi önce, iç kayıt sonra. */
const TUR_SIRASI: Record<OlayTuru, number> = { UYARI: 0, PORTAL: 1, YENI_FIS: 2, DURUM: 3 };

/**
 * Dört kaynağın (fiş, aşama geçmişi, müşteri paneli, cihaz uyarısı) son
 * olaylarını tek akışta birleştirir: en yeni önce, en fazla `enFazla`.
 * Her kaynaktan zaten son N olay çekiliyor; birleşimin ilk N'i doğrudur.
 * Eşit anlar türe, sonra kimliğe göre sıralanır — her yoklamada aynı sıra.
 */
export function olayAkisi(kaynaklar: readonly (readonly PanoOlayi[])[], enFazla = OLAY_SAYISI): PanoOlayi[] {
  const gorulen = new Set<string>();
  const hepsi: { o: PanoOlayi; t: number }[] = [];
  for (const l of kaynaklar) {
    for (const o of l) {
      const t = Date.parse(o.zaman);
      const anahtar = `${o.tur}:${o.id}`;
      if (!Number.isFinite(t) || gorulen.has(anahtar)) continue;
      gorulen.add(anahtar);
      hepsi.push({ o, t });
    }
  }
  hepsi.sort((a, b) => b.t - a.t
    || TUR_SIRASI[a.o.tur] - TUR_SIRASI[b.o.tur]
    || (a.o.id < b.o.id ? -1 : a.o.id > b.o.id ? 1 : 0));
  return hepsi.slice(0, Math.max(0, enFazla)).map((x) => x.o);
}

// ─────────────────────────────────────────────────────────────────────────
// Ekran yardımcıları (istemci de kullanır)
// ─────────────────────────────────────────────────────────────────────────

export type GoreliBirim = 'AZ' | 'DK' | 'SA' | 'GUN';

/** "az önce" / "12 dk" / "3 sa" / "2 gün" — metin ekranda sözlükten kurulur. */
export function goreliZaman(an: Date, simdi: Date): { birim: GoreliBirim; n: number } {
  const dk = Math.floor(Math.max(0, simdi.getTime() - an.getTime()) / DK);
  if (dk < 1) return { birim: 'AZ', n: 0 };
  if (dk < 60) return { birim: 'DK', n: dk };
  const sa = Math.floor(dk / 60);
  if (sa < 24) return { birim: 'SA', n: sa };
  return { birim: 'GUN', n: Math.floor(sa / 24) };
}

/** 135 → { sa: 2, dk: 15 }. */
export function sureParcala(dakika: number): { sa: number; dk: number } {
  const d = Math.max(0, Math.round(Number(dakika) || 0));
  return { sa: Math.floor(d / 60), dk: d % 60 };
}

/**
 * Son başarılı yoklamanın üzerinden çok zaman geçti mi? İki buçuk tur:
 * tek bir yavaş cevap "bağlantı yok" dedirtmesin, ama iki tur kaçınca ekran
 * eski veriyi canlıymış gibi göstermesin.
 */
export function bayatMi(sonBasariMs: number | null, simdiMs: number): boolean {
  if (sonBasariMs === null) return false;
  return simdiMs - sonBasariMs > YOKLAMA_SN * 2500;
}
