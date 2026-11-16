// MATBAA SİPARİŞ OKUYUCU — matbaaya özgü katman (saf; testte derlenir).
//
// Müşteri siparişi WhatsApp'tan fotoğraf, PDF ya da yazı olarak atar. Belge
// okuyucu çekirdeği (lib/belge-okuyucu) onu okur; bu dosya MATBAANIN alan
// şemasını, kurallarını ve İŞ TASLAĞINA dönüştürmeyi tutar. Çalışan taslağı
// tezgah formunda düzeltip onaylar; onaydan önce panoda iş yoktur.
//
// Çekirdekte olanlar (burada YOK): model çağrısı, boyut/tür sınırı, anahtar
// yoksa kapalı, güvenilmeyen içerik, uydurmama / "emin" / "kaynak" kuralları.
//
// ── MATBAAYA ÖZGÜ KURALLAR ───────────────────────────────────────────────
// 1) MODEL SEÇENEK ARASINDAN SEÇER. Ürün yalnız matbaanın fiyatlı ürün
//    listesinden (şemada enum), seçim yalnız o ürünün grup/değer kodlarından.
// 2) FİYAT YOK. Şemada fiyat alanı yok; model fiyat yazsa da okunmaz. Tutarı
//    onayda mevcut motor (lib/baski-fiyat) hesaplar. (Fatura okuyacak bir ürün
//    fiyatı okur: bu kural çekirdekte değil, burada.)
// 3) ÖLÇÜ. Onayda okuyucunun önerisiyle son hal karşılaştırılır
//    (`duzeltmeler`): "okunan / düzeltmesiz onaylanan" oranı buradan.
import type { FiyatModeli, SecenekGrubu } from './baski-fiyat';
import {
  alan, belgeIstegi, belgeOku, bosAlan, dizi, kayit, kayitliAlan, metinAlan, nesne, sayiAlan, secimAlan, tarihAlan, telefonAlan,
  type Alan, type BelgeGirdisi, type BelgeIstegi, type Gun, type OkuyucuIstemci, type Sema,
} from './belge-okuyucu';

export const OKUYUCU_SURUM = 'okuyucu.v1';
/** Anahtar dururken yalnız matbaa okuyucusunu kapatan ortam değişkeni ("kapali"). */
export const OKUYUCU_KAPATMA = 'MATBAA_OKUYUCU';
export const AZAMI_KALEM = 10;
/** Siparişte yalnız gün yazıyorsa formdaki saat (çalışan düzeltir; alan "emin değilim" işaretli). */
export const SAATSIZ_TESLIM = '18:00';

// ── TİPLER ───────────────────────────────────────────────────────────────

export interface OkunanKalem {
  urunMetni: Alan; // müşterinin yazdığı ürün, olduğu gibi
  urunId: Alan; // fiyat listesinden eşleşme (yalnız listeden)
  adet: Alan<number>;
  sayfa: Alan<number>;
  olcu: Alan; // "A4", "50x70 cm" (ham)
  enCm: Alan<number>;
  boyCm: Alan<number>;
  kagit: Alan;
  renk: Alan;
  secimler: Record<string, Alan>; // grup kodu → değer kodu (yalnız ürünün seçeneklerinden)
}

export interface Okuma {
  siparisMi: boolean;
  musteriAd: Alan;
  telefon: Alan;
  firma: Alan;
  teslim: Alan; // "YYYY-MM-DD" ya da "YYYY-MM-DDTHH:MM" (işletmenin saatinde)
  kalemler: OkunanKalem[];
  not: string | null;
}

/** Okuyucuya verilen ürün: tezgahın ürünüyle aynı biçim (yalnız fiyatlı ürünler). */
export interface OkuyucuUrunu {
  id: string;
  tanim: { ad: string; fiyatModeli: FiyatModeli; secenekler: SecenekGrubu[] };
}

// ── MATBAA ŞEMASI VE KURALLARI ───────────────────────────────────────────

