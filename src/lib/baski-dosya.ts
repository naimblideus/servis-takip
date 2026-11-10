// BASKI DOSYASI KURALLARI — saf (veritabanı yok, ağ yok). Testte doğrudan
// derlenir; ön kontrol kısmı tarayıcıda da çalışır.
//
// WhatsApp'ta dosya turu şöyleydi: müşteri gönderir, "açılmıyor", yeniden
// gönderir, personel elle bilgisayara taşır. Burada dosya işin İÇİNDE durur;
// tür ve boyut yüklemeden önce denetlenir, sayfa sayısı dosyadan okunur.
import { KAPALI, type IsDurumu } from './baski-is';

export const DOSYA_AZAMI = 300 * 1024 * 1024; // dosya başına
export const IS_AZAMI = 1024 * 1024 * 1024; // iş başına toplam
export const IS_DOSYA_SAYISI = 20;
/** Çok parçalı yüklemede parça boyu. R2'de son parça hariç en az 5 MB. */
export const PARCA_BOYU = 8 * 1024 * 1024;
export const INDIRME_SANIYE = 300;
/** Parça adresi: yavaş bağlantıda 8 MB'ın yüklenmesine yetecek kadar. */
export const PARCA_SANIYE = 3600;
/** Ön kontrol bu boyuta kadar: daha büyüğünü tarayıcı belleğe almasın. */
export const ON_KONTROL_AZAMI = 60 * 1024 * 1024;

const UZANTI: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', tif: 'image/tiff', tiff: 'image/tiff',
};

/**
 * Dosya türü UZANTIDAN: tarayıcının bildirdiği tür istemcinin sözüdür ve
 * TIFF'te çoğu zaman boştur. Kabul edilmeyen uzantıda null.
 */
export function dosyaTuru(ad: unknown): string | null {
  const m = /\.([a-z0-9]{2,5})$/i.exec(String(ad ?? '').trim());
  return m ? UZANTI[m[1].toLowerCase()] ?? null : null;
}

/** Ekranda görünen ad: yol ve denetim karakterleri atılır. */
export function gorunenAd(ad: unknown): string {
  const s = String(ad ?? '').replace(/^.*[\\/]/, '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return s.slice(-160) || 'dosya';
}

/** R2 anahtarı: kiracı / iş / dosya kimliği / ASCII ad. Kiracılar ayrı klasörde. */
export function nesneAnahtari(tenantId: string, isId: string, dosyaId: string, ad: string): string {
  const duz = gorunenAd(ad).normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '').slice(-80) || 'dosya';
  return `t/${tenantId}/${isId}/${dosyaId}/${duz}`;
}

/** Müşteri, iş makineye girene kadar dosya ekleyebilir. */
export function musteriYukleyebilir(durum: IsDurumu): boolean {
  return durum === 'GELEN' || durum === 'SIRADA';
}
/** Personel, iş kapanana kadar (prova, düzeltilmiş dosya). */
export function personelYukleyebilir(durum: IsDurumu): boolean {
  return !KAPALI.includes(durum);
}

export type DosyaHatasi = 'DOSYA_TUR' | 'DOSYA_BUYUK' | 'DOSYA_COK' | 'DOSYA_IS_KAPALI';

export function yuklemeGecerli(
  d: { ad: unknown; boyut: unknown },
  is: { durum: IsDurumu; mevcutSayi: number; mevcutBoyut: number },
  kim: 'MUSTERI' | 'PERSONEL',
): { ok: true; mime: string; boyut: number; parca: number } | { ok: false; kod: DosyaHatasi } {
  if (!(kim === 'PERSONEL' ? personelYukleyebilir(is.durum) : musteriYukleyebilir(is.durum))) return { ok: false, kod: 'DOSYA_IS_KAPALI' };
  const mime = dosyaTuru(d.ad);
  if (!mime) return { ok: false, kod: 'DOSYA_TUR' };
  const boyut = Number(d.boyut);
  if (!Number.isInteger(boyut) || boyut <= 0 || boyut > DOSYA_AZAMI) return { ok: false, kod: 'DOSYA_BUYUK' };
  if (is.mevcutSayi >= IS_DOSYA_SAYISI || is.mevcutBoyut + boyut > IS_AZAMI) return { ok: false, kod: 'DOSYA_COK' };
  return { ok: true, mime, boyut, parca: parcaSayisi(boyut) };
}

export function parcaSayisi(boyut: number): number {
  return Math.max(1, Math.ceil(boyut / PARCA_BOYU));
}

/**
 * R2'nin gördüğü parçalar beklenenle uyuşuyor mu? Sıra eksiksiz, toplam
 * boyut bildirilenle aynı. Uyuşmayan yükleme kapatılmaz: yarım dosya
 * "yüklendi" görünürse baskıya öyle gider.
 */
export function parcalarTam(parcalar: readonly { no: number; boyut: number }[], boyut: number): boolean {
  if (parcalar.length !== parcaSayisi(boyut)) return false;
  let toplam = 0;
  for (let i = 0; i < parcalar.length; i++) { if (parcalar[i].no !== i + 1) return false; toplam += parcalar[i].boyut; }
  return toplam === boyut;
}

