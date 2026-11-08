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
import {
  metniCoz as metniCozBayt, xmlCoz, ayracBul, sayiMetni, metinTablosu, csvTablosu,
  eskiXlsMi, zipMi, MAX_SATIR, MAX_KOLON,
} from '@/lib/tablo-metin';

// Metin okuyucular (HTML, XML 2003, CSV) lib/tablo-metin'de: müşteri/cihaz
// Excel aktarımı aynılarını tarayıcıda kullanıyor. Eski adlar korunuyor.
export { xmlCoz, ayracBul };

export type TabloSonucu =
  | { ok: true; bicim: 'CSV' | 'XLSX' | 'HTML' | 'XML2003'; satirlar: string[][] }
  | { ok: false; hata: 'ESKI_XLS' | 'OKUNAMADI' | 'BOS' };

/** Bayttan metne: BOM'a bak, UTF-8 değilse Windows Türkçe (1254) say. */
export function metniCoz(buf: Buffer): string {
  return metniCozBayt(buf);
}

// ── XLSX ────────────────────────────────────────────────────────────────

/** "BC12" → 54 (0 tabanlı kolon). */
function kolonNo(ref: string): number {
  const harf = (ref.match(/^[A-Z]+/i)?.[0] ?? '').toUpperCase();
  let n = 0;
  for (const h of harf) n = n * 26 + (h.charCodeAt(0) - 64);
  return n - 1;
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

// ── Giriş ───────────────────────────────────────────────────────────────

/** Dosyayı tabloya çevirir. Biçim adından değil İÇERİKTEN anlaşılır. */
export function tabloOku(buf: Buffer): TabloSonucu {
  if (!buf || buf.length === 0) return { ok: false, hata: 'BOS' };

  // Eski ikili Excel (OLE2/BIFF). Tahmin edilmez.
  if (eskiXlsMi(buf)) return { ok: false, hata: 'ESKI_XLS' };

  let satirlar: string[][] | null = null;
  let bicim: 'CSV' | 'XLSX' | 'HTML' | 'XML2003' = 'CSV';

  if (zipMi(buf)) {
    satirlar = xlsxOku(buf);
    bicim = 'XLSX';
    if (!satirlar) return { ok: false, hata: 'OKUNAMADI' };
  } else {
    // HTML tablosu (.xls diye inen) ve XML Elektronik Tablo 2003: lib/tablo-metin.
    const metin = metniCoz(buf);
    const tablo = metinTablosu(metin);
    if (tablo) { satirlar = tablo.satirlar; bicim = tablo.bicim; }
    else { satirlar = csvTablosu(metin); bicim = 'CSV'; }
  }

  const dolu = satirlar.filter((s) => s.some((h) => h !== ''));
  if (!dolu.length) return { ok: false, hata: 'BOS' };
  return { ok: true, bicim, satirlar: dolu };
}
