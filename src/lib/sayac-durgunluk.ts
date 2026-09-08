/**
 * SAYAÇ DURGUNLUĞU — "sayaç geliyor ama ARTMIYOR"
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Sistem bugün sayacın GELMEDİĞİNİ söylüyor (`/api/sayac/eksik`). Ama
 * kiralamacının asıl kaybı orada değil: sayaç DÜZENLİ GELİYOR, rakam
 * ARTMIYOR. Bunun üç anlamı var ve üçü de para:
 *
 *   1. Müşteri o makineyi kullanmıyor. Kira kesiliyor, karşılığı yok.
 *      Yenileme görüşmesinde müşteri bunu fark eder ve sözleşme iptal olur.
 *      Önce siz fark ederseniz makineyi taşır ya da paketi küçültürsünüz —
 *      müşteriyi kaybetmek yerine küçülterek tutarsınız.
 *   2. Makine bozuk ya da fişten çekilmiş. Müşteri sizi aramamış bile;
 *      sessizce başka makineye geçmiş. Bu bir servis çağrısı fırsatı ve
 *      aynı zamanda sessiz bir hizmet ihlali.
 *   3. Makine başka ofise taşınmış, kimse söylememiş. Sayaç eski yerde
 *      duruyor gibi görünür, gerçekte fatura yanlış müşteriye gidiyordur.
 *
 * ── ÖLÇÜT NEDEN DAR ──────────────────────────────────────────────────────
 * Yanlış alarm bu ekranı öldürür: bayi iki kez boşuna telefon açarsa bir
 * daha bakmaz. Bu yüzden:
 *   • En az 2 okuma ve aralarında en az `ASGARI_GUN` gün olmalı. Yeni
 *     kurulan cihaz ya da tek okuması olan cihaz ASLA işaretlenmez.
 *   • "Durgun" için toplam fark TAM SIFIR olmalı. "Az basmış" durgun
 *     değildir; az basan müşteri hâlâ kullanıyordur.
 *   • "Düşüş" için cihazın KENDİ geçmişi ölçüt — marka/model ortalaması
 *     değil. Bir avukatlık bürosunun ayda 800 sayfası normaldir, matbaanın
 *     800'ü çöküştür.
 *
 * Saf fonksiyonlar: veritabanı yok, sunucuda da istemcide de çalışır,
 * testte gerçek veri olmadan sürülebilir.
 */

export interface OkumaNoktasi {
  readingDate: Date | string;
  counterBlack: number;
  counterColor: number;
}

export type DurgunlukDurumu =
  | 'YETERSIZ_VERI'   // karar verilemez — işaretlenmez
  | 'NORMAL'          // kullanım sürüyor
  | 'DUSUS'           // kendi geçmişine göre belirgin düşüş
  | 'DURGUN';         // hiç basmamış

export interface DurgunlukSonucu {
  durum: DurgunlukDurumu;
  /** Ölçümün kapsadığı gün sayısı (ilk okumadan sonuncuya). */
  gun: number;
  /** Bu aralıkta basılan toplam sayfa (siyah + renkli). */
  toplamSayfa: number;
  /** Günlük ortalama sayfa — kıyaslama için. */
  gunlukOrtalama: number;
  /** Cihazın kendi geçmişindeki günlük ortalaması (kıyas tabanı). */
  gecmisGunlukOrtalama: number | null;
  /** Bayiye gösterilecek tek cümle. */
  aciklama: string;
}

/** Bu süreden kısa aralıkta karar verilmez — ay ortasında yanlış alarm olur. */
export const ASGARI_GUN = 45;
/** Kendi geçmişinin bu oranının altına düştüyse "düşüş" sayılır. */
export const DUSUS_ORANI = 0.25;
/** Düşüş kararı için gereken en az geçmiş okuma sayısı. */
export const DUSUS_ICIN_GECMIS = 3;

const gun = (a: Date | string, b: Date | string) =>
  (new Date(b).getTime() - new Date(a).getTime()) / 86400000;

const sayfa = (o: OkumaNoktasi) => (o.counterBlack || 0) + (o.counterColor || 0);

/**
 * Bir cihazın son dönemdeki sayaç hareketini sınıflandırır.
 *
 * @param okumalar Cihazın okumaları (sıra önemsiz, içeride sıralanır).
 *                 En az 2 okuma ve `ASGARI_GUN` gün aralık gerekir.
 */