/** Teslim ya da iptalden `gun` gün geçti mi (dosyalar silinir). */
export function saklamaDoldu(is: { durum: string; teslimAt: Date | null; iptalAt: Date | null }, gun: number, simdi: Date): boolean {
  const kapanis = is.durum === 'TESLIM' ? is.teslimAt : is.durum === 'IPTAL' ? is.iptalAt : null;
  return !!kapanis && simdi.getTime() - new Date(kapanis).getTime() > gun * 86_400_000;
}

// ── ÖN KONTROL (tarayıcıda) ──────────────────────────────────────────────
// Sayfa sayısı ve ölçü dosyanın metninden okunur; ağır bir PDF kitaplığı
// indirilmez. Okunamazsa (şifreli, alışılmadık yapı) null döner ve müşteri
// sayıyı elle yazar. Sonuç zaten yalnız kolaylıktır: tutarı personel
// "Kabul"de dosyaya bakıp onaylar.

/** `i` konumunu içeren sözlüğün (<< … >>) sınırları; bulunamazsa null. */
function sozlukSiniri(s: string, i: number): [number, number] | null {
  let d = 0, bas = -1;
  for (let k = i; k >= 1 && i - k < 400_000; k--) {
    if (s[k] === '>' && s[k - 1] === '>') { d++; k--; } else if (s[k] === '<' && s[k - 1] === '<') { if (d === 0) { bas = k - 1; break; } d--; k--; }
  }
  if (bas < 0) return null;
  d = 0;
  for (let k = i; k < s.length - 1 && k - i < 400_000; k++) {
    if (s[k] === '<' && s[k + 1] === '<') { d++; k++; } else if (s[k] === '>' && s[k + 1] === '>') { if (d === 0) return [bas, k + 2]; d--; k++; }
  }
  return null;
}

/** Sözlüğün yalnız kendi düzeyi: iç sözlükler ve diziler atılır. */
function ustDuzey(s: string): string {
  let out = '', d = 0, dizi = 0;
  for (let k = 2; k < s.length - 2; k++) {
    if (s[k] === '<' && s[k + 1] === '<') { d++; k++; continue; }
    if (s[k] === '>' && s[k + 1] === '>') { d--; k++; continue; }
    if (s[k] === '[') { dizi++; continue; }
    if (s[k] === ']') { dizi--; continue; }
    if (d === 0 && dizi === 0) out += s[k];
  }
  return out;
}

/**
 * PDF metninden sayfa sayısı. Sayfa ağacının kökü en büyük /Count'u taşır;
 * bulunamazsa sayfa nesneleri sayılır. Hiçbiri yoksa null.
 */
export function pdfSayfaSay(metin: string): number | null {
  let enBuyuk = 0;
  for (const m of metin.matchAll(/\/Type\s*\/Pages(?![A-Za-z])/g)) {
    const sinir = sozlukSiniri(metin, m.index ?? 0);
    if (!sinir) continue;
    const c = /\/Count\s+(\d{1,7})(?!\s+\d+\s+R)/.exec(ustDuzey(metin.slice(sinir[0], sinir[1])));
    if (c) enBuyuk = Math.max(enBuyuk, Number(c[1]));
  }
  if (enBuyuk > 0) return enBuyuk;
  const yaprak = (metin.match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length;
  return yaprak > 0 ? yaprak : null;
}

/** İlk sayfa kutusu, milimetre (1 pt = 25,4/72 mm). */
export function pdfOlcu(metin: string): { enMm: number; boyMm: number } | null {
  const m = /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/.exec(metin);
  if (!m) return null;
  const en = Math.abs(Number(m[3]) - Number(m[1])), boy = Math.abs(Number(m[4]) - Number(m[2]));
  if (!(en > 0) || !(boy > 0)) return null;
  const mm = (pt: number) => Math.round((pt * 25.4) / 72);
  return { enMm: mm(en), boyMm: mm(boy) };
}

const EBATLAR: [string, number, number][] = [['A5', 148, 210], ['A4', 210, 297], ['A3', 297, 420], ['A2', 420, 594], ['A1', 594, 841], ['A0', 841, 1189]];

/** "A4" ya da "250×350 mm" (2 mm tolerans, yatay da tanınır). */
export function ebatAdi(enMm: number, boyMm: number): string {
  const [k, u] = enMm <= boyMm ? [enMm, boyMm] : [boyMm, enMm];
  const e = EBATLAR.find(([, a, b]) => Math.abs(a - k) <= 2 && Math.abs(b - u) <= 2);
  return e ? e[0] : `${enMm}×${boyMm} mm`;
}

/**
 * Görsel bu ölçüde bulanık çıkar mı? Büyük baskı uzaktan bakılır: kısa
 * kenarı 60 cm ve üstünde 72 dpi, altında 150 dpi istenir. Görsel yan
 * çevrilerek de basılabilir; iki yönden iyisi sayılır.
 */
export function dpiDusukMu(pxEn: number, pxBoy: number, enCm: number, boyCm: number): boolean {
  if (!(pxEn > 0 && pxBoy > 0 && enCm > 0 && boyCm > 0)) return false;
  const dpi = (a: number, b: number) => Math.min(a / (enCm / 2.54), b / (boyCm / 2.54));
  const esik = Math.min(enCm, boyCm) >= 60 ? 72 : 150;
  return Math.max(dpi(pxEn, pxBoy), dpi(pxBoy, pxEn)) < esik;
}
