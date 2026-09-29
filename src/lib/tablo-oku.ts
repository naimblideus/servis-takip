// TABLO DOSYASI OKUYUCU — banka ekstresi gibi "bayinin elindeki dosya"yı
// satır/hücre tablosuna çevirir.
//
// NEDEN: Bankalar hesap hareketlerini tek bir biçimde vermiyor. Aynı ay
// içinde bir bayinin elinde .xlsx (yeni Excel), .xls (çoğu zaman aslında
// HTML tablosu ya da "XML Elektronik Tablo 2003"), noktalı virgüllü CSV ve
// Windows Türkçe kod sayfasında (1254) kaydedilmiş metin olabiliyor. Bayiye
// "önce Excel'de CSV UTF-8 olarak kaydet" demek her ay tekrarlanan bir
// sürtünme; dosya olduğu gibi okunuyor.
//
// Paket eklenmedi: .xlsx bir ZIP içinde XML'dir, ZIP okuyucu zaten var
// (lib/ek-dosya) ve Node'un zlib'i yetiyor. Gerçek eski ikili .xls (BIFF)
// OKUNMAZ — onu tahmin etmek yerine açık bir hata dönüyor.
//
// Bu dosya yalnız OKUR: kolonların ne anlama geldiğine karar vermez.

import { zipAc } from '@/lib/ek-dosya';
import { parseCSV } from '@/lib/sheet-import';

export type TabloSonucu =
  | { ok: true; bicim: 'CSV' | 'XLSX' | 'HTML' | 'XML2003'; satirlar: string[][] }
  | { ok: false; hata: 'ESKI_XLS' | 'OKUNAMADI' | 'BOS' };

const MAX_SATIR = 20_000;
const MAX_KOLON = 60;

// ── Metin çözme ─────────────────────────────────────────────────────────

/** Bayttan metne: BOM'a bak, UTF-8 değilse Windows Türkçe (1254) say. */
export function metniCoz(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    // Türk bankalarının "metin" dışa aktarımı çoğunlukla 1254'tür: ş/ğ/ı/İ
    // UTF-8'de geçersiz bayt dizisi verir, 1254 olarak doğru çözülür.
    return new TextDecoder('windows-1254').decode(buf);
  }
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

// ── CSV ─────────────────────────────────────────────────────────────────