/** Matbaa sipariş şeması (çekirdeğin yapıcılarıyla). Ürün kimlikleri enum: model listede olmayanı yazamaz. */
export function semaKur(urunler: readonly OkuyucuUrunu[]): Sema {
  const kalem = nesne({
    urun_metni: alan.metin('Müşterinin yazdığı ürün, olduğu gibi'),
    urun_id: alan.secim(urunler.map((u) => u.id), 'Fiyat listesindeki ürünün kimliği; açıkça eşleşmiyorsa null'),
    adet: alan.sayi('İstenen adet ya da nüsha', { tam: true }),
    sayfa: alan.sayi('Sayfa sayısı (fotokopi, çıktı, cilt)', { tam: true }),
    olcu: alan.metin('Ölçü ya da ebat, yazıldığı gibi: A4, 50x70 cm, 9x5'),
    en_cm: alan.sayi('Genişlik, santimetre; yalnız ölçü açıkça yazılıysa'),
    boy_cm: alan.sayi('Yükseklik, santimetre; yalnız ölçü açıkça yazılıysa'),
    kagit: alan.metin('Kâğıt ya da malzeme, yazıldığı gibi'),
    renk: alan.metin('Renk: renkli, siyah-beyaz, 4+4, 4+0 …'),
    secimler: dizi(nesne({
      grup: { type: 'string' }, deger: { type: 'string' }, emin: { type: 'boolean' },
      kaynak: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    }), 'Seçilen ürünün seçenekleri: grup ve değer kodu'),
  });
  return nesne({
    siparis_mi: { type: 'boolean', description: 'İçerik bir baskı siparişi ya da teklif isteği mi?' },
    musteri_ad: alan.metin('Siparişi veren kişinin adı'),
    telefon: alan.metin('Telefon numarası, yazıldığı gibi'),
    firma: alan.metin('Firma ya da kurum adı'),
    teslim: alan.metin('İstenen teslim zamanı: YYYY-MM-DD ya da YYYY-MM-DDTHH:MM'),
    kalemler: dizi(kalem),
    not: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Kalemlere sığmayan kısa bilgi' },
  });
}

/** Matbaanın sistem metni (çekirdeğin ORTAK_KURALLAR'ından sonra gelir; sabit). */
export const SISTEM_METNI = `BU İŞLETME BİR BASKI MERKEZİ (MATBAA). Belge, müşterinin WhatsApp'tan gönderdiği bir sipariş. Ondan bir baskı işi taslağı çıkarırsın.

MATBAA KURALLARI
- Fiyat, tutar, indirim ya da KDV hesaplama ve yazma. Müşteri bir fiyat yazdıysa onu hiçbir alana koyma; fiyatı matbaanın fiyat listesi hesaplar.
- urun_id YALNIZ verilen fiyat listesindeki kimliklerden biri olabilir. Ürün listedekiyle açıkça aynı işse seç. Benzer ama farklıysa ya da listede yoksa null ver; urun_metni'ne müşterinin yazdığını yine yaz.
- secimler: yalnız seçtiğin ürünün seçenek gruplarından, o grubun değer kodlarıyla. Siparişte yazmayan seçimi ekleme; varsayılanı çalışan görür.
- adet: müşterinin istediği adet ya da nüsha. Sayfa sayısı ayrı alandır (sayfa). Yazmıyorsa null.
- Ölçü: olcu alanına yazıldığı gibi yaz. en_cm ve boy_cm'yi yalnız ölçü sayıyla açıkça verilmişse doldur (metre ya da milimetreyse santimetreye çevir). A4, A3 gibi standart ebatlar için en/boy yazma.
- Kâğıt ve renk: yazıldığı gibi kagit ve renk alanlarına yaz; seçilen üründe uygun bir seçenek grubu varsa secimler'e de ekle.
- teslim: müşterinin istediği teslim zamanı. "yarın", "cuma", "pazartesi öğlen" gibi ifadeleri verilen bugünün tarihine göre YYYY-MM-DD (saat varsa YYYY-MM-DDTHH:MM, 24 saat) biçimine çevir; göreli bir ifadeden çevirdiysen emin: false. Saat yazmıyorsa yalnız tarih ver.
- telefon: yazıldığı gibi. Metinde numara yoksa null.
- Birden çok iş istenmişse her biri ayrı kalem olsun (en çok 10).
- not: kalemlere sığmayan ama işi etkileyen kısa bilgi (cilt, kesim, teslim adresi, "acele" gibi), Türkçe, en çok üç cümle. Yoksa null.
- siparis_mi: içerik bir baskı ya da fotokopi siparişi veya teklif isteği değilse (selamlaşma, alakasız bir görüntü) false ver ve kalemler'i boş bırak.`;

