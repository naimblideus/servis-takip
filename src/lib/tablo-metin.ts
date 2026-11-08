// TABLO METNİ — ".xls" diye inen HTML tablosu ve "XML Elektronik Tablo 2003"
// dosyalarını satır/hücre tablosuna çevirir. Tarayıcıda da sunucuda da çalışır
// (Node'a özgü hiçbir şey yok).
//
// NEDEN AYRI DOSYA: banka ekstresi bu okuyucuyu yıllardır sunucuda kullanıyor
// (lib/tablo-oku). Müşteri/cihaz Excel aktarımı ise dosyayı tarayıcıda okuyor
// ve eski programların ".xls" dökümlerini "desteklenmiyor" diye reddediyordu.
// Oysa bu dökümlerin çoğu gerçek eski Excel değil, HTML ya da XML 2003.
// Gerçek eski ikili .xls (BIFF) OKUNMAZ; tanınır ve açık hata verilir.

import { parseCSV } from '@/lib/sheet-import';

export const MAX_SATIR = 20_000;
export const MAX_KOLON = 60;

/** Bayttan metne: BOM'a bak, UTF-8 değilse Windows Türkçe (1254) say. */
export function metniCoz(buf: Uint8Array): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return new TextDecoder('utf-8').decode(buf.subarray(3));
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    // Türk programlarının "metin" dışa aktarımı çoğunlukla 1254'tür: ş/ğ/ı/İ
    // UTF-8'de geçersiz bayt dizisi verir, 1254 olarak doğru çözülür.
    return new TextDecoder('windows-1254').decode(buf);
  }
}

/** Gerçek eski ikili Excel (OLE2/BIFF): D0 CF 11 E0 A1 B1 1A E1. */
export function eskiXlsMi(buf: Uint8Array): boolean {
  const imza = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return buf.length >= 8 && imza.every((b, i) => buf[i] === b);
}

/** ZIP (yani .xlsx): 50 4B 03 04. */
export function zipMi(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

const VARLIK: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function xmlCoz(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tam, v: string) => {
    if (v[0] === '#') {
      const kod = v[1] === 'x' || v[1] === 'X' ? parseInt(v.slice(2), 16) : parseInt(v.slice(1), 10);
      return Number.isFinite(kod) ? String.fromCodePoint(kod) : tam;
    }
    return VARLIK[v.toLowerCase()] ?? tam;
  });
}

/** HTML/XML hücre içeriğini düz metne: etiketler atılır, boşluk sadeleşir. */
function hucreMetni(ic: string): string {
  return xmlCoz(ic.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/**
 * Ayraç tespiti — ÇOK SATIRA bakarak. Dosyalar tablodan önce "Hesap No: …"
 * gibi ayraçsız başlık satırlarıyla başlıyor; yalnız ilk satıra bakan tespit
 * bu dosyalarda yanlış ayraç seçiyordu. Doğru ayraç veri satırlarının HEPSİNDE
 * aynı sayıda geçer: en çok satırda aynı sayıyla görünen aday kazanır.
 * Tutardaki virgül ("1.234,56") bu yüzden ayraç sanılmıyor.
 */
export function ayracBul(metin: string): string {
  const satirlar = metin.split(/\r?\n/).filter((s) => s.trim()).slice(0, 60);
  let enIyi = ';', enIyiSkor = -1;
  for (const aday of [';', '\t', ',', '|']) {
    const sayim = new Map<number, number>();
    for (const s of satirlar) {
      let n = 0, tirnak = false;
      for (const ch of s) {
        if (ch === '"') tirnak = !tirnak;
        else if (!tirnak && ch === aday) n++;
      }
      if (n > 0) sayim.set(n, (sayim.get(n) ?? 0) + 1);
    }
    const skor = Math.max(0, ...sayim.values());
    if (skor > enIyiSkor) { enIyi = aday; enIyiSkor = skor; }
  }
  return enIyi;
}

/**
 * Sayı hücresini metne. Ondalık ayraç VİRGÜL yazılıyor: satırı okuyan taraf
 * Türk yazımını bekliyor ve "1234.567" gibi bir değer noktayla yazılsaydı
 * binlik ayracı sanılabilirdi. Virgülle yazılınca belirsizlik yok.
 */
export function sayiMetni(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

export function htmlOku(metin: string): string[][] {
  const satirlar: string[][] = [];
  for (const tr of metin.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    if (satirlar.length >= MAX_SATIR) break;
    const satir: string[] = [];
    for (const td of tr[1].matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
      satir.push(hucreMetni(td[3]));
      // colspan'lı hücre sağındaki kolonları kaydırmasın
      const yay = Number(td[2].match(/\bcolspan="?(\d+)/i)?.[1] ?? 1);
      for (let i = 1; i < Math.min(yay, MAX_KOLON); i++) satir.push('');
      if (satir.length >= MAX_KOLON) break;
    }
    satirlar.push(satir);
  }
  return satirlar;
}

export function xml2003Oku(metin: string): string[][] {
  const tablo = metin.match(/<(?:ss:)?Table\b[\s\S]*?<\/(?:ss:)?Table>/i)?.[0] ?? metin;
  const satirlar: string[][] = [];
  for (const r of tablo.matchAll(/<(?:ss:)?Row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:ss:)?Row>)/gi)) {
    if (satirlar.length >= MAX_SATIR) break;
    const satir: string[] = [];
    for (const c of (r[1] ?? '').matchAll(/<(?:ss:)?Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:ss:)?Cell>)/gi)) {
      const indeks = Number(c[1].match(/\bss:Index="(\d+)"/i)?.[1] ?? 0);
      if (indeks > 0) while (satir.length < indeks - 1) satir.push('');
      if (satir.length >= MAX_KOLON) break;
      const veri = (c[2] ?? '').match(/<(?:ss:)?Data\b([^>]*)>([\s\S]*?)<\/(?:ss:)?Data>/i);
      const tur = veri?.[1].match(/\bss:Type="([^"]+)"/i)?.[1];
      const deger = veri ? hucreMetni(veri[2]) : '';
      satir.push(tur === 'Number' ? sayiMetni(deger) : deger);
    }
    satirlar.push(satir);
  }
  return satirlar;
}

/**
 * Metin bir HTML tablosu ya da XML 2003 elektronik tablosuysa satırları;
 * değilse null (düz CSV/metin: çağıran kendi CSV yolundan okur).
 */
export function metinTablosu(metin: string): { bicim: 'HTML' | 'XML2003'; satirlar: string[][] } | null {
  const bas = metin.slice(0, 4000);
  if (/urn:schemas-microsoft-com:office:spreadsheet/i.test(bas) && /<(?:ss:)?Workbook\b/i.test(bas)) {
    return { bicim: 'XML2003', satirlar: xml2003Oku(metin) };
  }
  if (/<table\b/i.test(metin) && /<t[dh]\b/i.test(metin)) return { bicim: 'HTML', satirlar: htmlOku(metin) };
  return null;
}

/** Düz CSV/metni tabloya (ayraç kendiliğinden bulunur). */
export function csvTablosu(metin: string): string[][] {
  return parseCSV(metin, ayracBul(metin)).slice(0, MAX_SATIR).map((s) => s.slice(0, MAX_KOLON).map((h) => h.trim()));
}
