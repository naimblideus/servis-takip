/**
 * TEKNİSYEN KARNESİ — SAF HESAP.
 *
 * ── NEDEN BU EKRAN ───────────────────────────────────────────────────────
 * SLA sözleşmenin tutulup tutulmadığını ölçer, periyodik bakım işin ne zaman
 * geleceğini söyler. İkisinin arasında kalan soru şudur: İŞ BİR SEFERDE
 * BİTİYOR MU. Saha servisinin tek gerçek verimlilik ölçüsü budur.
 *
 * Aynı makineye ay içinde ikinci kez gitmek bayiye iki kez yol, iki kez
 * saat, bir kez de itibar kaybettirir — ve bu kayıp hiçbir raporda
 * görünmez, çünkü iki fiş de "kapandı" yazar.
 *
 * ── TEKRAR ÇAĞRI NEDİR, NE DEĞİLDİR ──────────────────────────────────────
 * Tekrar çağrı = AYNI cihazda, AYNI arıza kategorisinde, çözümden sonraki
 * TEKRAR_GUN gün içinde açılan yeni arıza fişi.
 *
 * "Aynı kategori" şartı bilerek konuldu. Fırın değişiminden üç hafta sonra
 * gelen kağıt sıkışması, o tamirin eksik yapıldığını göstermez; teknisyeni
 * bununla suçlamak karneyi gürültüye çevirir. Veriden çıkarılabilecek
 * "iş bitmemiş" tanımına en yakın şey aynı cihaz + aynı kategori + kısa
 * süredir.
 *
 * Planlı ziyaret (periyodik bakım, kurulum) ve sarf değişimi tekrar
 * SAYILMAZ: onlar zaten gelinecek olan ziyaretlerdir.
 *
 * ── HÜKÜM VERMEDİĞİMİZ YERLER ────────────────────────────────────────────
 * Karne bir insanı ölçüyor; yanlış sayı üretmenin bedeli burada başka
 * ekranlardan ağırdır. Dört yerde bilerek hüküm vermiyoruz:
 *
 *  1. BEKLEME SÜRESİ DOLMADI. Dün kapanan fiş "ilk seferde çözüldü"
 *     sayılmaz — daha geri dönme ihtimali yaşıyor. Sayılsaydı en yeni işler
 *     her zaman kusursuz görünür, karne de sürekli kendini överdi.
 *  2. KATEGORİ GİRİLMEMİŞ. Kategorisi boş fiş ölçüye girmez; sonrasında
 *     kategorisi boş bir ziyaret varsa da hüküm BELİRSİZ kalır — o ziyaretin
 *     aynı arıza olup olmadığı bilinmiyor.
 *  3. AZ İŞ. EN_AZ_FIS fişin altında oran yayımlanmaz. Üç işten ikisi geri
 *     geldiğinde "%33 başarı" yazmak, teknisyen hakkında veri değil
 *     iftiradır.
 *  4. TÜRETİLMİŞ GEÇMİŞ. Aşama geçmişi sonradan üretilmiş fişin süresi
 *     ölçülmez (bkz. lib/sla.ts).
 *
 * ── ESKİ KAYITLARDA KAPANIŞ ANI ──────────────────────────────────────────
 * Aşama geçmişi olmayan (aktarılmış ya da eski yoldan kapatılmış) fişte
 * kapanış anı, fişin son durum damgasından alınır ve YAKLAŞIK sayılır.
 * Sebep: ilk-seferde penceresi 30 gün; gün doğruluğundaki bir damga bu
 * hükme yeter. SÜRE ölçümüne yetmez ve oraya hiç girmez. Yaklaşık damgaya
 * dayanan hüküm sayısı ayrıca tutulur, ekran o sayıyı yazar — çünkü
 * bayilerin çoğunda geçmiş veri tam olarak böyledir ve bunu söylemeden
 * yayımlanan bir oran, olduğundan kesin görünür.
 *
 * ── ATANMAMIŞ FİŞ ────────────────────────────────────────────────────────
 * Teknisyeni olmayan fiş kendi satırında gösterilir ve ASLA puanlanmaz.
 * Çoğu bayide fişlerin önemli bölümü atanmamıştır; bunu gizlemek toplamı
 * yalan yapar.
 */

