/**
 * MEMNUNİYET — TAVSİYE PUANI (SAF HESAP).
 *
 * ── NİYE VAR ─────────────────────────────────────────────────────────────
 * Kiralama sözleşmesi yenilenirken müşteri "servisiniz yavaş" der; bayinin
 * elinde buna karşı tek bir sayı yoktur. Rakip (Printlio) müşteriye tek soru
 * soruyor: "bizi bir tanıdığınıza tavsiye eder misiniz?" Bu dosya o sorunun
 * cevaplarını tek bir sayıya çevirir — ve o sayının NE ZAMAN söylenemeyeceğini
 * de bilir.
 *
 * ── HESAP ────────────────────────────────────────────────────────────────
 * 0–10 puan. 9–10 tavsiye eden, 7–8 kararsız, 0–6 memnun olmayan.
 * Tavsiye puanı = %tavsiye eden − %memnun olmayan → −100 … +100.
 * Dünyada "NPS" adıyla bilinen ölçü budur; ekranda kısaltma geçmez: bayi
 * ne olduğunu bilmediği bir sayıya güvenmez.
 *
 * ── AZ CEVAPTA SAYI YOK ──────────────────────────────────────────────────
 * Üç cevaptan biri 6 verince puan +67'den +33'e iner. O sayı bir teknisyen
 * hakkında konuşuyorsa veri değil iftiradır. EN_AZ_CEVAP'ın altında puan
 * YAYIMLANMAZ, ekran "henüz az cevap (n=3)" der. Teknisyen karnesindeki
 * EN_AZ_FIS ile aynı ilke (lib/teknisyen.ts).
 *
 * ── FİŞ BAŞINA TEK ANKET ─────────────────────────────────────────────────
 * Aynı servis için ikinci kez sormak müşteriyi yorar; ikinci cevap ilkini
 * EZMEZ (bkz. memnuniyet-veri.ts). Burada yalnız hesap var.
 *
 * Bu dosya SAFtır: React yok, Prisma yok. Testi veritabanı istemez.
 */

export const PUAN_EN_AZ = 0;
export const PUAN_EN_COK = 10;
/** Yorumun azami uzunluğu — anket sayfasındaki kutu da bununla sınırlı. */
export const YORUM_AZAMI = 1000;
/** Bunun altında puan yayımlanmaz. */
export const EN_AZ_CEVAP = 5;
/** Panonun karşılaştırdığı dönem (gün): son 90 gün ↔ önceki 90 gün. */
export const DONEM_GUN = 90;

const GUN_MS = 86_400_000;

/** Anketin müşteriye ulaştığı yol. Kart açılınca/gönderilince yazılır. */
export const ANKET_KANALLARI = ['YERINDE', 'WHATSAPP', 'EPOSTA', 'PORTAL'] as const;
export type AnketKanali = (typeof ANKET_KANALLARI)[number];

export function kanalMi(x: unknown): x is AnketKanali {
  return typeof x === 'string' && (ANKET_KANALLARI as readonly string[]).includes(x);
}

/**
 * Anket hangi durumdaki fişte açık? İş bitmiş olmalı. READY de kabul:
 * teslimden sonra fiş yanlışlıkla bir adım geri alınırsa müşterinin elindeki
 * bağlantı "kapalı" demesin. Kart yalnız DELIVERED'da görünür.
 */
export const ANKETLENEBILIR_DURUMLAR = ['DELIVERED', 'READY'] as const;

export function anketlenebilir(durum: string | null | undefined): boolean {
  return (ANKETLENEBILIR_DURUMLAR as readonly string[]).includes(String(durum));
}

/**
 * Puanı okur: 0–10 TAM sayı, yoksa null. Formdan metin ("7") de gelebilir;
 * "7.5", "11", "-1", "", "abc" reddedilir — yuvarlayıp kabul etmek müşterinin
 * vermediği bir puanı yazmak olurdu.
 */
export function puanOku(x: unknown): number | null {
  let n: number;
  if (typeof x === 'number') n = x;
  else if (typeof x === 'string' && /^\s*\d{1,2}\s*$/.test(x)) n = Number(x);
  else return null;
  return Number.isInteger(n) && n >= PUAN_EN_AZ && n <= PUAN_EN_COK ? n : null;
}