export function durgunlukDegerlendir(okumalar: OkumaNoktasi[]): DurgunlukSonucu {
  const bos: DurgunlukSonucu = {
    durum: 'YETERSIZ_VERI', gun: 0, toplamSayfa: 0,
    gunlukOrtalama: 0, gecmisGunlukOrtalama: null,
    aciklama: 'Karar için yeterli okuma yok.',
  };
  if (!Array.isArray(okumalar) || okumalar.length < 2) return bos;

  const sirali = [...okumalar].sort(
    (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime(),
  );
  const ilk = sirali[0];
  const son = sirali[sirali.length - 1];
  const araGun = gun(ilk.readingDate, son.readingDate);
  if (araGun < ASGARI_GUN) {
    return { ...bos, gun: Math.round(araGun), aciklama: `Henüz ${Math.round(araGun)} günlük veri var; karar için en az ${ASGARI_GUN} gün gerekiyor.` };
  }

  const toplamSayfa = Math.max(0, sayfa(son) - sayfa(ilk));
  const gunlukOrtalama = toplamSayfa / araGun;

  // ── DURGUN: hiç basmamış ────────────────────────────────────────────
  // Tam sıfır arıyoruz. "Az" durgun değildir — az basan müşteri kullanıyordur.
  if (toplamSayfa === 0) {
    return {
      durum: 'DURGUN', gun: Math.round(araGun), toplamSayfa: 0,
      gunlukOrtalama: 0, gecmisGunlukOrtalama: null,
      aciklama: `${Math.round(araGun)} gündür sayaç geliyor ama HİÇ artmamış — makine kullanılmıyor, bozuk ya da taşınmış olabilir.`,
    };
  }

  // ── DÜŞÜŞ: cihazın KENDİ geçmişine göre ─────────────────────────────
  // Son aralığı, ondan öncekilerin ortalamasıyla kıyaslıyoruz.
  const sonAralikBasi = sirali[sirali.length - 2];
  const sonAralikGun = gun(sonAralikBasi.readingDate, son.readingDate);
  const gecmis = sirali.slice(0, sirali.length - 1);

  let gecmisGunlukOrtalama: number | null = null;
  if (gecmis.length >= DUSUS_ICIN_GECMIS) {
    const gGun = gun(gecmis[0].readingDate, gecmis[gecmis.length - 1].readingDate);
    const gSayfa = Math.max(0, sayfa(gecmis[gecmis.length - 1]) - sayfa(gecmis[0]));
    if (gGun >= 1) gecmisGunlukOrtalama = gSayfa / gGun;
  }

  if (gecmisGunlukOrtalama !== null && gecmisGunlukOrtalama > 0 && sonAralikGun >= 1) {
    const sonSayfa = Math.max(0, sayfa(son) - sayfa(sonAralikBasi));
    const sonHiz = sonSayfa / sonAralikGun;
    if (sonHiz < gecmisGunlukOrtalama * DUSUS_ORANI) {
      const yuzde = Math.round((1 - sonHiz / gecmisGunlukOrtalama) * 100);
      return {
        durum: 'DUSUS', gun: Math.round(araGun), toplamSayfa,
        gunlukOrtalama: Number(gunlukOrtalama.toFixed(1)),
        gecmisGunlukOrtalama: Number(gecmisGunlukOrtalama.toFixed(1)),
        aciklama: `Kullanım kendi ortalamasının %${yuzde} altına düşmüş — müşteri başka makineye geçmiş olabilir.`,
      };
    }
  }

  return {
    durum: 'NORMAL', gun: Math.round(araGun), toplamSayfa,
    gunlukOrtalama: Number(gunlukOrtalama.toFixed(1)),
    gecmisGunlukOrtalama: gecmisGunlukOrtalama === null ? null : Number(gecmisGunlukOrtalama.toFixed(1)),
    aciklama: `Günde ortalama ${Math.round(gunlukOrtalama)} sayfa — kullanım sürüyor.`,
  };
}

/** Bayiye gösterilecek mi? YETERSIZ_VERI ve NORMAL gösterilmez. */
export function dikkatGerektirir(s: DurgunlukSonucu): boolean {
  return s.durum === 'DURGUN' || s.durum === 'DUSUS';
}