/**
 * Ayraç tespiti — ÇOK SATIRA bakarak. Banka CSV'leri tablodan önce "Hesap
 * No: …" gibi ayraçsız başlık satırlarıyla başlıyor; yalnız ilk satıra
 * bakan tespit bu dosyalarda yanlış ayraç seçiyordu. Doğru ayraç veri
 * satırlarının HEPSİNDE aynı sayıda geçer: en çok satırda aynı sayıyla
 * görünen aday kazanır. Tutardaki virgül ("1.234,56") bu yüzden ayraç
 * sanılmıyor — satırdan satıra sayısı değişiyor ya da ayraçtan az.
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

// ── XLSX ────────────────────────────────────────────────────────────────

/** "BC12" → 54 (0 tabanlı kolon). */
function kolonNo(ref: string): number {
  const harf = (ref.match(/^[A-Z]+/i)?.[0] ?? '').toUpperCase();
  let n = 0;
  for (const h of harf) n = n * 26 + (h.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Sayı hücresini metne. Ondalık ayraç VİRGÜL yazılıyor: satırı okuyan taraf
 * Türk yazımını bekliyor ve "1234.567" gibi bir değer noktayla yazılsaydı
 * binlik ayracı sanılabilirdi. Virgülle yazılınca belirsizlik yok.
 */
function sayiMetni(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

function xlsxOku(buf: Buffer): string[][] | null {
  const dosyalar = new Map(zipAc(buf).map((d) => [d.ad.replace(/^\/+/, ''), d.icerik]));
  if (!dosyalar.size) return null;
  const metin = (ad: string) => dosyalar.get(ad)?.toString('utf8') ?? null;

  // İlk sayfanın yolu: çalışma kitabındaki SIRAYA göre. Bulunamazsa
  // alfabetik ilk sayfa.
  let sayfaYolu: string | null = null;
  const kitap = metin('xl/workbook.xml');
  const iliskiler = metin('xl/_rels/workbook.xml.rels');
  if (kitap && iliskiler) {
    const ilkSayfa = kitap.match(/<sheet\b[^>]*\br:id="([^"]+)"/i)?.[1];
    if (ilkSayfa) {
      const re = new RegExp(`<Relationship\\b[^>]*\\bId="${ilkSayfa.replace(/[^\w-]/g, '')}"[^>]*>`, 'i');
      const hedef = iliskiler.match(re)?.[0].match(/\bTarget="([^"]+)"/i)?.[1];
      if (hedef) sayfaYolu = hedef.startsWith('/') ? hedef.slice(1) : `xl/${hedef.replace(/^\.\//, '')}`;
    }
  }
  if (!sayfaYolu || !dosyalar.has(sayfaYolu)) {
    sayfaYolu = [...dosyalar.keys()].filter((a) => /^xl\/worksheets\/[^/]+\.xml$/i.test(a)).sort()[0] ?? null;
  }
  const sayfa = sayfaYolu ? metin(sayfaYolu) : null;
  if (!sayfa) return null;

  // Paylaşılan metinler: bir <si> birden çok biçimli parça (<r><t>) içerebilir.
  const paylasilan: string[] = [];
  const ss = metin('xl/sharedStrings.xml');
  if (ss) {
    for (const si of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)) {
      // Okunuş kılavuzu (<rPh>) metne katılmaz.
      const govde = si[1].replace(/<rPh\b[\s\S]*?<\/rPh>/gi, '');
      const parcalar = [...govde.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((m) => m[1]);
      paylasilan.push(xmlCoz(parcalar.join('')));
    }
  }

  const satirlar: string[][] = [];
  for (const r of sayfa.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)) {
    if (satirlar.length >= MAX_SATIR) break;
    const satir: string[] = [];
    let sira = 0;
    for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi)) {
      const nit = c[1];
      const ic = c[2] ?? '';
      const ref = nit.match(/\br="([A-Z]+)\d+"/i)?.[1];
      const kolon = ref ? kolonNo(ref) : sira;
      sira = kolon + 1;
      if (kolon >= MAX_KOLON) continue;
      const tur = nit.match(/\bt="([^"]+)"/i)?.[1] ?? 'n';
      let deger = '';
      if (tur === 'inlineStr') {
        deger = xmlCoz([...ic.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((m) => m[1]).join(''));
      } else {
        const v = ic.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? '';
        if (tur === 's') deger = paylasilan[Number(v)] ?? '';
        else if (tur === 'str' || tur === 'e') deger = xmlCoz(v);
        else if (tur === 'b') deger = v === '1' ? 'TRUE' : 'FALSE';
        else deger = v === '' ? '' : sayiMetni(v);
      }
      while (satir.length < kolon) satir.push('');
      satir[kolon] = deger.trim();
    }
    satirlar.push(satir);
  }
  return satirlar;
}

// ── HTML tablosu (.xls diye inen) ve XML Elektronik Tablo 2003 ──────────

function htmlOku(metin: string): string[][] {
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

function xml2003Oku(metin: string): string[][] {
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

// ── Giriş ───────────────────────────────────────────────────────────────

/** Dosyayı tabloya çevirir. Biçim adından değil İÇERİKTEN anlaşılır. */
export function tabloOku(buf: Buffer): TabloSonucu {
  if (!buf || buf.length === 0) return { ok: false, hata: 'BOS' };

  // Eski ikili Excel (OLE2/BIFF). Tahmin edilmez.
  if (buf.length >= 8 && buf.readUInt32LE(0) === 0xe011cfd0 && buf.readUInt32LE(4) === 0xe11ab1a1) {
    return { ok: false, hata: 'ESKI_XLS' };
  }

  let satirlar: string[][] | null = null;
  let bicim: 'CSV' | 'XLSX' | 'HTML' | 'XML2003' = 'CSV';

  if (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50) {
    satirlar = xlsxOku(buf);
    bicim = 'XLSX';
    if (!satirlar) return { ok: false, hata: 'OKUNAMADI' };
  } else {
    const metin = metniCoz(buf);
    const bas = metin.slice(0, 4000);
    if (/urn:schemas-microsoft-com:office:spreadsheet/i.test(bas) && /<(?:ss:)?Workbook\b/i.test(bas)) {
      satirlar = xml2003Oku(metin);
      bicim = 'XML2003';
    } else if (/<table\b/i.test(metin) && /<t[dh]\b/i.test(metin)) {
      satirlar = htmlOku(metin);
      bicim = 'HTML';
    } else {
      satirlar = parseCSV(metin, ayracBul(metin)).slice(0, MAX_SATIR).map((s) => s.slice(0, MAX_KOLON).map((h) => h.trim()));
      bicim = 'CSV';
    }
  }

  const dolu = satirlar.filter((s) => s.some((h) => h !== ''));
  if (!dolu.length) return { ok: false, hata: 'BOS' };
  return { ok: true, bicim, satirlar: dolu };
}
