// CSV içe aktarma — SIFIR BAĞIMLILIK.
// Türk Excel'i "CSV UTF-8" olarak kaydedince ayraç genelde NOKTALI VİRGÜL olur (virgül ondalık ayracı
// olduğu için). Bu yüzden ayraç otomatik tespit edilir; BOM temizlenir; tırnaklı alanlar desteklenir.

/** BOM'u at, satır sonlarını normalize et */
function clean(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Ayraç tespiti: ilk (tırnak dışı) satırda en çok geçen aday kazanır */
export function detectDelimiter(text: string): string {
  const firstLine = clean(text).split('\n').find((l) => l.trim().length > 0) || '';
  const candidates = [';', ',', '\t', '|'];
  let best = ';', bestCount = -1;
  for (const c of candidates) {
    let count = 0, inQ = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') inQ = !inQ;
      else if (!inQ && ch === c) count++;
    }
    if (count > bestCount) { bestCount = count; best = c; }
  }
  return bestCount > 0 ? best : ';';
}

/** RFC4180 uyumlu CSV ayrıştırıcı (tırnak içi ayraç/satır sonu ve "" kaçışı desteklenir) */
export function parseCSV(raw: string, delimiter?: string): string[][] {
  const text = clean(raw);
  const d = delimiter || detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQ = true; continue; }
    if (ch === d) { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  // Tamamen boş satırları at
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ── Kolon otomatik eşleme ───────────────────────────────────────────────
export type FieldKey =
  | 'customerName' | 'phone' | 'address' | 'taxNo'
  | 'legalName' | 'taxOffice' | 'city' | 'district'
  | 'brand' | 'model' | 'serialNo' | 'location'
  | 'counterBlack' | 'counterColor'
  | 'isRental' | 'monthlyRent' | 'pricePerBlack' | 'pricePerColor'
  // Kiralığın asıl modeli: kiraya dahil sayfa + aşan sayfanın fiyatı. Device
  // tablosunda alanlar vardı ama aktarım taşımıyordu; kiralıklar tek tek elle
  // düzeltiliyor, düzeltilmezse dahil sayfalar da ücretleniyordu.
  | 'includedBlack' | 'includedColor' | 'overagePriceBlack' | 'overagePriceColor'
  | 'installedAt' | 'lastInvoicedPeriod';

export const FIELD_LABEL: Record<FieldKey, string> = {
  customerName: 'Müşteri / Firma',
  phone: 'Telefon',
  address: 'Adres',
  taxNo: 'Vergi No',
  legalName: 'Ticari unvan',
  taxOffice: 'Vergi dairesi',
  city: 'İl',
  district: 'İlçe',
  brand: 'Marka',
  model: 'Model',
  serialNo: 'Seri No',
  location: 'Konum (kat/oda)',
  counterBlack: 'Sayaç (S/B)',
  counterColor: 'Sayaç (Renkli)',
  isRental: 'Kiralık mı',
  monthlyRent: 'Aylık kira',
  pricePerBlack: 'Sayfa fiyatı (S/B)',
  pricePerColor: 'Sayfa fiyatı (Renkli)',
  includedBlack: 'Dahil sayfa (S/B)',
  includedColor: 'Dahil sayfa (Renkli)',
  overagePriceBlack: 'Aşım fiyatı (S/B)',
  overagePriceColor: 'Aşım fiyatı (Renkli)',
  installedAt: 'Kurulum tarihi',
  lastInvoicedPeriod: 'Son faturalanan ay',
};

/**
 * Başlık adını eşleştirmeye HAZIR hâle getirir: Türkçe küçük harf + Türkçe
 * harfleri ASCII'ye katlama.
 *
 * NEDEN GEREKLİ (ölçüldü, tahmin değil): JavaScript'te /i bayrağı büyük
 * İ'yi i'ye katlamıyor. Bu yüzden "SERİ NO" başlığı /seri/i ile HİÇ
 * eşleşmiyordu — "SERI NO" eşleşiyor, "SERİ NO" eşleşmiyordu. Excel'den
 * büyük harf başlıkla gelen dosyada seri no kolonu sessizce boş kalıyor,
 * cihazların hiçbiri aktarılamıyordu. Aynı tuzak VERGİ NO, FİRMA, İSİM'de.
 *
 * Ters tuzak da var: tr-TR küçültme 'I' harfini 'ı' yapıyor, yani "FIRMA"
 * → "fırma" olup /firma/ ile eşleşmiyor. O yüzden küçültmeden SONRA
 * katlama şart — ikisi birlikte iki yönü de kapatıyor.
 */
export function basligiNormalle(h: string): string {
  return (h || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Başlık adından alan tahmini — Türkçe/İngilizce yaygın yazımlar */
const PATTERNS: { key: FieldKey; re: RegExp }[] = [
  // SIRA KRİTİK: dar kalıp geniş kalıptan ÖNCE. "Vergi Dairesi" aşağıdaki
  // taxNo kalıbına (/vergi/), "İlçe" city kalıbına (/il/), "Ünvan" ise
  // customerName kalıbına yakalanırdı. İlk eşleşen kazandığı için dar
  // olanlar yukarıda duruyor.
  { key: 'taxOffice', re: /(vergi dairesi|vergi d\.|v\.d\.|^vd$)/i },
  { key: 'district', re: /(ilce|district|semt)/i },
  { key: 'city', re: /^(il|sehir|city|province)$/i },
  // KİRALIK ŞARTLARI — kira, fiyat ve sayaç kalıplarından ÖNCE. Sonradan
  // gelselerdi:
  //  · "Aşım S/B Fiyatı" sayfa fiyatı kalıbına (/s\/?b.*fiyat/), "Aşım Renkli
  //    Fiyatı" renkli fiyat kalıbına düşerdi → aşım fiyatı sayfa fiyatı olurdu;
  //  · "Dahil S/B Sayfa" sayaç kalıbına (/s\/?b\b/), "Aylık Kiraya Dahil Sayfa"
  //    kira kalıbına (/aylik kira/) düşerdi → dahil sayfa sayaç ya da kira olurdu.
  // Renkliler siyahtan önce: "Dahil Renkli Sayfa" siyah kalıbına da uyar.
  // Dahil sayfa bir ADET: başlığında fiyat/ücret/tutar geçen kolon asla dahil
  // sayfa değildir ("KDV Dahil Fiyat", "Kira (TL)"). "Toner dahil", "Sarf dahil"
  // gibi evet/hayır kolonları da yakalanmaz: dahil kelimesinin yanında sayfa,
  // S/B ya da kopya ister.
  // "asim" kelime sınırıyla: "Kasım Sayacı" (ay adı) aşım fiyatı sanılmasın.
  { key: 'lastInvoicedPeriod', re: /(son fatura|faturalanan son|last (invoiced|billed)|billed until)/i },
  { key: 'installedAt', re: /((kurulum|teslim|montaj|kuruldugu).*tarih|^kurulum$|^install(ation|ed)?( date| at)?$)/i },
  { key: 'includedColor', re: /^(?!.*(fiyat|ucret|birim|tutar|bedel|price|\btl\b|₺)).*((dahil|kota|included|free).*(renkli|colou?r)|(renkli|colou?r).*(dahil|kota|included|free))/i },
  { key: 'includedBlack', re: /^(?!.*(fiyat|ucret|birim|tutar|bedel|price|\btl\b|₺|renkli|colou?r)).*(dahil.*(sayfa|s\/?b|siyah|mono|kopya|baski|adet)|(sayfa|s\/?b|siyah|mono|kopya|baski).*dahil|^dahil$|kota|included|free pages)/i },
  { key: 'overagePriceColor', re: /((\basim\b|fazla|overage|excess).*(renkli|colou?r)|(renkli|colou?r).*(\basim\b|fazla|overage|excess))/i },
  { key: 'overagePriceBlack', re: /(\basim\b|overage|excess|fazla (sayfa|kopya|baski))/i },
  // KİRA — ölçülmüş hata: eskiden aylık kira kalıbı /(kira|aylik|rent)/ idi
  // ve "Kiralık" kolonunu (evet/hayır) KİRA TUTARI sanıyordu; asıl "Aylık
  // Kira" kolonu boşta kalıyordu. Sonuç: kiralık filo "kiralık değil" ve
  // kirasız aktarılıyordu → kira faturası kesilmiyor, Sayaç Turu'nda yok.
  // İkisi de artık TAM başlık kalıbı (normalleşmiş biçimde: ı→i, küçük
  // harf) ve "Kiralık Cihaz" model kalıbına (/cihaz/) düşmesin diye burada.
  { key: 'isRental', re: /^(kiralik|kiralik mi|kiralik cihaz|kiralik cihaz mi|kirada mi|kirada|kira mi|kira durumu|rental|is rental|rented)\s*\??\s*(\(.*\))?$/i },
  { key: 'monthlyRent', re: /(aylik kira|kira bedeli|kira ucreti|kira tutari|kira fiyati|aylik aidat|^aidat|^kira\s*(\(.*\)|tl|₺)?$|monthly rent|rent amount|^rent\s*(\(.*\))?$)/i },
  // FİYAT, SAYAÇ ve KONUM kalıplarından ÖNCE: sayaç kalıbı /s\/?b/ "S/B
  // Fiyat"ı, konum kalıbı /birim/ "S/B Birim Fiyatı"nı yakalıyordu — sayfa
  // fiyatı sayaç ya da konum kolonuna yazılırdı. Fiyat kalıbı renk + "fiyat/
  // ücret/birim" ister, yani "S/B Sayaç"ı yemez.
  { key: 'pricePerColor', re: /(renkli.*(fiyat|ucret|birim)|(fiyat|birim).*renkli|colou?r.*(price|fiyat))/i },
  { key: 'pricePerBlack', re: /((siyah|s\/?b|mono).*(fiyat|ucret|birim)|(fiyat|birim).*(siyah|s\/?b)|(black|mono).*price|^sayfa (birim )?fiyati?$)/i },
  // Bayi kolona "Ünvan" yazdıysa bu onun beyanı: orada tescilli unvan var.
  // Tahmin etmiyoruz, yazdığını okuyoruz.
  { key: 'legalName', re: /(unvan|ticari ad|tescilli|legal)/i },
  { key: 'customerName', re: /(musteri|firma|cari|isim|ad soyad|adi|customer|company)/i },
  { key: 'phone', re: /(telefon|tel\b|gsm|cep|phone|mobil)/i },
  { key: 'address', re: /(adres|address)/i },
  { key: 'taxNo', re: /(vergi|vkn|tckn|tc no|tax)/i },
  { key: 'serialNo', re: /(seri|serial|s\/?n\b|barkod no)/i },
  { key: 'brand', re: /(marka|brand|uretici|üretici)/i },
  { key: 'model', re: /(model|cihaz|makine|urun|ürün|device)/i },
  { key: 'location', re: /(konum|kat|oda|yer|bolum|bölüm|departman|birim|lokasyon|location)/i },
  { key: 'counterColor', re: /(renkli.*(sayac|sayaç|counter)|(sayac|sayaç|counter).*renkli|color.*count|renkli sayaç)/i },
  { key: 'counterBlack', re: /(siyah|s\/?b\b|mono|black|sayac|sayaç|counter)/i },
];

/** Başlık satırından { kolonIndex -> alan } eşlemesi çıkarır (ilk eşleşen kazanır, aynı alan 2 kez atanmaz) */
export function autoMap(headers: string[]): (FieldKey | null)[] {
  const used = new Set<FieldKey>();
  return headers.map((h) => {
    const clean = (h || '').trim();
    if (!clean) return null;
    for (const p of PATTERNS) {
      if (used.has(p.key)) continue;
      if (p.re.test(basligiNormalle(clean))) { used.add(p.key); return p.key; }
    }
    return null;
  });
}

// ── Değer dönüştürücüler ────────────────────────────────────────────────
/**
 * Türk sayı formatı → number.
 *   "1.234,56" -> 1234.56   (nokta binlik, virgül ondalık)
 *   "108.491"  -> 108491    (SADECE nokta + 3'lü gruplar = BİNLİK ayraç, ondalık DEĞİL)
 *   "0,45"     -> 0.45
 *   "12.5"     -> 12.5      (3'lü grup değil → ondalık nokta, İngilizce format)
 * KRİTİK: "108.491" sayacını 108 okumak faturayı tamamen bozar — bu yüzden 3'lü grup testi var.
 */
export function trNumber(v: string | undefined | null): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[^\d,.\-]/g, '').trim();
  if (!s) return null;

  let norm: string;
  if (s.includes(',') && s.includes('.')) {
    // Her ikisi var: nokta binlik, virgül ondalık
    norm = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // Yalnız virgül: ondalık ayracı
    norm = s.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // Yalnız nokta VE tam 3'lü gruplar → binlik ayracı (TR): "108.491", "1.234.567"
    norm = s.replace(/\./g, '');
  } else {
    // Yalnız nokta ama 3'lü grup değil → ondalık nokta: "12.5", "0.45"
    norm = s;
  }

  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : null;
}

export function trInt(v: string | undefined | null): number | null {
  const n = trNumber(v);
  return n == null ? null : Math.round(n);
}

/** "evet/var/x/1/true/kiralık" -> true */
export function trBool(v: string | undefined | null): boolean {
  const s = (v || '').trim().toLowerCase();
  if (!s) return false;
  return /^(e|evet|var|x|1|true|yes|kiralik|kiralık|kira)$/i.test(s);
}

/** Telefonu normalize et: rakamlar; 90/0 önekleri temizlenip 10 haneye indirilir */
export function normalizePhone(v: string | undefined | null): string {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('0090')) d = d.slice(4);
  else if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return d;
}

