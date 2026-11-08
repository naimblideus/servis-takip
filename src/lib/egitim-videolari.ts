/**
 * EKRAN İÇİ EĞİTİM VİDEOLARI — kod → dosya ve bölüm (saf; başlıklar sözlükte: t.egitim.video).
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Kurulum görüşmesi 45 dakika; sonra gelen yeni personel ve unutulan adım
 * için ekranın içinde kısa bir video lazım. Üç rehber videosu (4:47–6:31)
 * uygulamanın dışındaydı ve bölüm atlama yoktu. Burada her bölüm kendi
 * başına bir klip: "▶ 1 dk" düğmesi videoyu o bölümün başından açar, sonunda
 * durdurur (`#t=bas,bit`, bileşen: components/EgitimVideosu.tsx).
 *
 * ── SANİYELER HESAPLANDI, TAHMİN DEĞİL ───────────────────────────────────
 * Videolar Remotion projesinde (C:\Projeler\nextus-servis-video) cümle cümle
 * kurgulanıyor. Bölüm = planın `kart` cümlesi; başı o cümlenin ekrana geldiği
 * an (RehberCekirdek: kare(başlangıç) − 4 kare), sonu bir sonraki bölümün başı.
 * Hesap: `node scripts/egitim-bolumler.mjs` (video projesinde). Mağaza'nın
 * "Site ayarları" bölümü 2:19 sürdüğü için 25. cümlede (Logo) ikiye bölündü.
 *
 * ⚠ Seslendirme değişirse (kullanıcının kendi sesi, viral-bitir.py) cümle
 * süreleri değişir: video yeniden kodlanır ve bu saniyeler aynı betikle
 * yeniden hesaplanır. scripts/test-egitim-videolari.mjs bölümün dosyanın
 * süresi içinde kaldığını denetler.
 *
 * ── DOSYALAR ─────────────────────────────────────────────────────────────
 * public/egitim/*.mp4: 720p H.264 (dikey klip 720×1280), dakikası ~1 MB,
 * bölüm başlarında anahtar kare (atlama anında olsun). Videolarda yalnız
 * ÖRNEK veri var ("Gerçek ekran · demo verisi"): depo herkese açık.
 * Videolar Türkçe; arayüz başka dildeyse düğme çıkmaz (`dil`).
 *
 * ── ÖĞRENDİKTEN SONRA HER SEFERİNDE ÇIKMAZ ───────────────────────────────
 * Video hiçbir yerde kendiliğinden açılmaz; yalnız düğme durur. Düğme nerede
 * ne kadar durur:
 *  - İlk giriş adımları (Başlangıç Rehberi, teknisyenin karşılama ekranı):
 *    adım bitince adımla birlikte gider.
 *  - Sayfalar (aktarma, Sayaç Turu, Faturalar, Mağaza): kişinin ilk
 *    EGITIM_ACIK_GUN gününde. 45 gün: kim ayın hangi günü katılırsa katılsın
 *    ilk ay sonu sayaç ve faturası içine girsin. Klibi sonuna kadar izleyen
 *    kişide o düğme bir sonraki açılışta kalkar (`izlenenlereEkle`).
 *    Süre kişinin hesabından sayılır: yeni gelen personel kendi 45 gününü alır.
 *  - Yardım: her zaman, bütün klipler (unutulan adım).
 *
 * ── SİSTEMİ YAVAŞLATMAZ ──────────────────────────────────────────────────
 *  - Video yalnız ▶'e basılınca iner: `<video>` pencere açılınca kurulur,
 *    preload="none"; inen de dosyanın tamamı değil, izlenen bölüm (moov önde,
 *    tarayıcı parça parça ister).
 *  - İkinci izleyiş telefonun kendi önbelleğinden: adreste dosyanın içerik
 *    özeti var (`surum`, ?v=) ve /egitim/ bir yıl önbellekte kalır
 *    (next.config.ts). Video değişince özet, dolayısıyla adres değişir;
 *    eskisi gösterilmez. scripts/test-egitim-videolari.mjs özeti dosyadan
 *    hesaplayıp karşılaştırır.
 *  - Telefona kurulan uygulamanın service worker'ı videolara karışmaz,
 *    önceden indirmez (public/sw.js; test kilitliyor).
 *  - Süresi dolan ya da klibi izleyen kişide sayfa hiçbir istek atmaz:
 *    dönemin bitiş anı bir kez sorulur, tarayıcıda saklanır; dosya
 *    kontrolü yalnız düğme gösterilecekse yapılır (EgitimVideosu).
 */
