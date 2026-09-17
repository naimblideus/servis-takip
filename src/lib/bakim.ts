/**
 * PERİYODİK BAKIM PLANI — "hangi makineye ne zaman gitmeliyim".
 *
 * ── NİYE VAR ─────────────────────────────────────────────────────────────
 * Fotokopi bakımı takvimle değil SAYAÇLA gelir: üretici bakım kitini sayfa
 * sayısına bağlar (Kyocera MK 300.000, HP bakım kiti 225.000 gibi). Bayi bu
 * eşiği takip etmiyorsa bakım ya çok erken yapılır (boşa parça) ya da
 * kaçırılır — ve kaçırılan bakım, sözleşmedeki müdahale süresini tutturmayı
 * imkânsız kılan arızaya dönüşür. SLA'yı yeşil tutan şey aslında budur.
 *
 * ── UYDURMUYORUZ ─────────────────────────────────────────────────────────
 * Tahmin, toner tükenme tahminiyle AYNI hesaptan çıkar: son okumalardan
 * günlük sayfa hızı (lib/toner.ts → dailyRate). İki ayrı hız hesabı yazmak,
 * iki ekranın aynı cihaz için farklı tarih söylemesi demekti.
 *
 * Bilinmeyeni bilinir gibi göstermiyoruz:
 *   · politika yoksa "zamanı gelmedi" DEMİYORUZ, "bilinmiyor" diyoruz;
 *   · ilk bakım referansı (tarih + sayaç) yoksa sayfa hesabı yapılamaz;
 *   · hız hesaplanamıyorsa kalan SAYFA söylenir, TARİH söylenmez.
 *
 * Bu dosya SAFtır: React yok, Prisma yok.
 */

/** Cihazın bakım politikası — ikisi de boş olabilir. */
export interface BakimPolitikasi {
  /** Her N sayfada bir bakım. */
  sayfaAraligi: number | null;
  /** Her N ayda bir bakım. */
  ayAraligi: number | null;
}

export interface BakimGirdi {
  /** Son bakımın yapıldığı an. */
  sonBakimTarihi: Date | null;
  /** Son bakım anındaki TOPLAM sayaç (siyah + renkli). */
  sonBakimSayaci: number | null;
  /** Güncel toplam sayaç. */
  guncelSayac: number | null;
  /** Günlük sayfa hızı — lib/toner.ts dailyRate ile hesaplanır. */
  gunlukHiz: number | null;
  bugun: Date;
}

export type BakimDurumu = 'GECIKTI' | 'YAKLASTI' | 'PLANLI' | 'BILINMIYOR';

/** Durumun SEBEBİ — ekran cümleyi okuyanın dilinde kurar. */
export type BakimSebep =
  | 'SAYFA'          // sayfa eşiği
  | 'AY'             // süre eşiği
  | 'POLITIKA_YOK'   // ne sayfa ne ay aralığı tanımlı
  | 'BASLANGIC_YOK'  // politika var ama son bakım referansı yok
  | 'SAYAC_YOK';     // güncel sayaç okunmamış

export interface BakimSonucu {
  durum: BakimDurumu;
  sebep: BakimSebep;
  /** Sayfa eşiğine kalan. Eksi = aşıldı. Hesaplanamıyorsa null. */
  sayfaKalan: number | null;
  /** Sayfa eşiğine kalan gün — hız bilinmiyorsa null. */
  gunKalan: number | null;
  /** Son bakımdan bu yana geçen tam ay. */
  gecenAy: number | null;
  /** Süre eşiğine kalan ay. Eksi = aşıldı. */
  ayKalan: number | null;
  /** Tahmini bakım tarihi (ISO). Yalnız sayfa hesabı ve hız varsa. */
  tahminiTarih: string | null;
}

/** "Yaklaştı" eşiği: bu kadar gün kaldıysa rotaya alınmalı. */
export const YAKLASTI_GUN = 14;
/** Hız bilinmiyorsa: aralığın bu kadarlık kısmı kaldıysa "yaklaştı". */
export const YAKLASTI_ORAN = 0.1;

const AY_MS = 30.436875 * 86_400_000; // ortalama ay — takvim ayı değil, yaklaşık

const BOS: BakimSonucu = {
  durum: 'BILINMIYOR', sebep: 'POLITIKA_YOK',
  sayfaKalan: null, gunKalan: null, gecenAy: null, ayKalan: null, tahminiTarih: null,
};

/** Politikanın kendisi kullanılabilir mi (en az bir eşik var mı)? */
export function politikaVar(p: BakimPolitikasi): boolean {
  return (!!p.sayfaAraligi && p.sayfaAraligi > 0) || (!!p.ayAraligi && p.ayAraligi > 0);
}

/**
 * Cihazın bakım durumu.
 *
 * İki eşik birlikte tanımlıysa HANGİSİ ÖNCE DOLUYORSA o geçerlidir: üretici
 * "300.000 sayfa veya 12 ay, hangisi önce" der ve az basan bir makinenin
 * bakımı yine de zamanla gelir.
 */