const OLCUM: Record<FiyatModeli, string> = {
  SAYFA: 'sayfa başı: adet = nüsha, sayfa gerekli',
  ADET: 'adet başı',
  ALAN: 'alan: en_cm ve boy_cm gerekli',
  SABIT: 'sabit fiyat: adet',
};

/** Modele giden ürün listesi: kimlik, ad, ölçüm biçimi, seçenek kodları. */
export function urunListesi(urunler: readonly OkuyucuUrunu[]) {
  return urunler.map((u) => ({
    id: u.id,
    ad: u.tanim.ad,
    olcum: OLCUM[u.tanim.fiyatModeli] ?? OLCUM.ADET,
    secenekler: u.tanim.secenekler.map((g) => ({ grup: g.kod, ad: g.ad, degerler: g.degerler.map((d) => ({ kod: d.kod, ad: d.ad })) })),
  }));
}

function istekGirdisi(girdi: BelgeGirdisi, urunler: readonly OkuyucuUrunu[], gun: Gun) {
  return {
    urunSistemi: SISTEM_METNI,
    sema: semaKur(urunler),
    girdi,
    baglam: [
      `Bugün: ${gun.tarih} (${gun.gunAdi}), saat dilimi ${gun.saatDilimi}.`,
      'Fiyat listesindeki ürünler (urun_id ve seçenek kodları yalnız buradan):',
      JSON.stringify(urunListesi(urunler)),
    ],
  };
}

/** Modele giden istek (testte biçimi denetlenir). */
export function istekKur(girdi: BelgeGirdisi, urunler: readonly OkuyucuUrunu[], gun: Gun): BelgeIstegi {
  return belgeIstegi(istekGirdisi(girdi, urunler, gun));
}

export type OkumaSonucu =
  | { ok: true; okuma: Okuma; model: string; girdiToken: number | null; ciktiToken: number | null }
  | { ok: false; kod: 'OKUMA_REDDEDILDI' | 'OKUMA_ANLASILAMADI' | 'OKUMA_SIPARIS_DEGIL' };

/**
 * Siparişi okur (çekirdek) ve matbaa kurallarıyla doğrular. Ağ ve API
 * hataları FIRLATILIR (lib/belge-okuyucu-sunucu `modelHatasi` ayırır).
 */
export async function siparisOku(istemci: OkuyucuIstemci, girdi: BelgeGirdisi, urunler: readonly OkuyucuUrunu[], gun: Gun): Promise<OkumaSonucu> {
  const s = await belgeOku(istemci, istekGirdisi(girdi, urunler, gun));
  if (!s.ok) return s;
  const okuma = okumaCoz(s.ham, urunler, gun.tarih);
  if (!okuma) return { ok: false, kod: 'OKUMA_ANLASILAMADI' };
  if (!okuma.siparisMi && !okuma.kalemler.length) return { ok: false, kod: 'OKUMA_SIPARIS_DEGIL' };
  return { ok: true, okuma, model: s.model, girdiToken: s.girdiToken, ciktiToken: s.ciktiToken };
}

// ── YANIT DOĞRULAMA (matbaa alanları) ────────────────────────────────────

