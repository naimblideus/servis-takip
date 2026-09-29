// BANKA EKSTRESİNDEN TOPLU TAHSİLAT — saf motor (veritabanı yok).
//
// Kiralık bayinin ay sonu: 100 müşteri havale gönderiyor, her biri Tahsilat
// ekranında tek tek giriliyordu. Bu motor bankanın hesap hareketleri
// dosyasını okur, GELEN her havaleyi bir müşteriye eşler ve bayiye önerir.
// Karar bayinindir: hiçbir satır onaysız tahsilat olmaz.
//
// EŞLEŞME SIRASI — güçlüden zayıfa, ilk kesin cevap kazanır:
//   1. Açıklamada FATURA NUMARASI (SF-FAT-2026-00012 / GİB no)  → kesin
//   2. Açıklamada VERGİ / TC KİMLİK NUMARASI                    → kesin
//   3. Açıklamada ya da gönderende MÜŞTERİ ADI                  → eşleşti
//   4. Yalnız TUTAR bir müşterinin açık faturasını tutuyor       → yalnız öneri,
//      işaretli GELMEZ (aynı kira tutarını ödeyen çok müşteri olur)
// İki müşteri aynı güçte eşleşirse motor SEÇMEZ; ikisini de gösterir.
//
// TAHMİN YOK: kolon anlamı başlıktan okunur, bulunamazsa bayi seçer. Tutarın
// yönü (gelen/giden) başlıktan ya da işaretten okunur; giden satırlar
// tahsilat sayılmaz.

import { createHash } from 'node:crypto';
import { katla } from '@/lib/tr-katla';

export { katla };

const kelimeler = (s: string) => katla(s).split(/[^a-z0-9]+/).filter(Boolean);
const kompakt = (s: string) => katla(s).replace(/[^a-z0-9]/g, '');

// ── Değer okuma ─────────────────────────────────────────────────────────

/**
 * Tutar okuma — Türk ve İngiliz yazımı, işaret, para birimi.
 *   "1.234,56" → 1234.56     "1,234.56" → 1234.56     "-250,00" → -250
 *   "1.500"    → 1500 (TR binlik)                      "(75,00)" → -75
 *   "1.500,00 TL" / "₺1.500" / "+1500" / "1500-"  → işaret ve birim ayıklanır
 * İki ayraç birlikteyse SONDAKİ ondalıktır. Tek virgül ondalıktır (TR).
 * Tek nokta ve ardından tam 3 hane binliktir (TR "1.500").
 */