import type { Dil } from './i18n/sozluk';

/** `surum`: dosyanın SHA-256 özetinin ilk 8 hanesi (önbellek adresi; test denetler). */
export const EGITIM_DOSYALARI = {
  servis: { yol: '/egitim/servis-kurulum.mp4', sure: 286.85, dil: 'tr', surum: '9c1b90c9' },
  kiralik: { yol: '/egitim/servis-kiralama.mp4', sure: 391.32, dil: 'tr', surum: '0781d475' },
  magaza: { yol: '/egitim/magaza-kurulum.mp4', sure: 385.34, dil: 'tr', surum: 'f0bee205' },
  teknisyen: { yol: '/egitim/teknisyen-telefonda.mp4', sure: 87.85, dil: 'tr', surum: '740a1c2d' },
} as const satisfies Record<string, { yol: string; sure: number; dil: Dil; surum: string }>;

export type EgitimDosyasi = keyof typeof EGITIM_DOSYALARI;

/** Başlık anahtarı: t.egitim.video altında, TR ve EN. */
export type EgitimBaslik =
  | 'servisMusteri' | 'servisCihaz' | 'servisStokEkip' | 'servisFis' | 'servisSayacFatura' | 'servisTahsilat' | 'servisHerGun'
  | 'kiralikCihaz' | 'kiralikSozlesme' | 'kiralikSayac' | 'kiralikFatura' | 'kiralikKar'
  | 'magazaKur' | 'magazaAyarlar' | 'magazaGorunum' | 'magazaYayin' | 'magazaSiparis'
  | 'teknisyen' | 'teknisyenIs' | 'teknisyenSayac';

export interface EgitimVideo {
  dosya: EgitimDosyasi;
  /** saniye; videonun içinde bölümün başı ve sonu */
  bas: number;
  bit: number;
  baslik: EgitimBaslik;
}

export const EGITIM_VIDEOLARI = {
  // Servis kurulum ve kullanım rehberi (8 adım)
  'servis-musteri': { dosya: 'servis', bas: 53.27, bit: 90.13, baslik: 'servisMusteri' },
  'servis-cihaz': { dosya: 'servis', bas: 90.13, bit: 126.03, baslik: 'servisCihaz' },
  'servis-stok-ekip': { dosya: 'servis', bas: 126.03, bit: 155.73, baslik: 'servisStokEkip' },
  'servis-fis': { dosya: 'servis', bas: 155.73, bit: 192.87, baslik: 'servisFis' },
  'servis-sayac-fatura': { dosya: 'servis', bas: 192.87, bit: 230.4, baslik: 'servisSayacFatura' },
  'servis-tahsilat': { dosya: 'servis', bas: 230.4, bit: 252.9, baslik: 'servisTahsilat' },
  'servis-her-gun': { dosya: 'servis', bas: 252.9, bit: 270.13, baslik: 'servisHerGun' },
  // Kiralama rehberi (7 adım)
  'kiralik-cihaz': { dosya: 'kiralik', bas: 24.03, bit: 75.03, baslik: 'kiralikCihaz' },
  'kiralik-sozlesme': { dosya: 'kiralik', bas: 75.03, bit: 132.1, baslik: 'kiralikSozlesme' },
  'kiralik-sayac': { dosya: 'kiralik', bas: 132.1, bit: 217.07, baslik: 'kiralikSayac' },
  'kiralik-fatura': { dosya: 'kiralik', bas: 217.07, bit: 292.17, baslik: 'kiralikFatura' },
  'kiralik-kar': { dosya: 'kiralik', bas: 314, bit: 342.7, baslik: 'kiralikKar' },
  // Mağaza kurulum rehberi (8 adım; Site ayarları iki parça)
  'magaza-kur': { dosya: 'magaza', bas: 20.43, bit: 60.3, baslik: 'magazaKur' },
  'magaza-ayarlar': { dosya: 'magaza', bas: 84.7, bit: 169.73, baslik: 'magazaAyarlar' },
  'magaza-gorunum': { dosya: 'magaza', bas: 169.73, bit: 223.87, baslik: 'magazaGorunum' },
  // "Ürünler ve fiyatlar" (24 sn) ile "Yayına alın" (12 sn) tek klip: fiyatı olan ürün yayına girer.
  'magaza-yayin': { dosya: 'magaza', bas: 223.87, bit: 260.7, baslik: 'magazaYayin' },
  'magaza-siparis': { dosya: 'magaza', bas: 309.73, bit: 336.13, baslik: 'magazaSiparis' },
  // Teknisyen telefonda (dikey, 5 adım)
  'teknisyen': { dosya: 'teknisyen', bas: 0, bit: 87.8, baslik: 'teknisyen' },
  'teknisyen-is': { dosya: 'teknisyen', bas: 4.37, bit: 55.5, baslik: 'teknisyenIs' },
  'teknisyen-sayac': { dosya: 'teknisyen', bas: 55.5, bit: 76.9, baslik: 'teknisyenSayac' },
} as const satisfies Record<string, EgitimVideo>;