/**
 * Yorumu temizler. Boş → null. Uzunsa REDDEDİLİR, kırpılmaz: müşterinin
 * cümlesini ortasından kesip kaydetmek, söylemediği bir şeyi söyletmektir.
 * (Sayfadaki kutu zaten YORUM_AZAMI ile sınırlı; buraya ancak elle gelen
 * istek ulaşır.) Satır sonu ve sekme dışındaki kontrol karakterleri atılır.
 */
export function yorumOku(x: unknown): { ok: true; yorum: string | null } | { ok: false } {
  if (x === undefined || x === null) return { ok: true, yorum: null };
  if (typeof x !== 'string') return { ok: false };
  const temiz = x
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!temiz) return { ok: true, yorum: null };
  if (temiz.length > YORUM_AZAMI) return { ok: false };
  return { ok: true, yorum: temiz };
}

export type PuanSinifi = 'TAVSIYE' | 'KARARSIZ' | 'MEMNUN_DEGIL';

export function puanSinifi(puan: number): PuanSinifi {
  if (puan >= 9) return 'TAVSIYE';
  if (puan >= 7) return 'KARARSIZ';
  return 'MEMNUN_DEGIL';
}

/**
 * Ekranda işaretli puan: +46, −12, 0. Artı işareti bilerek yazılıyor:
 * "46" ile "−46" arasındaki farkı göz işaretten okur. Eksi tipografik (U+2212).
 */
export function isaretliPuan(p: number): string {
  if (p > 0) return `+${p}`;
  if (p < 0) return `−${Math.abs(p)}`;
  return '0';
}

/** 0–6 veren ve henüz aranmamış müşteri: panodaki "Aranması gerekenler". */
export function aranacakMi(a: { puan: number | null; arandiAt: Date | string | null }): boolean {
  return a.puan !== null && a.puan <= 6 && !a.arandiAt;
}

export interface TavsiyeOzeti {
  /** Geçerli cevap sayısı. */
  cevap: number;
  tavsiyeEden: number;
  kararsiz: number;
  memnunDegil: number;
  /** −100 … +100 tam sayı. Az cevapta (cevap < EN_AZ_CEVAP) null. */
  puan: number | null;
  /** 0–10 ortalama (bir ondalık). Cevap yoksa null. Ekran az cevapta göstermez. */
  ortalama: number | null;
  /** "10 müşteriden kaçı tavsiye ediyor" (0–10). Az cevapta null. */
  onda: number | null;
  /** Cevap var ama puan yayımlanacak kadar değil. */
  azCevap: boolean;
}

/**
 * Cevaplardan tavsiye puanı. Geçersiz/boş puanlar (null, 11, 7.5) sayılmaz.
 * Yuvarlama `Math.round`; −0 yazılmasın diye `|| 0`.
 */
export function tavsiyeOzeti(puanlar: ReadonlyArray<number | null | undefined>): TavsiyeOzeti {
  const gecerli = puanlar.filter((p): p is number => typeof p === 'number' && puanOku(p) !== null);
  const cevap = gecerli.length;
  let tavsiyeEden = 0, kararsiz = 0, memnunDegil = 0, toplam = 0;
  for (const p of gecerli) {
    toplam += p;
    const s = puanSinifi(p);
    if (s === 'TAVSIYE') tavsiyeEden++;
    else if (s === 'KARARSIZ') kararsiz++;
    else memnunDegil++;
  }
  const yeterli = cevap >= EN_AZ_CEVAP;
  return {
    cevap, tavsiyeEden, kararsiz, memnunDegil,
    puan: yeterli ? (Math.round((100 * (tavsiyeEden - memnunDegil)) / cevap) || 0) : null,
    ortalama: cevap ? Math.round((toplam / cevap) * 10) / 10 : null,
    onda: yeterli ? Math.round((10 * tavsiyeEden) / cevap) : null,
    azCevap: cevap > 0 && !yeterli,
  };
}

/** Panoda ve karnede işlenen en küçük anket şekli. */
export interface AnketSatiri {
  puan: number | null;
  gonderildiAt: Date;
  cevaplandiAt: Date | null;
  teknisyenId?: string | null;
}