/** Tekrar çağrı penceresi (gün). */
export const TEKRAR_GUN = 30;
/** Oran yayımlamak için gereken en az ölçülebilir fiş sayısı. */
export const EN_AZ_FIS = 5;

export type FisYargi = 'ILK_SEFERDE' | 'TEKRAR_GELDI' | 'BEKLEMEDE' | 'BELIRSIZ' | 'KAPSAM_DISI';
export type YargiSebep =
  | 'IPTAL' | 'KATEGORI_YOK' | 'ARIZA_DEGIL' | 'ACIK'
  | 'KAPANIS_BILINMIYOR' | 'SONRAKI_KATEGORI_YOK';

export interface KarneFisi {
  id: string;
  ticketNumber: string;
  teknisyenId: string | null;
  teknisyenAdi: string | null;
  cihazId: string;
  cihaz: string;
  musteri: string;
  /** Arıza kategorisi kodu; null = girilmemiş (uydurulmaz). */
  kategori: string | null;
  /** Kategori gerçek arıza mı (bakım/kurulum/sarf değil). */
  arizaMi: boolean;
  acilis: Date;
  /** Çözüm anı (READY/DELIVERED); bitmediyse null. */
  cozum: Date | null;
  /** Fiş HÂLÂ açık mı — fişin kendi durumundan gelir, geçmişinden değil. */
  acik: boolean;
  /**
   * Kapanış anı aşama geçmişinden değil, fişin son durum damgasından alındı.
   * Eski/aktarılmış kayıtlarda geçmiş satırı yoktur; damga gün doğruluğunda
   * olduğu için ilk-seferde hükmüne yeter (pencere 30 gün), SÜRE ölçümüne
   * yetmez — süre ayrıca `sureOlculemez` ile dışarıda tutulur.
   */
  kapanisYaklasik: boolean;
  iptal: boolean;
  /** Süre ölçülemiyor: türetilmiş geçmiş ya da bozuk takvim. */
  sureOlculemez: boolean;
  /** Çalışma saatiyle müdahale/çözüm dakikası (parça beklemesi düşülmüş). */
  mudahaleDk: number | null;
  cozumDk: number | null;
  /**
   * Değerlendirme penceresinde mi. false olan fişler yalnız TEKRAR tespiti
   * için getirilmiştir; karnede sayılmazlar.
   */
  pencerede: boolean;
}

export interface Yargi {
  yargi: FisYargi;
  sebep: YargiSebep | null;
  /** Tekrar çağrının fiş numarası — sayı değil, işin kendisi gösterilsin. */
  tekrarFisNo: string | null;
  /** Çözümle tekrar çağrı arasında geçen gün. */
  tekrarGun: number | null;
}

const GUN_MS = 86_400_000;

/**
 * Bir fişin hükmü.
 *
 * @param cihazFisleri Aynı cihazın bütün fişleri (bu fiş dahil).
 * @param simdi        Bekleme süresinin dolup dolmadığı buna göre ölçülür.
 */