function kalemCoz(x: unknown, urunler: readonly OkuyucuUrunu[]): OkunanKalem | null {
  const k = kayit(x);
  if (!k) return null;
  // Listede olmayan kimlik: model uydurmuş ya da karıştırmış; atılır, işaret kalır.
  const urunId = secimAlan(k.urun_id, urunler.map((u) => u.id));
  const urun = urunId.deger ? urunler.find((u) => u.id === urunId.deger) : undefined;

  const secimler: Record<string, Alan> = {};
  if (urun && Array.isArray(k.secimler)) {
    for (const s of k.secimler) {
      const o = kayit(s);
      if (!o || typeof o.grup !== 'string' || typeof o.deger !== 'string') continue;
      const g = urun.tanim.secenekler.find((x) => x.kod === o.grup);
      if (!g || secimler[g.kod] || !g.degerler.some((d) => d.kod === o.deger)) continue;
      secimler[g.kod] = metinAlan(o, 40);
    }
  }

  const kalem: OkunanKalem = {
    urunMetni: metinAlan(k.urun_metni, 160),
    urunId,
    adet: sayiAlan(k.adet, { tam: true, min: 1, max: 1_000_000 }),
    sayfa: sayiAlan(k.sayfa, { tam: true, min: 1, max: 100_000 }),
    olcu: metinAlan(k.olcu, 60),
    enCm: sayiAlan(k.en_cm, { tam: false, min: 0.1, max: 10_000 }),
    boyCm: sayiAlan(k.boy_cm, { tam: false, min: 0.1, max: 10_000 }),
    kagit: metinAlan(k.kagit, 80),
    renk: metinAlan(k.renk, 40),
    secimler,
  };
  const dolu = [kalem.urunMetni, kalem.urunId, kalem.adet, kalem.sayfa, kalem.olcu, kalem.enCm, kalem.boyCm, kalem.kagit, kalem.renk]
    .some((a) => a.deger !== null) || Object.keys(secimler).length > 0;
  return dolu ? kalem : null;
}

/**
 * Model çıktısı → doğrulanmış okuma. Geçersiz değer boş + "emin değil"
 * olur; şema dışı anahtarlar (fiyat dahil) okunmaz. Nesne değilse null.
 */
export function okumaCoz(ham: unknown, urunler: readonly OkuyucuUrunu[], bugun?: string): Okuma | null {
  const o = kayit(ham);
  if (!o) return null;
  const kalemler = (Array.isArray(o.kalemler) ? o.kalemler : [])
    .map((k) => kalemCoz(k, urunler))
    .filter((k): k is OkunanKalem => k !== null)
    .slice(0, AZAMI_KALEM);
  const not = typeof o.not === 'string' && o.not.trim() ? o.not.replace(/\s+/g, ' ').trim().slice(0, 500) : null;
  return {
    siparisMi: o.siparis_mi !== false,
    musteriAd: metinAlan(o.musteri_ad, 120),
    telefon: telefonAlan(o.telefon),
    firma: metinAlan(o.firma, 160),
    teslim: tarihAlan(o.teslim, { gelecek: bugun }),
    kalemler,
    not,
  };
}

/** Kayıttan geri okuma (Json sütunu): bozuksa boş bir okuma. */
export function kayitliOkuma(ham: unknown, urunler: readonly OkuyucuUrunu[]): Okuma {
  const o = kayit(ham);
  const kalemler = (Array.isArray(o?.kalemler) ? o!.kalemler as unknown[] : []).map((x) => {
    const k = kayit(x) ?? {};
    const sec = kayit(k.secimler) ?? {};
    return {
      urunMetni: kayitliAlan<string>(k.urunMetni), urunId: kayitliAlan<string>(k.urunId), adet: kayitliAlan<number>(k.adet),
      sayfa: kayitliAlan<number>(k.sayfa), olcu: kayitliAlan<string>(k.olcu), enCm: kayitliAlan<number>(k.enCm),
      boyCm: kayitliAlan<number>(k.boyCm), kagit: kayitliAlan<string>(k.kagit), renk: kayitliAlan<string>(k.renk),
      secimler: Object.fromEntries(Object.entries(sec).map(([g, a]) => [g, kayitliAlan<string>(a)])),
    };
  });
  // Kayıttan sonra ürün silindiyse/fiyatı kalktıysa eşleşme düşer (seçimler de).
  for (const k of kalemler) {
    if (k.urunId.deger && !urunler.some((u) => u.id === k.urunId.deger)) { k.urunId = bosAlan(false); k.secimler = {}; }
  }
  return {
    siparisMi: o?.siparisMi !== false,
    musteriAd: kayitliAlan(o?.musteriAd), telefon: kayitliAlan(o?.telefon), firma: kayitliAlan(o?.firma), teslim: kayitliAlan(o?.teslim),
    kalemler, not: typeof o?.not === 'string' ? o.not : null,
  };
}