// ── Tarih ve dönem ──────────────────────────────────────────────────────
// Bayinin dosyasında tarih her biçimde gelir: "15.03.2021", "03/2021", "Mart
// 2021", "2021", ve xlsx'te tarih hücresi Excel seri numarası olarak ("44270").
// Okunamayan değer TAHMİN EDİLMEZ: null döner, aktarım uyarıda sayar.

const AY_ADLARI: Record<string, number> = {
  ocak: 1, oca: 1, subat: 2, sub: 2, mart: 3, mar: 3, nisan: 4, nis: 4, mayis: 5, may: 5,
  haziran: 6, haz: 6, temmuz: 7, tem: 7, agustos: 8, agu: 8, ags: 8, eylul: 9, eyl: 9,
  ekim: 10, eki: 10, kasim: 11, kas: 11, aralik: 12, ara: 12,
  jan: 1, january: 1, feb: 2, february: 2, march: 3, apr: 4, april: 4, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

type YilAyGun = { yil: number; ay: number; gun: number | null };

/** Excel seri numarası (1900 tabanı) → takvim günü. 20000–80000 arası: 1954–2119. */
function excelSeri(s: string): YilAyGun | null {
  const m = /^(\d{5})(?:[.,]\d+)?$/.exec(s);
  if (!m) return null;
  const seri = Number(m[1]);
  if (seri < 20000 || seri > 80000) return null;
  const d = new Date((seri - 25569) * 86_400_000);
  return { yil: d.getUTCFullYear(), ay: d.getUTCMonth() + 1, gun: d.getUTCDate() };
}

/** Serbest yazılmış tarihi yıl/ay/gün'e ayırır; gün yoksa null (ay ya da yıl hassasiyeti). */
function tarihParcala(v: string | null | undefined): (YilAyGun & { yalnizYil?: boolean }) | null {
  const s = basligiNormalle(String(v ?? '')).replace(/\s+\d{1,2}:\d{2}(:\d{2})?$/, '');
  if (!s) return null;
  const seri = excelSeri(s);
  if (seri) return seri;
  let m: RegExpExecArray | null;
  // 2021-03-15, 2021/03/15, 2021.03.15 (ISO saat eki yukarıda atıldı; "T" ile gelen de)
  if ((m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(t.*)?$/.exec(s))) return { yil: +m[1], ay: +m[2], gun: +m[3] };
  // 15.03.2021, 15/03/2021, 15-03-2021 (Türkiye'de gün önce)
  if ((m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/.exec(s))) return { yil: +m[3], ay: +m[2], gun: +m[1] };
  // 2021-03, 2021/03
  if ((m = /^(\d{4})[-./](\d{1,2})$/.exec(s))) return { yil: +m[1], ay: +m[2], gun: null };
  // 03.2021, 3/2021
  if ((m = /^(\d{1,2})[-./](\d{4})$/.exec(s))) return { yil: +m[2], ay: +m[1], gun: null };
  // 202103 (muhasebe programlarının dönem biçimi)
  if ((m = /^(\d{4})(0[1-9]|1[0-2])$/.exec(s))) return { yil: +m[1], ay: +m[2], gun: null };
  // "mart 2021", "mar.21", "ekim-2026", "march 2021"
  if ((m = /^([a-z]+)\.?[\s\-/']*(\d{2}|\d{4})$/.exec(s)) && AY_ADLARI[m[1]]) {
    const yil = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    return { yil, ay: AY_ADLARI[m[1]], gun: null };
  }
  // "2021 mart"
  if ((m = /^(\d{4})[\s\-/]+([a-z]+)$/.exec(s)) && AY_ADLARI[m[2]]) return { yil: +m[1], ay: AY_ADLARI[m[2]], gun: null };
  // Yalnız yıl
  if ((m = /^(\d{4})$/.exec(s))) return { yil: +m[1], ay: 1, gun: null, yalnizYil: true };
  return null;
}

/** Gerçek bir takvim günü mü (31.02 değil)? */
function gecerliGun(yil: number, ay: number, gun: number): boolean {
  const d = new Date(Date.UTC(yil, ay - 1, gun));
  return d.getUTCFullYear() === yil && d.getUTCMonth() === ay - 1 && d.getUTCDate() === gun;
}

/**
 * Son faturalanan ay → 'YYYY-AA' (Device.lastInvoicedPeriod biçimi).
 * "10.2026", "Ekim 2026", "2026-10", tam tarih ("31.10.2026") ya da Excel seri
 * numarası kabul edilir. Yalnız yıl ("2026") REDDEDİLİR: hangi ayın kirasının
 * kesildiğini söylemez; tahmin edilen ay ya çift kira ya kaçan kira demektir.
 */
export function donemCoz(v: string | null | undefined): string | null {
  const p = tarihParcala(v);
  if (!p || p.yalnizYil) return null;
  if (p.ay < 1 || p.ay > 12 || p.yil < 2000 || p.yil > 2100) return null;
  if (p.gun != null && !gecerliGun(p.yil, p.ay, p.gun)) return null;
  return `${p.yil}-${String(p.ay).padStart(2, '0')}`;
}

export type TarihHassasiyeti = 'DAY' | 'MONTH' | 'YEAR';

/**
 * Kurulum tarihi → gün başı (UTC) + hassasiyet. Cihaz kartındaki "kurulum
 * tarihi" ekranıyla aynı biçim (api/devices/install-date): ay ya da yıl
 * biliniyorsa ayın/yılın 1'i ve hassasiyeti yazılır. 1990'dan önce ya da
 * bugünden sonra olan tarih okunamamış sayılır.
 */
export function kurulumTarihiCoz(v: string | null | undefined, simdi: Date = new Date()): { tarih: Date; hassasiyet: TarihHassasiyeti } | null {
  const p = tarihParcala(v);
  if (!p) return null;
  if (p.ay < 1 || p.ay > 12 || p.yil < 1990) return null;
  if (p.gun != null && !gecerliGun(p.yil, p.ay, p.gun)) return null;
  const tarih = new Date(Date.UTC(p.yil, p.ay - 1, p.gun ?? 1));
  if (tarih.getTime() > simdi.getTime()) return null;
  return { tarih, hassasiyet: p.yalnizYil ? 'YEAR' : p.gun != null ? 'DAY' : 'MONTH' };
}