export function fisYargisi(fis: KarneFisi, cihazFisleri: KarneFisi[], simdi: Date): Yargi {
  const bos: Yargi = { yargi: 'KAPSAM_DISI', sebep: null, tekrarFisNo: null, tekrarGun: null };

  if (fis.iptal) return { ...bos, sebep: 'IPTAL' };
  if (fis.kategori === null) return { ...bos, sebep: 'KATEGORI_YOK' };
  if (!fis.arizaMi) return { ...bos, sebep: 'ARIZA_DEGIL' };
  if (fis.acik) return { ...bos, sebep: 'ACIK' };
  // Kapanmış ama kapanış anı hiç bilinmiyor: pencere kurulamaz, hüküm yok.
  if (fis.cozum === null) return { ...bos, sebep: 'KAPANIS_BILINMIYOR' };

  const cozum = fis.cozum.getTime();
  const pencereSonu = cozum + TEKRAR_GUN * GUN_MS;

  // Çözümden SONRA açılmış, iptal edilmemiş ziyaretler.
  const sonrakiler = cihazFisleri
    .filter((x) => x.id !== fis.id && !x.iptal)
    .filter((x) => x.acilis.getTime() > cozum && x.acilis.getTime() <= pencereSonu)
    .sort((a, b) => a.acilis.getTime() - b.acilis.getTime());

  const tekrar = sonrakiler.find((x) => x.arizaMi && x.kategori === fis.kategori);
  if (tekrar) {
    return {
      yargi: 'TEKRAR_GELDI',
      sebep: null,
      tekrarFisNo: tekrar.ticketNumber,
      tekrarGun: Math.max(0, Math.round((tekrar.acilis.getTime() - cozum) / GUN_MS)),
    };
  }

  // Kategorisi girilmemiş bir ziyaret varsa aynı arıza mı bilinmiyor.
  const belirsiz = sonrakiler.find((x) => x.kategori === null);
  if (belirsiz) {
    return { yargi: 'BELIRSIZ', sebep: 'SONRAKI_KATEGORI_YOK', tekrarFisNo: belirsiz.ticketNumber, tekrarGun: null };
  }

  if (simdi.getTime() < pencereSonu) return { ...bos, yargi: 'BEKLEMEDE', sebep: null };

  return { ...bos, yargi: 'ILK_SEFERDE', sebep: null };
}

/** Ortanca. Ortalama değil: tek bir canavar iş bütün karneyi bozmasın. */
export function ortanca(sayilar: number[]): number | null {
  const s = sayilar.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const orta = Math.floor(s.length / 2);
  return s.length % 2 ? s[orta] : Math.round((s[orta - 1] + s[orta]) / 2);
}

export interface TeknisyenKarnesi {
  teknisyenId: string | null;
  teknisyenAdi: string | null;
  /** Penceredeki toplam fiş. */
  fis: number;
  ariza: number;
  planli: number;
  acik: number;
  ilkSeferde: number;
  tekrar: number;
  beklemede: number;
  belirsiz: number;
  kategorisiz: number;
  /** Hükmü YAKLAŞIK kapanış anına dayanan fiş sayısı — ekran bunu yazar. */
  yaklasik: number;
  /**
   * İlk seferde çözüm yüzdesi, 0-100 ÖLÇEĞİNDE (lib/bicim.ts yuzde()'nin
   * beklediği ölçek). Adında birimi taşıyor: oran mı yüzde mi karışınca
   * ekran "%100" yerine "%1" yazıyordu.
   * Yetersiz ölçümde null.
   */
  ilkSeferdeYuzde: number | null;
  /** Oran neden yok: az iş mi, hiç ölçülebilir fiş mi yok. */
  oranYok: 'AZ_IS' | 'OLCUM_YOK' | null;
  mudahaleOrtancaDk: number | null;
  cozumOrtancaDk: number | null;
  /** Ortancalara kaç fiş katkı verdi — güven göstergesi. */
  sureOlculen: number;
}

export interface KarneOzeti {
  fis: number;
  ariza: number;
  ilkSeferde: number;
  tekrar: number;
  beklemede: number;
  belirsiz: number;
  kategorisiz: number;
  yaklasik: number;
  atanmamis: number;
  ilkSeferdeYuzde: number | null;
  oranYok: 'AZ_IS' | 'OLCUM_YOK' | null;
  mudahaleOrtancaDk: number | null;
  cozumOrtancaDk: number | null;
  /** Karnesi olan teknisyen sayısı (atanmamış satırı hariç). */
  teknisyen: number;
}