/**
 * Atılan taslakta kişisel bilgi tutulmaz: ad, telefon, firma ve not (adres
 * olabilir) silinir; alıntıları (kaynak) da. Kalemler kalır: ölçü ve sayım
 * için gerekir, kişi değil.
 */
export function kisiselBilgiSil(ham: unknown): Record<string, unknown> {
  const o = kayit(ham) ?? {};
  const bos = bosAlan(true);
  return { ...o, musteriAd: bos, telefon: bos, firma: bos, not: null };
}

// ── TASLAK (tezgah formunun başlangıcı) ──────────────────────────────────

export interface FormKalemi { urunId: string; adet: string; sayfa: string; en: string; boy: string; secimler: Record<string, string> }
export interface TaslakForm {
  musteriAd: string;
  telefon: string;
  firma: string;
  /** datetime-local değeri ("YYYY-MM-DDTHH:MM") ya da boş. */
  teslim: string;
  /** Siparişte saat yoktu: SAATSIZ_TESLIM yazıldı; ölçüde yalnız gün karşılaştırılır. */
  teslimSaatYok: boolean;
  not: string;
  kalemler: FormKalemi[];
}
export interface TaslakGorunumu {
  form: TaslakForm;
  /** "emin değilim" işaretli alanlar: musteriAd, telefon, firma, teslim, kalem1.urun, kalem1.adet … */
  belirsiz: string[];
  /** Kalem başına siparişte yazan ham bilgi: "Kartvizit · 9x5 · 350 gr kuşe · 4+4". */
  ipuclari: string[];
  /** Alan anahtarı → belgede nereden okunduğu (çekirdeğin `kaynak`ı): çalışan emin olunmayanı oradan kontrol eder. */
  kaynaklar: Record<string, string>;
}

const BOS_FORM_KALEMI: FormKalemi = { urunId: '', adet: '', sayfa: '', en: '', boy: '', secimler: {} };
const yazi = (n: number | null) => (n === null ? '' : String(n));