export function bakimDurumu(p: BakimPolitikasi, g: BakimGirdi): BakimSonucu {
  if (!politikaVar(p)) return { ...BOS };

  // ── SÜRE EŞİĞİ ────────────────────────────────────────────────────────
  let gecenAy: number | null = null;
  let ayKalan: number | null = null;
  if (p.ayAraligi && p.ayAraligi > 0) {
    if (g.sonBakimTarihi) {
      gecenAy = Math.floor((g.bugun.getTime() - g.sonBakimTarihi.getTime()) / AY_MS);
      ayKalan = p.ayAraligi - gecenAy;
    }
  }

  // ── SAYFA EŞİĞİ ───────────────────────────────────────────────────────
  let sayfaKalan: number | null = null;
  let gunKalan: number | null = null;
  let tahminiTarih: string | null = null;
  if (p.sayfaAraligi && p.sayfaAraligi > 0) {
    if (g.guncelSayac !== null && g.sonBakimSayaci !== null) {
      const basilan = g.guncelSayac - g.sonBakimSayaci;
      sayfaKalan = p.sayfaAraligi - basilan;
      if (g.gunlukHiz && g.gunlukHiz > 0) {
        gunKalan = Math.floor(sayfaKalan / g.gunlukHiz);
        tahminiTarih = new Date(g.bugun.getTime() + gunKalan * 86_400_000).toISOString();
      }
    }
  }

  // ── EKSİK REFERANS ────────────────────────────────────────────────────
  // Sayfa politikası var ama başlangıç yoksa: bu cihaz için sayfa hesabı
  // YAPILAMAZ. Süre politikası da yoksa hiçbir şey söyleyemeyiz.
  const sayfaHesaplandi = sayfaKalan !== null;
  const sureHesaplandi = ayKalan !== null;
  if (!sayfaHesaplandi && !sureHesaplandi) {
    const sebep: BakimSebep = p.sayfaAraligi
      ? (g.guncelSayac === null ? 'SAYAC_YOK' : 'BASLANGIC_YOK')
      : 'BASLANGIC_YOK';
    return { ...BOS, sebep, gecenAy, ayKalan };
  }

  // ── HANGİSİ ÖNCE DOLUYOR ──────────────────────────────────────────────
  const sayfaGecti = sayfaHesaplandi && sayfaKalan! <= 0;
  const sureGecti = sureHesaplandi && ayKalan! <= 0;
  if (sayfaGecti || sureGecti) {
    return {
      durum: 'GECIKTI',
      // İkisi de geçtiyse SAYFA yazılır: bakımı asıl tetikleyen aşınmadır.
      sebep: sayfaGecti ? 'SAYFA' : 'AY',
      sayfaKalan, gunKalan, gecenAy, ayKalan, tahminiTarih,
    };
  }

  const sayfaYakin = sayfaHesaplandi && (
    (gunKalan !== null && gunKalan <= YAKLASTI_GUN) ||
    (gunKalan === null && sayfaKalan! <= (p.sayfaAraligi ?? 0) * YAKLASTI_ORAN)
  );
  const sureYakin = sureHesaplandi && ayKalan! <= 1;
  if (sayfaYakin || sureYakin) {
    return {
      durum: 'YAKLASTI',
      sebep: sayfaYakin ? 'SAYFA' : 'AY',
      sayfaKalan, gunKalan, gecenAy, ayKalan, tahminiTarih,
    };
  }

  return {
    durum: 'PLANLI',
    sebep: sayfaHesaplandi ? 'SAYFA' : 'AY',
    sayfaKalan, gunKalan, gecenAy, ayKalan, tahminiTarih,
  };
}

/**
 * Sıralama anahtarı: önce gecikenler, sonra en yakın olanlar.
 * Bilinmeyen en sonda — ama listeden DÜŞMEZ, çünkü "bilinmiyor" da bayinin
 * yapması gereken bir iştir (politika ya da başlangıç girilmemiş).
 */
export function bakimSira(s: BakimSonucu): number {
  if (s.durum === 'GECIKTI') return -1_000_000 + (s.gunKalan ?? s.sayfaKalan ?? 0);
  if (s.durum === 'BILINMIYOR') return 1_000_000;
  return s.gunKalan ?? (s.ayKalan !== null ? s.ayKalan * 30 : 900_000);
}

export interface BakimOzeti {
  geciken: number;
  yaklasan: number;
  planli: number;
  bilinmeyen: number;
  /** Politikası hiç tanımlanmamış cihaz — ekranda "önce şunu yap" der. */
  politikasiz: number;
}

export function bakimOzeti(liste: BakimSonucu[]): BakimOzeti {
  return {
    geciken: liste.filter((s) => s.durum === 'GECIKTI').length,
    yaklasan: liste.filter((s) => s.durum === 'YAKLASTI').length,
    planli: liste.filter((s) => s.durum === 'PLANLI').length,
    bilinmeyen: liste.filter((s) => s.durum === 'BILINMIYOR').length,
    politikasiz: liste.filter((s) => s.sebep === 'POLITIKA_YOK').length,
  };
}