export interface TekrarKaydi {
  fisNo: string;
  tekrarFisNo: string;
  gun: number;
  cihaz: string;
  musteri: string;
  kategori: string;
  teknisyenId: string | null;
  teknisyenAdi: string | null;
}

export interface KarneSonucu {
  karneler: TeknisyenKarnesi[];
  atanmamis: TeknisyenKarnesi | null;
  tekrarlar: TekrarKaydi[];
  ozet: KarneOzeti;
}

/** Yüzdeyi yalnız yeterli ölçüm varsa üretir. 0-100 ölçeğinde. */
function oranHesapla(ilkSeferde: number, tekrar: number): { oran: number | null; yok: 'AZ_IS' | 'OLCUM_YOK' | null } {
  const olculen = ilkSeferde + tekrar;
  if (olculen === 0) return { oran: null, yok: 'OLCUM_YOK' };
  if (olculen < EN_AZ_FIS) return { oran: null, yok: 'AZ_IS' };
  return { oran: (ilkSeferde / olculen) * 100, yok: null };
}

function bosKarne(id: string | null, ad: string | null): TeknisyenKarnesi {
  return {
    teknisyenId: id, teknisyenAdi: ad,
    fis: 0, ariza: 0, planli: 0, acik: 0,
    ilkSeferde: 0, tekrar: 0, beklemede: 0, belirsiz: 0, kategorisiz: 0, yaklasik: 0,
    ilkSeferdeYuzde: null, oranYok: 'OLCUM_YOK',
    mudahaleOrtancaDk: null, cozumOrtancaDk: null, sureOlculen: 0,
  };
}

/**
 * Bütün fişlerden teknisyen karnelerini çıkarır.
 *
 * `fisler` içinde pencerede olmayan fişler de bulunabilir; onlar yalnız
 * tekrar tespitinde kullanılır, karnede sayılmaz.
 *
 * `teknisyenler` verilirse dönemde HİÇ fişi olmayan teknisyen de listede
 * sıfır satırıyla görünür. İş almayan teknisyen listeden düşerse, yöneticinin
 * göreceği tek şey "herkes çalışıyor" olur.
 */