/** Okuma → tezgah formu değerleri, belirsiz alanlar, ipuçları ve kaynaklar. */
export function taslakGorunumu(okuma: Okuma): TaslakGorunumu {
  const belirsiz: string[] = [];
  const kaynaklar: Record<string, string> = {};
  const isaretle = (anahtar: string, ...alanlar: Alan<unknown>[]) => {
    if (alanlar.some((a) => !a.emin)) belirsiz.push(anahtar);
    const k = alanlar.find((a) => a.kaynak)?.kaynak;
    if (k) kaynaklar[anahtar] = k;
  };
  isaretle('musteriAd', okuma.musteriAd);
  isaretle('telefon', okuma.telefon);
  isaretle('firma', okuma.firma);

  let teslim = '';
  let teslimSaatYok = false;
  if (okuma.teslim.deger) {
    teslimSaatYok = okuma.teslim.deger.length === 10;
    teslim = teslimSaatYok ? `${okuma.teslim.deger}T${SAATSIZ_TESLIM}` : okuma.teslim.deger;
  }
  if (!okuma.teslim.emin || teslimSaatYok) belirsiz.push('teslim');
  if (okuma.teslim.kaynak) kaynaklar.teslim = okuma.teslim.kaynak;

  const ipuclari: string[] = [];
  const kalemler = okuma.kalemler.map((k, i) => {
    const n = `kalem${i + 1}`;
    isaretle(`${n}.urun`, k.urunId);
    isaretle(`${n}.adet`, k.adet);
    isaretle(`${n}.sayfa`, k.sayfa);
    isaretle(`${n}.olcu`, k.olcu, k.enCm, k.boyCm);
    isaretle(`${n}.ipucu`, k.urunMetni, k.kagit, k.renk);
    for (const [g, a] of Object.entries(k.secimler)) isaretle(`${n}.secim.${g}`, a);
    ipuclari.push([k.urunMetni.deger, k.adet.deger !== null ? `${k.adet.deger} adet` : null, k.olcu.deger, k.kagit.deger, k.renk.deger]
      .filter(Boolean).join(' · '));
    return {
      urunId: k.urunId.deger ?? '',
      adet: yazi(k.adet.deger),
      sayfa: yazi(k.sayfa.deger),
      en: yazi(k.enCm.deger),
      boy: yazi(k.boyCm.deger),
      secimler: Object.fromEntries(Object.entries(k.secimler).filter(([, a]) => a.deger).map(([g, a]) => [g, a.deger as string])),
    };
  });
  if (!kalemler.length) { kalemler.push({ ...BOS_FORM_KALEMI }); ipuclari.push(''); }

  return {
    form: {
      musteriAd: okuma.musteriAd.deger ?? '', telefon: okuma.telefon.deger ?? '', firma: okuma.firma.deger ?? '',
      teslim, teslimSaatYok, not: okuma.not ?? '', kalemler,
    },
    belirsiz,
    ipuclari,
    kaynaklar,
  };
}

/** Kaç alan "emin değilim" işaretli (kayıtta tutulur, listede gösterilir). */
export function belirsizSayisi(okuma: Okuma): number {
  return taslakGorunumu(okuma).belirsiz.filter((b) => !b.endsWith('.ipucu')).length;
}

// ── ÖLÇÜ: onayda ne düzeltildi ───────────────────────────────────────────

/** Onaylanan gövde (tezgah formunun gönderdiği) → karşılaştırılabilir form. */
export function sonForm(govde: Record<string, unknown>): Omit<TaslakForm, 'teslimSaatYok' | 'not'> {
  const kalemler = Array.isArray(govde.kalemler) ? govde.kalemler : [];
  const s = (x: unknown) => (x === null || x === undefined ? '' : String(x));
  return {
    musteriAd: s(govde.musteriAd), telefon: s(govde.telefon), firma: s(govde.firma), teslim: s(govde.teslimYerel),
    kalemler: kalemler.map((x) => {
      const k = kayit(x) ?? {};
      const sec = kayit(k.secimler) ?? {};
      return {
        urunId: s(k.urunId), adet: s(k.adet), sayfa: s(k.sayfa), en: s(k.enCm), boy: s(k.boyCm),
        secimler: Object.fromEntries(Object.entries(sec).map(([g, v]) => [g, s(v)])),
      };
    }),
  };
}

const kisi = (x: string) => x.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr');
const hane10 = (x: string) => x.replace(/\D/g, '').slice(-10);
const sayi = (x: string) => { const n = Number(String(x).replace(',', '.')); return x.trim() === '' || !Number.isFinite(n) ? null : n; };

/**
 * Okuyucunun önerisi ile onaylanan hal arasındaki fark.
 *
 * - degisen: düzeltme sayılır. İş içeriği (ürün, adet, sayfa, ölçü, seçim,
 *   kalem sayısı) her farkta; boş bırakılanı doldurmak da düzeltmedir.
 * - doldurulan: müşteri adı, telefon, firma ve teslim okuyucu boş bıraktığı
 *   için çalışanca dolduruldu. Bunlar çoğu zaman siparişin İÇİNDE değil
 *   (numara WhatsApp'ın kendisinde, saat pazarlıkla) — okuyucu hatası sayılmaz.
 *   Okuyucunun yazdığı değer değiştiyse ya da silindiyse degisen'dir.
 * - Not, ödeme ve acil ölçüye girmez: okuyucunun işi değil.
 */