export interface DonemKarsilastirma {
  son: TavsiyeOzeti;
  onceki: TavsiyeOzeti;
  /** son.puan − onceki.puan. İkisinden biri yayımlanamıyorsa null — eğilim uydurulmaz. */
  fark: number | null;
}

/**
 * Son `gun` gün ile ondan önceki `gun` gün. Cevaplar CEVAP tarihine göre
 * dönemlenir: puan "müşteri ne zaman böyle düşündü"yü anlatır.
 */
export function donemKarsilastir(anketler: ReadonlyArray<AnketSatiri>, simdi: Date, gun = DONEM_GUN): DonemKarsilastirma {
  const s = simdi.getTime();
  const sinir = s - gun * GUN_MS;
  const eskiSinir = s - 2 * gun * GUN_MS;
  const son: number[] = [], onceki: number[] = [];
  for (const a of anketler) {
    if (a.puan === null || !a.cevaplandiAt) continue;
    const t = a.cevaplandiAt.getTime();
    if (t > s) continue;
    if (t > sinir) son.push(a.puan);
    else if (t > eskiSinir) onceki.push(a.puan);
  }
  const so = tavsiyeOzeti(son), on = tavsiyeOzeti(onceki);
  return { son: so, onceki: on, fark: so.puan !== null && on.puan !== null ? so.puan - on.puan : null };
}

export interface CevapOrani {
  gonderilen: number;
  cevaplanan: number;
  /** 0–100 tam sayı; gönderilen yoksa null (0 demek yanlış olurdu). */
  yuzde: number | null;
}

/**
 * Son `gun` günde SORULAN anketlerin kaçı cevaplandı. Kohort usulü: oranın
 * paydası da payı da aynı anketler. Cevap tarihine göre saymak, dönem başında
 * sorulup dönem içinde cevaplananları paydaya almadan paya katar.
 */
export function cevapOrani(anketler: ReadonlyArray<AnketSatiri>, simdi: Date, gun = DONEM_GUN): CevapOrani {
  const s = simdi.getTime();
  const sinir = s - gun * GUN_MS;
  let gonderilen = 0, cevaplanan = 0;
  for (const a of anketler) {
    const t = a.gonderildiAt.getTime();
    if (t <= sinir || t > s) continue;
    gonderilen++;
    if (a.puan !== null) cevaplanan++;
  }
  return { gonderilen, cevaplanan, yuzde: gonderilen ? Math.round((100 * cevaplanan) / gonderilen) : null };
}

export interface TeknisyenTavsiyesi {
  teknisyenId: string | null;
  ozet: TavsiyeOzeti;
}

/**
 * Son `gun` günün cevapları teknisyene göre. Sıra "önce sorun": puanı en düşük
 * üstte, puanı yayımlanamayanlar (az cevap) altta, atanmamış fişler en sonda —
 * atanmamış satır bir kişi değil, işin kendisi hakkında konuşur.
 */
export function teknisyeneGore(anketler: ReadonlyArray<AnketSatiri>, simdi: Date, gun = DONEM_GUN): TeknisyenTavsiyesi[] {
  const s = simdi.getTime();
  const sinir = s - gun * GUN_MS;
  const gruplar = new Map<string, number[]>();
  for (const a of anketler) {
    if (a.puan === null || !a.cevaplandiAt) continue;
    const t = a.cevaplandiAt.getTime();
    if (t <= sinir || t > s) continue;
    const k = a.teknisyenId ?? '';
    if (!gruplar.has(k)) gruplar.set(k, []);
    gruplar.get(k)!.push(a.puan);
  }
  return [...gruplar.entries()]
    .map(([k, p]) => ({ teknisyenId: k || null, ozet: tavsiyeOzeti(p) }))
    .sort((a, b) => {
      if ((a.teknisyenId === null) !== (b.teknisyenId === null)) return a.teknisyenId === null ? 1 : -1;
      if ((a.ozet.puan === null) !== (b.ozet.puan === null)) return a.ozet.puan === null ? 1 : -1;
      if (a.ozet.puan !== null && b.ozet.puan !== null && a.ozet.puan !== b.ozet.puan) return a.ozet.puan - b.ozet.puan;
      return b.ozet.cevap - a.ozet.cevap;
    });
}
