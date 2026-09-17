/**
 * TOPLU CİHAZ AYARI — SAF HESAP.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Periyodik bakım ve filo optimizasyonu ekranlarının ikisi de cihazda
 * yazılı iki değere dayanıyor: sözleşmedeki DAHİL sayfa ve bakım EŞİĞİ.
 * Bin makinelik bir parkta bu değerleri cihaz cihaz girmek kimsenin
 * yapmayacağı iştir — girilmeyince de iki ekran boş kalır ve bayi
 * "sistem bir şey söylemiyor" der.
 *
 * Toplu Zam ekranı fiyatı YÜZDEYLE ARTIRIR; buradaki iş başka: bir değeri
 * OLDUĞU GİBİ YAZMAK. İkisini tek ekrana koymak "zam mı yapıyorum, değer
 * mi yazıyorum" karışıklığı üretirdi.
 *
 * ── VARSAYILAN: DOLU ALANI EZME ──────────────────────────────────────────
 * Toplu yazma, sistemdeki en tehlikeli işlemlerden biri: bir tıkla yüzlerce
 * cihazın pazarlıkla girilmiş değeri silinebilir. Bu yüzden varsayılan
 * "yalnız boş olanları doldur". Ezmek bilinçli bir seçim olmalı ve ekran
 * kaç cihazın ezileceğini önce söylemeli.
 *
 * ── DAHİL SAYFA YALNIZ KİRALIKTA ANLAMLI ─────────────────────────────────
 * Satılmış makinede "kiraya dahil sayfa" diye bir şey yoktur; o alan o
 * cihazlarda yazılmaz. Bakım eşiği ise satılmış cihazda da anlamlıdır —
 * bakım sözleşmesi ayrı satılabilir.
 */

export type AyarAlani = 'includedBlack' | 'includedColor' | 'pmIntervalPages' | 'pmIntervalMonths';

export const AYAR_ALANLARI: AyarAlani[] = [
  'includedBlack', 'includedColor', 'pmIntervalPages', 'pmIntervalMonths',
];

/** Yalnız kiralık cihazda anlamı olan alanlar. */
export const KIRA_ALANLARI: AyarAlani[] = ['includedBlack', 'includedColor'];

export type AtlamaSebep = 'DOLU' | 'AYNI' | 'KIRALIK_DEGIL';

export interface AyarCihazi {
  id: string;
  etiket: string;
  musteri: string;
  kiralik: boolean;
  includedBlack: number | null;
  includedColor: number | null;
  pmIntervalPages: number | null;
  pmIntervalMonths: number | null;
}

export interface AyarIstegi {
  /** Yazılacak değerler. Alan yoksa o alana DOKUNULMAZ. */
  degerler: Partial<Record<AyarAlani, number>>;
  /** true (varsayılan): dolu alan ezilmez. */
  yalnizBos: boolean;
  /** true: satılmış cihazlar hiç işleme girmez. */
  yalnizKiralik: boolean;
}

export interface AyarSatiri {
  id: string;
  etiket: string;
  musteri: string;
  degisim: Partial<Record<AyarAlani, { eski: number | null; yeni: number }>>;
}

export interface AyarPlani {
  satirlar: AyarSatiri[];
  taranan: number;
  /** Değişmeyecek cihaz sayıları, sebebiyle — ekran bunu yazar. */
  atlanan: Record<AtlamaSebep, number>;
  /** Dolu alanı EZİLECEK cihaz sayısı (yalnizBos kapalıyken). */
  ezilecek: number;
}

/** Alan cihazda dolu mu? 0 ve null "tanımlanmamış" sayılır. */
function dolu(c: AyarCihazi, alan: AyarAlani): boolean {
  const v = c[alan];
  return v !== null && v !== undefined && v > 0;
}

/**
 * Hangi cihazda ne değişecek.
 *
 * Değişmeyecek cihazlar plana GİRMEZ ama sayıları sebebiyle birlikte
 * döner: "127 cihaz atlandı" demek yetmez, neden atlandığı söylenmeli.
 */
export function ayarPlani(cihazlar: AyarCihazi[], istek: AyarIstegi): AyarPlani {
  const alanlar = AYAR_ALANLARI.filter((a) => {
    const v = istek.degerler[a];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0;
  });

  const satirlar: AyarSatiri[] = [];
  const atlanan: Record<AtlamaSebep, number> = { DOLU: 0, AYNI: 0, KIRALIK_DEGIL: 0 };
  let ezilecek = 0;

  for (const c of cihazlar) {
    if (istek.yalnizKiralik && !c.kiralik) { atlanan.KIRALIK_DEGIL++; continue; }

    const degisim: AyarSatiri['degisim'] = {};
    let doluAtlandi = false, ezildi = false;

    for (const alan of alanlar) {
      // Dahil sayfa satılmış cihazda yazılmaz.
      if (!c.kiralik && KIRA_ALANLARI.includes(alan)) continue;

      const yeni = istek.degerler[alan] as number;
      const eski = c[alan];
      if (eski === yeni) continue;
      if (dolu(c, alan)) {
        if (istek.yalnizBos) { doluAtlandi = true; continue; }
        ezildi = true;
      }
      degisim[alan] = { eski: eski ?? null, yeni };
    }

    if (!Object.keys(degisim).length) {
      // Hiç değişiklik yok: ya hepsi doluydu ya zaten aynıydı.
      if (doluAtlandi) atlanan.DOLU++;
      else atlanan.AYNI++;
      continue;
    }
    if (ezildi) ezilecek++;
    satirlar.push({ id: c.id, etiket: c.etiket, musteri: c.musteri, degisim });
  }

  return { satirlar, taranan: cihazlar.length, atlanan, ezilecek };
}