export function karneCikar(
  fisler: KarneFisi[],
  simdi: Date,
  teknisyenler: { id: string; ad: string }[] = [],
): KarneSonucu {
  // Cihaz bazlı gruplama — tekrar tespiti bunun üstünde çalışır.
  const cihazBazli = new Map<string, KarneFisi[]>();
  for (const f of fisler) {
    if (!cihazBazli.has(f.cihazId)) cihazBazli.set(f.cihazId, []);
    cihazBazli.get(f.cihazId)!.push(f);
  }

  const kutular = new Map<string, { karne: TeknisyenKarnesi; mudahale: number[]; cozum: number[] }>();
  const kutu = (id: string | null, ad: string | null) => {
    const anahtar = id ?? '';
    if (!kutular.has(anahtar)) kutular.set(anahtar, { karne: bosKarne(id, ad), mudahale: [], cozum: [] });
    const k = kutular.get(anahtar)!;
    if (ad && !k.karne.teknisyenAdi) k.karne.teknisyenAdi = ad;
    return k;
  };

  // Dönemde iş almamış teknisyen de listede kalsın.
  for (const t of teknisyenler) kutu(t.id, t.ad);

  const tekrarlar: TekrarKaydi[] = [];

  for (const f of fisler) {
    if (!f.pencerede) continue;
    const k = kutu(f.teknisyenId, f.teknisyenAdi);
    const c = k.karne;
    c.fis++;
    if (f.kategori === null) c.kategorisiz++;
    else if (f.arizaMi) c.ariza++;
    else c.planli++;
    if (f.acik && !f.iptal) c.acik++;

    // Süreler: iptal ve ölçülemez fişler girmez.
    if (!f.iptal && !f.sureOlculemez) {
      if (f.mudahaleDk !== null) k.mudahale.push(f.mudahaleDk);
      if (f.cozum !== null && f.cozumDk !== null) k.cozum.push(f.cozumDk);
    }

    const y = fisYargisi(f, cihazBazli.get(f.cihazId) ?? [f], simdi);
    // Hüküm yaklaşık bir kapanış anına dayanıyorsa sayılır ve ekranda yazılır.
    if (f.kapanisYaklasik && (y.yargi === 'ILK_SEFERDE' || y.yargi === 'TEKRAR_GELDI')) c.yaklasik++;
    if (y.yargi === 'ILK_SEFERDE') c.ilkSeferde++;
    else if (y.yargi === 'TEKRAR_GELDI') {
      c.tekrar++;
      tekrarlar.push({
        fisNo: f.ticketNumber,
        tekrarFisNo: y.tekrarFisNo!,
        gun: y.tekrarGun ?? 0,
        cihaz: f.cihaz,
        musteri: f.musteri,
        kategori: f.kategori!,
        teknisyenId: f.teknisyenId,
        teknisyenAdi: f.teknisyenAdi,
      });
    } else if (y.yargi === 'BEKLEMEDE') c.beklemede++;
    else if (y.yargi === 'BELIRSIZ') c.belirsiz++;
  }

  for (const k of kutular.values()) {
    const { oran, yok } = oranHesapla(k.karne.ilkSeferde, k.karne.tekrar);
    k.karne.ilkSeferdeYuzde = oran;
    k.karne.oranYok = yok;
    k.karne.mudahaleOrtancaDk = ortanca(k.mudahale);
    k.karne.cozumOrtancaDk = ortanca(k.cozum);
    k.karne.sureOlculen = k.cozum.length;
  }

  // ATANMAMIŞ fiş puanlanmaz: kimsenin karnesi değildir. Sayısı görünür.
  const atanmamisKutu = kutular.get('');
  const atanmamis = atanmamisKutu ? { ...atanmamisKutu.karne, ilkSeferdeYuzde: null, oranYok: null } : null;

  const karneler = [...kutular.values()]
    .map((k) => k.karne)
    .filter((k) => k.teknisyenId !== null)
    // Önce sorun: en çok tekrar çağrısı olan üstte. Oranı olmayanlar en altta.
    .sort((a, b) => {
      if (b.tekrar !== a.tekrar) return b.tekrar - a.tekrar;
      if ((a.ilkSeferdeYuzde === null) !== (b.ilkSeferdeYuzde === null)) return a.ilkSeferdeYuzde === null ? 1 : -1;
      return b.fis - a.fis;
    });

  const topla = (al: (k: TeknisyenKarnesi) => number) =>
    [...kutular.values()].reduce((s, k) => s + al(k.karne), 0);

  const tumMudahale = [...kutular.values()].flatMap((k) => k.mudahale);
  const tumCozum = [...kutular.values()].flatMap((k) => k.cozum);
  const genel = oranHesapla(topla((k) => k.ilkSeferde), topla((k) => k.tekrar));

  return {
    karneler,
    atanmamis,
    tekrarlar: tekrarlar.sort((a, b) => a.gun - b.gun),
    ozet: {
      fis: topla((k) => k.fis),
      ariza: topla((k) => k.ariza),
      ilkSeferde: topla((k) => k.ilkSeferde),
      tekrar: topla((k) => k.tekrar),
      beklemede: topla((k) => k.beklemede),
      belirsiz: topla((k) => k.belirsiz),
      kategorisiz: topla((k) => k.kategorisiz),
      yaklasik: topla((k) => k.yaklasik),
      atanmamis: atanmamis?.fis ?? 0,
      ilkSeferdeYuzde: genel.oran,
      oranYok: genel.yok,
      mudahaleOrtancaDk: ortanca(tumMudahale),
      cozumOrtancaDk: ortanca(tumCozum),
      teknisyen: karneler.length,
    },
  };
}