export function tutarOku(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  let negatif = false;
  if (/^\(.*\)$/.test(s)) { negatif = true; s = s.slice(1, -1); }
  s = s.replace(/\s+/g, '').replace(/₺|TRY|TL/gi, '');
  if (s.endsWith('-')) { negatif = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { negatif = true; s = s.slice(1); }
  else if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const nokta = s.lastIndexOf('.'), virgul = s.lastIndexOf(',');
  let duz: string;
  if (nokta >= 0 && virgul >= 0) {
    duz = virgul > nokta ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (virgul >= 0) {
    duz = (s.match(/,/g) ?? []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (nokta >= 0) {
    const p = s.split('.');
    duz = p.length > 2 || p[1].length === 3 ? s.replace(/\./g, '') : s;
  } else duz = s;

  const n = Number(duz);
  if (!Number.isFinite(n)) return null;
  const sonuc = Math.round(n * 100) / 100;
  return negatif ? -sonuc : sonuc;
}

const iki = (n: number) => String(n).padStart(2, '0');

function gecerliTarih(y: number, a: number, g: number): string | null {
  if (y < 1990 || y > 2100 || a < 1 || a > 12 || g < 1 || g > 31) return null;
  const d = new Date(Date.UTC(y, a - 1, g));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== a - 1 || d.getUTCDate() !== g) return null;
  return `${y}-${iki(a)}-${iki(g)}`;
}

/**
 * Tarih okuma → "YYYY-MM-DD". Türk bankaları GÜN önce yazar.
 *   29.09.2026 · 29/09/2026 · 29-09-2026 · 29.09.26 · 2026-09-29 · saatli hâlleri
 *   Excel seri numarası (45930) — .xlsx'te tarih hücresi sayı olarak durur.
 */
export function tarihOku(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return gecerliTarih(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (m) return gecerliTarih(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2})\b/);
  if (m) return gecerliTarih(2000 + +m[3], +m[2], +m[1]);
  m = s.match(/^(\d{5})(?:[.,]\d+)?$/);
  if (m) {
    const seri = +m[1];
    if (seri < 32874 || seri > 73050) return null; // 1990–2099
    const d = new Date(Date.UTC(1899, 11, 30) + seri * 86_400_000);
    return `${d.getUTCFullYear()}-${iki(d.getUTCMonth() + 1)}-${iki(d.getUTCDate())}`;
  }
  return null;
}

// ── Kolonlar ────────────────────────────────────────────────────────────

export type Rol = 'tarih' | 'aciklama' | 'tutar' | 'alacak' | 'borc' | 'yon' | 'gonderen' | 'referans';
export const ROLLER: readonly Rol[] = ['tarih', 'aciklama', 'tutar', 'alacak', 'borc', 'yon', 'gonderen', 'referans'];

/** Hangi kolon hangi anlamda. -1 = yok. */
export type Kolonlar = { baslikSatiri: number } & Record<Rol, number>;

// Dar kalıp geniş kalıptan ÖNCE: "Borç/Alacak" yön kolonudur, borç değil;
// "Valör" tarihi işlem tarihi değildir.
const KALIP: { rol: Rol | 'bakiye' | 'valor'; re: RegExp }[] = [
  { rol: 'bakiye', re: /(bakiye|balance)/ },
  { rol: 'yon', re: /^(b ?\/ ?a|ba|a ?\/ ?b|borc ?\/ ?alacak|alacak ?\/ ?borc|d ?\/ ?c|dc|yon|islem yonu)$/ },
  { rol: 'valor', re: /valor/ },
  { rol: 'tarih', re: /(tarih|date)/ },
  { rol: 'alacak', re: /(alacak|credit|gelen tutar|yatan)/ },
  { rol: 'borc', re: /(borc|debit|giden tutar|cekilen)/ },
  { rol: 'tutar', re: /(tutar|amount|miktar)/ },
  { rol: 'gonderen', re: /(gonderen|gonderici|karsi taraf|karsi hesap|alici ?\/ ?gonderen|counterparty|sender)/ },
  { rol: 'referans', re: /(dekont|referans|reference|fis no|islem no|ref no|sorgu no)/ },
  { rol: 'aciklama', re: /(aciklama|description|detay|explanation|narrative)/ },
];

const baslikKatla = (h: string) => katla(h).replace(/\s+/g, ' ').trim();

/** Bir başlık satırını kolon rollerine çevirir; ilk eşleşen kolon kazanır. */
export function kolonlariTani(basliklar: string[]): Record<Rol, number> {
  const k = Object.fromEntries(ROLLER.map((r) => [r, -1])) as Record<Rol, number>;
  basliklar.forEach((h, i) => {
    const b = baslikKatla(h);
    if (!b) return;
    for (const { rol, re } of KALIP) {
      if (!re.test(b)) continue;
      if (rol === 'bakiye' || rol === 'valor') return;       // bilerek yok sayılan
      if (k[rol] === -1) k[rol] = i;
      return;
    }
  });
  return k;
}

/**
 * Başlık satırını bul: ilk 40 satırda TARİH ve bir TUTAR kolonu (tutar ya
 * da alacak) taşıyan, en çok rol tanınan ilk satır. Üstteki "Hesap No",
 * "Dönem" gibi bilgi satırları böylece atlanıyor.
 */
export function kolonlariBul(satirlar: string[][]): Kolonlar | null {
  let enIyi: Kolonlar | null = null, enIyiSkor = 0;
  satirlar.slice(0, 40).forEach((s, i) => {
    const k = kolonlariTani(s);
    if (k.tarih < 0 || (k.tutar < 0 && k.alacak < 0)) return;
    const skor = ROLLER.filter((r) => k[r] >= 0).length;
    if (skor > enIyiSkor) { enIyi = { baslikSatiri: i, ...k }; enIyiSkor = skor; }
  });
  return enIyi;
}

// ── Hareketler ──────────────────────────────────────────────────────────

export type Hareket = {
  satir: number;      // dosyadaki satır (1 tabanlı, bayiye gösterilir)
  tarih: string;      // YYYY-MM-DD
  tutar: number;      // gelen tutar, hep pozitif
  aciklama: string;
  gonderen: string;
  referans: string;
  sira: number;       // aynı içerikli satırların dosyadaki sırası (0, 1, …)
  iz: string;         // satırın kimliği — aynı satır ikinci kez işlenmesin
};

/**
 * Satırın kimliği. Bakiye ve dosyadaki satır numarası BİLEREK yok: aynı
 * havale, farklı tarih aralığıyla indirilmiş iki ekstrede başka satırda
 * durur ama aynı havaledir. Aynı gün aynı müşteriden aynı açıklamayla iki
 * ayrı havale gelirse `sira` ikisini ayırır.
 */
export function izHesapla(h: Pick<Hareket, 'tarih' | 'tutar' | 'aciklama' | 'gonderen' | 'referans' | 'sira'>): string {
  const anahtar = [h.tarih, h.tutar.toFixed(2), kompakt(h.aciklama), kompakt(h.gonderen), kompakt(h.referans), h.sira].join('|');
  return createHash('sha256').update(anahtar).digest('hex');
}

export type OkumaSonucu =
  | { ok: true; basliklar: string[]; kolonlar: Kolonlar; hareketler: Hareket[]; giden: number; okunamayan: number[] }
  | { ok: false; hata: 'BASLIK_YOK' | 'HAREKET_YOK'; basliklar?: string[] };

/** Yön kolonundan: A/Alacak/C/Credit/+ gelen; B/Borç/D/Debit/- giden. */
function yonGelenMi(v: string): boolean | null {
  const s = katla(v).trim();
  if (!s) return null;
  if (/^(a|alacak|c|cr|credit|\+|gelen|yatan)/.test(s)) return true;
  if (/^(b|borc|d|dr|debit|-|giden|cekilen)/.test(s)) return false;
  return null;
}

/**
 * Tablodan gelen havaleleri çıkarır. `elle` verilirse kolonlar ondan
 * alınır (bayi ekranda değiştirdiyse), verilmezse başlıktan bulunur.
 */
export function hareketleriCikar(satirlar: string[][], elle?: Kolonlar | null): OkumaSonucu {
  const kolonlar = elle ?? kolonlariBul(satirlar);
  if (!kolonlar || kolonlar.tarih < 0 || (kolonlar.tutar < 0 && kolonlar.alacak < 0)) {
    return { ok: false, hata: 'BASLIK_YOK', basliklar: satirlar[elle?.baslikSatiri ?? 0] };
  }
  const basliklar = satirlar[kolonlar.baslikSatiri] ?? [];
  const hucre = (s: string[], rol: Rol) => (kolonlar[rol] >= 0 ? (s[kolonlar[rol]] ?? '').trim() : '');

  const hareketler: Hareket[] = [];
  const okunamayan: number[] = [];
  const siraSayaci = new Map<string, number>();
  let giden = 0;

  for (let i = kolonlar.baslikSatiri + 1; i < satirlar.length; i++) {
    const s = satirlar[i];
    const tarih = tarihOku(hucre(s, 'tarih'));
    if (!tarih) {
      // Tarihsiz satır: ara toplam, "Devreden bakiye", boş satır. Tutarı
      // olan tarihsiz satır bayiye OKUNAMADI diye bildirilir.
      if (tutarOku(hucre(s, 'tutar')) || tutarOku(hucre(s, 'alacak'))) okunamayan.push(i + 1);
      continue;
    }

    let tutar: number | null = null;
    if (kolonlar.alacak >= 0 || kolonlar.borc >= 0) {
      const a = tutarOku(hucre(s, 'alacak'));
      const b = tutarOku(hucre(s, 'borc'));
      if (a && Math.abs(a) > 0) tutar = Math.abs(a);
      else if (b && Math.abs(b) > 0) { giden++; continue; }
      else if (kolonlar.tutar >= 0) tutar = tutarOku(hucre(s, 'tutar'));
    } else {
      tutar = tutarOku(hucre(s, 'tutar'));
    }
    if (tutar == null) { okunamayan.push(i + 1); continue; }

    const yon = kolonlar.yon >= 0 ? yonGelenMi(hucre(s, 'yon')) : null;
    const gelen = yon ?? tutar > 0;
    if (!gelen || tutar === 0) { giden++; continue; }
    tutar = Math.abs(tutar);

    const aciklama = hucre(s, 'aciklama');
    const gonderen = hucre(s, 'gonderen');
    const referans = hucre(s, 'referans');
    const anahtar = [tarih, tutar.toFixed(2), kompakt(aciklama), kompakt(gonderen), kompakt(referans)].join('|');
    const sira = siraSayaci.get(anahtar) ?? 0;
    siraSayaci.set(anahtar, sira + 1);
    const h = { satir: i + 1, tarih, tutar, aciklama, gonderen, referans, sira };
    hareketler.push({ ...h, iz: izHesapla(h) });
  }

  if (!hareketler.length) return { ok: false, hata: 'HAREKET_YOK', basliklar };
  return { ok: true, basliklar, kolonlar, hareketler, giden, okunamayan };
}

// ── Eşleştirme ──────────────────────────────────────────────────────────

export type MusteriKaydi = { id: string; ad: string; unvan: string | null; vergiNo: string | null };
/** Son dönemin faturaları (ödenmiş olanlar da: müşteri eski faturayı yazabilir). */
export type FaturaKaydi = { id: string; musteriId: string; no: string; gibNo: string | null; acik: number };
/** Elle girilmiş ödemeler — "bu havaleyi zaten girmiş olabilirsin" uyarısı için. */
export type OdemeKaydi = { musteriId: string; tutar: number; tarih: string };

export type Neden = 'FATURA_NO' | 'VERGI_NO' | 'ISIM' | 'TUTAR';
export type Durum = 'ESLESTI' | 'ONERI' | 'BELIRSIZ' | 'ESLESMEDI' | 'ISLENMIS';

export type SatirSonucu = {
  hareket: Hareket;
  durum: Durum;
  musteriId: string | null;
  neden: Neden | null;
  adaylar: string[];
  faturaNo: string | null;
  tutarTutuyor: boolean;
  elleGirilmisOlabilir: boolean;
  secili: boolean;
};

// Şirket türü ve bağlaç — addan ayırt edici değil. "ABC Bilişim Ltd. Şti."
// ile banka açıklamasındaki "ABC BILISIM LIMITED SIRKETI" aynı müşteridir.
const DOLGU = new Set([
  'ltd', 'sti', 'limited', 'sirketi', 'sirket', 'as', 'a', 's', 'anonim', 've', 'ile', 'san', 'sanayi',
  'tic', 'ticaret', 'ltdsti', 'paz', 'pazarlama', 'ith', 'ihr', 'ithalat', 'ihracat', 'dis', 'ins', 'insaat',
  'ltdst', 'co', 'inc', 'the', 'and', 'of', 'koll', 'kollektif', 'komandit', 'hizm', 'hiz', 'hizmetleri',
]);

const anlamli = (s: string) => kelimeler(s).filter((k) => k.length >= 2 && !DOLGU.has(k) && !/^\d+$/.test(k));

type MusteriIzi = { id: string; setler: string[][]; vergi: string | null };

function musteriIzleri(musteriler: MusteriKaydi[]): MusteriIzi[] {
  return musteriler.map((m) => {
    const setler = [anlamli(m.ad), anlamli(m.unvan ?? '')].filter((s) => s.length > 0);
    const vergi = (m.vergiNo ?? '').replace(/\D/g, '');
    return { id: m.id, setler, vergi: vergi.length === 10 || vergi.length === 11 ? vergi : null };
  });
}

/**
 * Ad eşleşme gücü: [0..1] oran ve kelime sayısı. Bir kelime metinde tam
 * geçiyorsa bulunmuş sayılır; bankanın kestiği uzun kelime ("TEKNOLO")
 * için metindeki ≥5 harflik kelime, müşteri kelimesinin başıysa da sayılır.
 */
function adGucu(set: string[], metinKelime: Set<string>, uzunlar: string[]): number {
  let bulunan = 0;
  for (const k of set) {
    if (metinKelime.has(k)) { bulunan++; continue; }
    if (k.length >= 6 && uzunlar.some((w) => k.startsWith(w))) bulunan++;
  }
  return bulunan / set.length;
}

const kurus = (a: number, b: number) => Math.abs(a - b) < 0.005;
const gunFarki = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

export function eslestir(
  hareketler: Hareket[],
  veri: { musteriler: MusteriKaydi[]; faturalar: FaturaKaydi[]; odemeler: OdemeKaydi[]; islenmis: Set<string> },
): SatirSonucu[] {
  const izler = musteriIzleri(veri.musteriler);
  const vergiyle = new Map<string, string[]>();
  for (const m of izler) if (m.vergi) vergiyle.set(m.vergi, [...(vergiyle.get(m.vergi) ?? []), m.id]);

  // Fatura numarası: tam hâli (kompakt) + "yıl+sıra" kuyruğu (2026-00012 →
  // 202600012). Müşteri çoğu zaman öneki yazmaz.
  const faturaAnahtar = veri.faturalar.map((f) => ({
    f,
    tam: [kompakt(f.no), f.gibNo ? kompakt(f.gibNo) : ''].filter((x) => x.length >= 8),
    kuyruk: f.no.match(/(\d{4})\D*(\d{4,})$/) ? f.no.replace(/^.*?(\d{4})\D*(\d{4,})$/, '$1$2') : null,
  }));

  const acikFaturalar = new Map<string, number[]>();
  for (const f of veri.faturalar) if (f.acik > 0.004) acikFaturalar.set(f.musteriId, [...(acikFaturalar.get(f.musteriId) ?? []), f.acik]);
  const tutarTutar = (musteriId: string, tutar: number) => {
    const a = acikFaturalar.get(musteriId) ?? [];
    return a.some((x) => kurus(x, tutar)) || (a.length > 1 && kurus(a.reduce((s, x) => s + x, 0), tutar));
  };

  return hareketler.map((h): SatirSonucu => {
    const bos: SatirSonucu = {
      hareket: h, durum: 'ESLESMEDI', musteriId: null, neden: null, adaylar: [], faturaNo: null,
      tutarTutuyor: false, elleGirilmisOlabilir: false, secili: false,
    };
    if (veri.islenmis.has(h.iz)) return { ...bos, durum: 'ISLENMIS' };

    const metin = [h.aciklama, h.gonderen, h.referans].join(' ');
    const km = kompakt(metin);
    const kelime = kelimeler(metin);
    const kelimeSet = new Set(kelime);
    const komsular = new Set(kelime.slice(0, -1).map((k, i) => k + kelime[i + 1]));

    // `zayif`: tek kısa kelimelik ad ("Aksa"). Tutar da tutmuyorsa yalnız öneri.
    const sonuc = (musteriId: string, neden: Neden, ek: Partial<SatirSonucu> = {}, zayif = false): SatirSonucu => {
      const elle = veri.odemeler.some((o) => o.musteriId === musteriId && kurus(o.tutar, h.tutar) && gunFarki(o.tarih, h.tarih) <= 3);
      const tutuyor = tutarTutar(musteriId, h.tutar);
      const durum: Durum = neden === 'TUTAR' || (zayif && !tutuyor) ? 'ONERI' : 'ESLESTI';
      return {
        ...bos, ...ek, durum, musteriId, neden,
        tutarTutuyor: tutuyor,
        elleGirilmisOlabilir: elle,
        secili: durum === 'ESLESTI' && !elle,
      };
    };

    // 1 — fatura numarası
    const faturaBulgu = faturaAnahtar.filter(({ tam, kuyruk }) =>
      tam.some((t) => km.includes(t)) || (kuyruk !== null && (kelimeSet.has(kuyruk) || komsular.has(kuyruk))));
    const faturaMusterileri = [...new Set(faturaBulgu.map((b) => b.f.musteriId))];
    if (faturaMusterileri.length === 1) return sonuc(faturaMusterileri[0], 'FATURA_NO', { faturaNo: faturaBulgu[0].f.no });

    // 2 — vergi / TC kimlik numarası (10–11 haneli tam sayı dizisi)
    const vergiAdaylari = [...new Set((metin.match(/(?<!\d)\d{10,11}(?!\d)/g) ?? []).flatMap((v) => vergiyle.get(v) ?? []))];
    if (vergiAdaylari.length === 1) return sonuc(vergiAdaylari[0], 'VERGI_NO');

    // 3 — ad
    const uzunlar = kelime.filter((w) => w.length >= 5);
    const adaylar: { id: string; guc: number; kelime: number; zayif: boolean }[] = [];
    for (const m of izler) {
      let enIyi = { guc: 0, kelime: 0, zayif: false };
      for (const set of m.setler) {
        const g = adGucu(set, kelimeSet, uzunlar);
        // Tek kelimelik ad: 3 harf ve altı hiç sayılmaz ("Ali", "ABC" her
        // açıklamada geçebilir); 4 harf ZAYIF sayılır ("Aksa"); 5+ tamdır.
        const tek = set.length === 1;
        const yeterli = g === 1 ? !tek || set[0].length >= 4 : set.length >= 3 && g >= 0.75;
        if (yeterli && (g > enIyi.guc || (g === enIyi.guc && set.length > enIyi.kelime))) {
          enIyi = { guc: g, kelime: set.length, zayif: tek && set[0].length < 5 };
        }
      }
      if (enIyi.guc > 0) adaylar.push({ id: m.id, ...enIyi });
    }
    if (adaylar.length) {
      adaylar.sort((a, b) => b.guc - a.guc || b.kelime - a.kelime);
      const ust = adaylar.filter((a) => a.guc === adaylar[0].guc && a.kelime === adaylar[0].kelime);
      if (ust.length === 1) return sonuc(ust[0].id, 'ISIM', {}, ust[0].zayif);
      // Beraberliği tutar bozar: yalnız biri açık faturasını tutuyorsa o.
      const tutan = ust.filter((a) => tutarTutar(a.id, h.tutar));
      if (tutan.length === 1) return sonuc(tutan[0].id, 'ISIM', {}, tutan[0].zayif);
      return { ...bos, durum: 'BELIRSIZ', neden: 'ISIM', adaylar: ust.map((a) => a.id) };
    }
    if (faturaMusterileri.length > 1) return { ...bos, durum: 'BELIRSIZ', neden: 'FATURA_NO', adaylar: faturaMusterileri };
    if (vergiAdaylari.length > 1) return { ...bos, durum: 'BELIRSIZ', neden: 'VERGI_NO', adaylar: vergiAdaylari };

    // 4 — yalnız tutar: öneri, işaretsiz
    const tutanlar = [...acikFaturalar.keys()].filter((id) => tutarTutar(id, h.tutar));
    if (tutanlar.length === 1) return sonuc(tutanlar[0], 'TUTAR');
    if (tutanlar.length > 1 && tutanlar.length <= 5) return { ...bos, durum: 'BELIRSIZ', neden: 'TUTAR', adaylar: tutanlar };
    return bos;
  });
}

// ── Dağıtım ─────────────────────────────────────────────────────────────

/**
 * Bir havalenin iki borç havuzuna bölünüşü. Önce kira/sayaç faturaları
 * (en eski önce — mevcut tahsilat kuralı), artan servis cari borcuna,
 * o da biterse avans. Böylece müşterinin TOPLAM borcu ödenen kadar düşer;
 * yalnız faturaya yazılsaydı servis borcu olan müşteri ödediği hâlde
 * borçlu görünür, para da görünmeyen avansta kalırdı.
 */
export function dagit(tutar: number, faturaAcik: number, servisBorc: number) {
  const yuvarla = (n: number) => Math.round(n * 100) / 100;
  const faturaya = yuvarla(Math.max(0, Math.min(tutar, faturaAcik)));
  const servise = yuvarla(Math.max(0, Math.min(tutar - faturaya, servisBorc)));
  const avans = yuvarla(tutar - faturaya - servise);
  return { faturaya, servise, avans };
}
