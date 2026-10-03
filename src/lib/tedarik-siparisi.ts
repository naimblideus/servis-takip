// TEDARİKÇİ SİPARİŞİ — saf hesap (veritabanı yok).
//
// NEDEN: Bayi tonerini/parçasını çoğunlukla aynı birkaç toptancıdan alıyor.
// Asgari stoğun altına düşen kalemleri ekranda görmek yetmiyordu: hangisini
// kaç adet, kimden isteyeceğini kafasından çıkarıp WhatsApp'a tek tek
// yazıyordu. Bu dosya listeyi TEDARİKÇİYE göre gruplar ve her tedarikçi
// için hazır sipariş metni kurar.
//
// TAHMİN YOK:
//   • Hangi kalem: stok ≤ asgari stok (Stok ekranındaki "kritik" ile aynı)
//     VE bayi o kalemi gerçekten kullanıyor ya da alıyor: son 90 günde
//     servis fişinde kullanılmış ya da en az bir alış kaydı var.
//     ÖLÇÜLDÜ (2026-09-29, gerçek bayi verisinden türetilen demo): 338
//     kalemin 305'i "kritik" görünüyordu — hepsi içe aktarımda varsayılan
//     asgari stok 5 ve stok 0 ile gelmişti, hiçbiri 90 günde kullanılmamıştı.
//     Onları listeye koymak 305 satırlık, kimsenin göndermeyeceği bir
//     sipariş demekti. Hareketsiz kalemler ayrı bölümde; bayi isterse ekler.
//   • Kimden: o kalemin SON alış kaydındaki tedarikçi. Alış kaydı yoksa
//     "tedarikçisi belli değil" grubunda kalır — uydurulmaz.
//   • Kaç adet: asgari stoğa tamamlayan adet + son 90 günün AYLIK ORTALAMA
//     kullanımı (servis fişleri + toner sevkleri). Tek bir yoğun ay öneriyi
//     şişirmesin diye 30 gün değil 90 günün ortalaması. Tezgâh satışı parça
//     bazında kaydedilmediği için bu sayıya girmiyor; ekran bunu söylüyor.
//   • CİHAZ TALEBİ: toneri bitmek üzere olan ve tonerini bildiğimiz cihaz
//     başına bir adet (Sarf Takibi ile aynı hesap). Stok bu talebi
//     karşıladıktan sonra asgarinin altına düşecekse kalem listeye girer —
//     stok henüz asgarinin üstünde olsa bile.

export type SiparisParcasi = {
  id: string;
  ad: string;
  sku: string;
  oemKodu: string | null;
  grup: string | null;
  stok: number;
  asgari: number;
  kullanim90: number;
  alisVar: boolean;
  sonTedarikci: string | null;
  sonFiyat: number | null;
  /** Toneri bitmek üzere olan ve bu tonerle eşleşen cihaz sayısı (yolda olanlar hariç). */
  cihazTalebi?: number;
};

export type SiparisKalemi = SiparisParcasi & { oneri: number };
export type SiparisGrubu = { tedarikci: string | null; kalemler: SiparisKalemi[]; tahminiTutar: number | null };

// Sıra: sarf önce (bayinin ay içinde en çok tükettiği), sonra yedek parça.
const GRUP_SIRASI = ['TONER', 'INK', 'DRUM', 'FUSER', 'ROLLER', 'GEAR', 'SPARE', 'PAPER'];
const grupSirasi = (g: string | null) => { const i = GRUP_SIRASI.indexOf(g ?? ''); return i < 0 ? GRUP_SIRASI.length : i; };

/** Aylık ortalama kullanım (90 günden), yukarı yuvarlı. */
export function aylikKullanim(kullanim90: number): number {
  return Math.ceil(Math.max(0, kullanim90) / 3);
}

/** Önerilen adet: cihaz talebini karşıla, asgariye tamamla + aylık ortalama kullanım; en az 1. */
export function oneriAdet(p: Pick<SiparisParcasi, 'stok' | 'asgari' | 'kullanim90' | 'cihazTalebi'>): number {
  return Math.max(1, Math.max(0, p.asgari + (p.cihazTalebi ?? 0) - p.stok) + aylikKullanim(p.kullanim90));
}