export type EgitimKodu = keyof typeof EGITIM_VIDEOLARI;

export function egitimKoduMu(x: unknown): x is EgitimKodu {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(EGITIM_VIDEOLARI, x);
}

/** Düğmedeki dakika: en az 1, yarım dakikadan yukarı yuvarlanır ("▶ 1 dk"). */
export function egitimDakika(kod: EgitimKodu): number {
  const v = EGITIM_VIDEOLARI[kod];
  return Math.max(1, Math.round((v.bit - v.bas) / 60));
}

/** Dosyanın adresi, içerik özetiyle: video değişince adres de değişir (uzun önbellek güvenli). */
export function egitimDosyaAdresi(dosya: EgitimDosyasi): string {
  const d = EGITIM_DOSYALARI[dosya];
  return `${d.yol}?v=${d.surum}`;
}

/** `<video src>`: dosya + bölüm (Media Fragments: tarayıcı baştan açar, sonda durur). */
export function egitimKaynagi(kod: EgitimKodu): string {
  const v = EGITIM_VIDEOLARI[kod];
  return `${egitimDosyaAdresi(v.dosya)}#t=${v.bas},${v.bit}`;
}

/** Sayfalardaki düğmeler kişinin hesabı açıldıktan sonra bu kadar gün görünür. */
export const EGITIM_ACIK_GUN = 45;

/** Öğrenme döneminin bittiği an (ms). Tarih okunamazsa null. */
export function egitimDonemiBitisi(katilim: Date | string | number): number | null {
  const an = new Date(katilim).getTime();
  return Number.isFinite(an) ? an + EGITIM_ACIK_GUN * 86_400_000 : null;
}

/** Kişi öğrenme döneminde mi (hesabın açıldığı an → şimdi < 45 gün). Tarih okunamazsa evet. */
export function egitimDonemindeMi(katilim: Date | string | number, simdi: number = Date.now()): boolean {
  const bitis = egitimDonemiBitisi(katilim);
  return bitis === null || simdi < bitis;
}

/**
 * Sonuna kadar izlenen klibi listeye ekler; aynı videoda onun içinde kalan
 * klipler de izlenmiş sayılır (teknisyenin tam klibini izleyen "Sayaç Turu"
 * parçasını da gördü). Listede bilinmeyen kod varsa atılır.
 */
export function izlenenlereEkle(once: readonly unknown[], kod: EgitimKodu): EgitimKodu[] {
  const v: EgitimVideo = EGITIM_VIDEOLARI[kod];
  const sonra = new Set<EgitimKodu>(once.filter(egitimKoduMu));
  for (const k of Object.keys(EGITIM_VIDEOLARI) as EgitimKodu[]) {
    const w: EgitimVideo = EGITIM_VIDEOLARI[k];
    if (w.dosya === v.dosya && w.bas >= v.bas && w.bit <= v.bit) sonra.add(k);
  }
  return [...sonra];
}
