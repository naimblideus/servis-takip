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
  | 'isRental' | 'monthlyRent' | 'pricePerBlack' | 'pricePerColor';

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
  { key: 'monthlyRent', re: /(kira|aylik|aylık|rent)/i },
  { key: 'pricePerColor', re: /(renkli.*(fiyat|ucret|ücret|birim)|(fiyat|birim).*renkli)/i },
  { key: 'pricePerBlack', re: /((siyah|s\/?b|mono).*(fiyat|ucret|ücret|birim)|(fiyat|birim).*(siyah|s\/?b))/i },
  { key: 'isRental', re: /(kiralik|kiralık|rental|kira mi|kira mı)/i },
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