/** Kalem siparişe girer mi: cihaz talebi karşılandıktan sonra stok asgarinin altına (ya da eşitine) düşüyorsa. */
export function siparisGerekli(p: Pick<SiparisParcasi, 'stok' | 'asgari' | 'cihazTalebi'>): boolean {
  return p.stok - (p.cihazTalebi ?? 0) <= p.asgari;
}

/** Bayi bu kalemi gerçekten kullanıyor ya da alıyor mu? */
export function aktifMi(p: Pick<SiparisParcasi, 'kullanim90' | 'alisVar' | 'cihazTalebi'>): boolean {
  return p.kullanim90 > 0 || p.alisVar || (p.cihazTalebi ?? 0) > 0;
}

/** Tedarikçi adını gruplamak için sadeleştirir ("AKSA  Toner" = "aksa toner"). */
export function tedarikciAnahtari(ad: string | null | undefined): string {
  return (ad ?? '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
}

const siraliKalemler = (k: SiparisKalemi[]) =>
  k.sort((a, b) => grupSirasi(a.grup) - grupSirasi(b.grup) || a.ad.localeCompare(b.ad, 'tr'));

export function tahminiTutar(kalemler: { sonFiyat: number | null; adet: number }[]): number | null {
  // Fiyatı bilinmeyen kalem varsa toplam söylenmez: eksik toplam yanlış toplamdır.
  if (!kalemler.length || !kalemler.every((k) => k.sonFiyat !== null && k.sonFiyat > 0)) return null;
  return Math.round(kalemler.reduce((s, k) => s + (k.sonFiyat as number) * k.adet, 0) * 100) / 100;
}

// Hizmet kalemleri (işçilik, tamir) stok kartı olarak açılmış olabilir ama
// toptancıdan sipariş edilmez.
const HIZMET_GRUPLARI = new Set(['LABOUR', 'REPAIR']);

export function siparisGruplari(parcalar: SiparisParcasi[]): { gruplar: SiparisGrubu[]; hareketsiz: SiparisKalemi[] } {
  const kritik = parcalar.filter((p) => siparisGerekli(p) && !HIZMET_GRUPLARI.has(p.grup ?? ''));
  const gruplar = new Map<string, SiparisGrubu>();
  const hareketsiz: SiparisKalemi[] = [];
  for (const p of kritik) {
    const kalem = { ...p, oneri: oneriAdet(p) };
    if (!aktifMi(p)) { hareketsiz.push(kalem); continue; }
    const anahtar = tedarikciAnahtari(p.sonTedarikci);
    let g = gruplar.get(anahtar);
    if (!g) { g = { tedarikci: p.sonTedarikci?.trim() || null, kalemler: [], tahminiTutar: null }; gruplar.set(anahtar, g); }
    g.kalemler.push(kalem);
  }
  const sonuc = [...gruplar.values()];
  for (const g of sonuc) {
    siraliKalemler(g.kalemler);
    g.tahminiTutar = tahminiTutar(g.kalemler.map((k) => ({ sonFiyat: k.sonFiyat, adet: k.oneri })));
  }
  // Tedarikçisi belli olanlar önce (en kalabalık üstte), belirsizler en sonda.
  sonuc.sort((a, b) => (a.tedarikci ? 0 : 1) - (b.tedarikci ? 0 : 1) || b.kalemler.length - a.kalemler.length);
  return { gruplar: sonuc, hareketsiz: siraliKalemler(hareketsiz) };
}

/**
 * Tedarikçiye gidecek metin. Metin kalıbı çağırandan gelir (bayinin dili);
 * burada yalnız satırlar kuruluyor. Kodu olan kalemde üretici kodu yazılır:
 * toptancı adı değil kodu arar.
 */
export function siparisMetni(args: {
  selam: string;
  kapanis: string;
  adetEki: string;
  kalemler: { ad: string; oemKodu: string | null; sku: string; adet: number }[];
}): string {
  const satirlar = args.kalemler
    .filter((k) => k.adet > 0)
    .map((k) => `• ${k.ad}${k.oemKodu ? ` (${k.oemKodu})` : ''} — ${k.adet} ${args.adetEki}`);
  return [args.selam, '', ...satirlar, '', args.kapanis].join('\n');
}