export function duzeltmeler(
  oneri: TaslakForm,
  son: Omit<TaslakForm, 'teslimSaatYok' | 'not'>,
  urunler: readonly OkuyucuUrunu[],
): { degisen: string[]; doldurulan: string[] } {
  const degisen: string[] = [];
  const doldurulan: string[] = [];

  const iletisim = (ad: string, once: string, sonra: string, esit: (a: string, b: string) => boolean) => {
    if (!once.trim()) { if (sonra.trim()) doldurulan.push(ad); return; }
    if (!esit(once, sonra)) degisen.push(ad);
  };
  iletisim('musteriAd', oneri.musteriAd, son.musteriAd, (a, b) => kisi(a) === kisi(b));
  iletisim('telefon', oneri.telefon, son.telefon, (a, b) => hane10(a) === hane10(b));
  iletisim('firma', oneri.firma, son.firma, (a, b) => kisi(a) === kisi(b));
  // Saatsiz teslimde formdaki saat bizim yazdığımız: yalnız gün karşılaştırılır.
  iletisim('teslim', oneri.teslim, son.teslim, (a, b) => (oneri.teslimSaatYok ? a.slice(0, 10) === b.slice(0, 10) : a.slice(0, 16) === b.slice(0, 16)));

  if (oneri.kalemler.length !== son.kalemler.length) degisen.push('kalemSayisi');
  const ortak = Math.min(oneri.kalemler.length, son.kalemler.length);
  for (let i = 0; i < ortak; i++) {
    const a = oneri.kalemler[i];
    const b = son.kalemler[i];
    const n = `kalem${i + 1}`;
    if (a.urunId !== b.urunId) { degisen.push(`${n}.urun`); continue; } // ürün değiştiyse gerisi zaten değişir
    const u = urunler.find((x) => x.id === b.urunId);
    if (sayi(a.adet) !== sayi(b.adet)) degisen.push(`${n}.adet`);
    if (u?.tanim.fiyatModeli === 'SAYFA' && sayi(a.sayfa) !== sayi(b.sayfa)) degisen.push(`${n}.sayfa`);
    if (u?.tanim.fiyatModeli === 'ALAN' && (sayi(a.en) !== sayi(b.en) || sayi(a.boy) !== sayi(b.boy))) degisen.push(`${n}.olcu`);
    for (const g of u?.tanim.secenekler ?? []) {
      // Seçilmemiş grup = varsayılanı (formda öyle görünür).
      const vars = g.degerler.find((d) => d.varsayilan)?.kod ?? '';
      if ((a.secimler[g.kod] || vars) !== (b.secimler[g.kod] || vars)) degisen.push(`${n}.secim.${g.kod}`);
    }
  }
  return { degisen, doldurulan };
}

/** Panel: okunan, onaylanan, düzeltmesiz ve yüzdeler (payda 0 ise null). */
export function okumaOrani(s: { okunan: number; onaylanan: number; duzeltmesiz: number }) {
  const yuzde = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
  return {
    ...s,
    /** Asıl ölçü: okunan siparişlerin yüzde kaçı hiç düzeltilmeden onaylandı. */
    duzeltmesizYuzde: yuzde(s.duzeltmesiz, s.okunan),
    onayYuzde: yuzde(s.onaylanan, s.okunan),
  };
}

/** En çok düzeltilen alan türleri (kalem numarası ve seçim grubu atılır), en çok 3. */
export function enCokDuzeltilen(listeler: readonly (readonly string[])[], adet = 3): { alan: string; n: number }[] {
  const say = new Map<string, number>();
  for (const l of listeler) {
    for (const a of new Set(l.map((x) => x.replace(/^kalem\d+\./, '').replace(/^secim\..+$/, 'secim')))) say.set(a, (say.get(a) ?? 0) + 1);
  }
  return [...say.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, adet).map(([alan, n]) => ({ alan, n }));
}
