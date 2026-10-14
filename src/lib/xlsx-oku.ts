// XLSX OKUYUCU — SIFIR BAĞIMLILIK.
//
// NEDEN
// Bayinin elindeki liste neredeyse her zaman .xlsx. "Önce Farklı Kaydet → CSV
// UTF-8 yapın" demek, müşteri listesini hiç aktarmamak demek: o menü çoğu
// kişinin bilmediği bir yerde, eski Excel'de UTF-8 seçeneği bile yok. Bir npm
// paketi (SheetJS vb.) eklemek yerine dosyayı kendimiz açıyoruz, çünkü ihtiyaç
// dar: İLK sayfanın hücre DEĞERLERİ. Biçim, formül, grafik, birleştirilmiş
// hücre umurumuzda değil.
//
// XLSX bir ZIP'tir. İçinden dört dosya yeter:
//   xl/workbook.xml              → sayfaların sırası (ilk görünen sayfa)
//   xl/_rels/workbook.xml.rels   → sayfanın hangi dosyada olduğu
//   xl/sharedStrings.xml         → metin hücrelerinin ortak tablosu
//   xl/worksheets/sheetN.xml     → hücreler
// ZIP'in merkez dizini okunur, girdiler tarayıcının (ve Node 18+'ın) kendi
// DecompressionStream('deflate-raw') ile açılır.
//
// SAYI TUZAĞI (ölçüldü): XLSX'te sayı hücresi "0.125" diye yazılır. Bunu
// olduğu gibi CSV'ye koyup trNumber'a verirsek "0.125" üçlü grup kalıbına
// uyar ve BİNLİK sanılır → 125. Sayfa fiyatı 0,125 ₺ iken 125 ₺ olur. Bu
// yüzden içe aktarma sayı hücrelerini Türk biçimine (ondalık VİRGÜL) çevirir;
// metin hücresine dokunulmaz ("1.234" yazmışsa o bayinin binlik yazımıdır).

export class XlsxHatasi extends Error {
  constructor(public kod: 'ZIP_DEGIL' | 'SAYFA_YOK' | 'SIKISTIRMA' | 'BOZUK', mesaj: string) {
    super(mesaj);
  }
}

// ── ZIP ──────────────────────────────────────────────────────────────────
interface ZipGirdisi { ad: string; yontem: number; sikiBoy: number; acikBoy: number; yerelOfset: number }

function zipDizini(buf: ArrayBuffer): Map<string, ZipGirdisi> {
  const dv = new DataView(buf);
  const boy = buf.byteLength;
  if (boy < 22 || dv.getUint32(0, true) !== 0x04034b50) {
    // .xls (eski ikili biçim) ve parolalı .xlsx CFB kabıdır (D0 CF 11 E0), ZIP değil.
    throw new XlsxHatasi('ZIP_DEGIL', 'Dosya bir XLSX (ZIP) değil');
  }
  // Merkez dizin sonu (EOCD): sondan geriye, en fazla 64 KB yorum payıyla.
  let eocd = -1;
  for (let i = boy - 22; i >= Math.max(0, boy - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new XlsxHatasi('BOZUK', 'ZIP merkez dizini bulunamadı');

  let adet = dv.getUint16(eocd + 10, true);
  let dizinOfset = dv.getUint32(eocd + 16, true);
  // ZIP64: alanlar taşmışsa 64 bitlik kayda bak (bazı yazıcılar her zaman yazar).
  if ((adet === 0xffff || dizinOfset === 0xffffffff) && eocd >= 20 && dv.getUint32(eocd - 20, true) === 0x07064b50) {
    const z64 = Number(dv.getBigUint64(eocd - 20 + 8, true));
    if (z64 + 56 <= boy && dv.getUint32(z64, true) === 0x06064b50) {
      adet = Number(dv.getBigUint64(z64 + 32, true));
      dizinOfset = Number(dv.getBigUint64(z64 + 48, true));
    }
  }

  const ad = new TextDecoder('utf-8');
  const girdiler = new Map<string, ZipGirdisi>();
  let p = dizinOfset;
  for (let n = 0; n < adet; n++) {
    if (p + 46 > boy || dv.getUint32(p, true) !== 0x02014b50) throw new XlsxHatasi('BOZUK', 'ZIP merkez dizini bozuk');
    const yontem = dv.getUint16(p + 10, true);
    let sikiBoy = dv.getUint32(p + 20, true);
    let acikBoy = dv.getUint32(p + 24, true);
    const adBoy = dv.getUint16(p + 28, true);
    const ekBoy = dv.getUint16(p + 30, true);
    const yorumBoy = dv.getUint16(p + 32, true);
    let yerelOfset = dv.getUint32(p + 42, true);
    const dosyaAdi = ad.decode(new Uint8Array(buf, p + 46, adBoy));
    // ZIP64 ek alanı (0x0001): yalnız 0xFFFFFFFF olan alanlar sırayla burada.
    if (acikBoy === 0xffffffff || sikiBoy === 0xffffffff || yerelOfset === 0xffffffff) {
      let e = p + 46 + adBoy;
      const son = e + ekBoy;
      while (e + 4 <= son) {
        const id = dv.getUint16(e, true), uz = dv.getUint16(e + 2, true);
        if (id === 0x0001) {
          let q = e + 4;
          if (acikBoy === 0xffffffff) { acikBoy = Number(dv.getBigUint64(q, true)); q += 8; }
          if (sikiBoy === 0xffffffff) { sikiBoy = Number(dv.getBigUint64(q, true)); q += 8; }
          if (yerelOfset === 0xffffffff) { yerelOfset = Number(dv.getBigUint64(q, true)); }
          break;
        }
        e += 4 + uz;
      }
    }
    girdiler.set(dosyaAdi.replace(/\\/g, '/'), { ad: dosyaAdi, yontem, sikiBoy, acikBoy, yerelOfset });
    p += 46 + adBoy + ekBoy + yorumBoy;
  }
  return girdiler;
}

async function girdiyiAc(buf: ArrayBuffer, g: ZipGirdisi): Promise<Uint8Array> {
  const dv = new DataView(buf);
  const h = g.yerelOfset;
  if (h + 30 > buf.byteLength || dv.getUint32(h, true) !== 0x04034b50) throw new XlsxHatasi('BOZUK', `ZIP girdisi bozuk: ${g.ad}`);
  // Boylar MERKEZ dizinden: yerel başlıkta "veri tanımlayıcısı" bayrağı varsa sıfırdır.
  const veri = h + 30 + dv.getUint16(h + 26, true) + dv.getUint16(h + 28, true);
  const parca = buf.slice(veri, veri + g.sikiBoy);
  if (g.yontem === 0) return new Uint8Array(parca);
  if (g.yontem !== 8) throw new XlsxHatasi('SIKISTIRMA', `Desteklenmeyen sıkıştırma (${g.yontem}): ${g.ad}`);
  const akim = new Blob([parca]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(akim).arrayBuffer());
}

// ── XML yardımcıları ─────────────────────────────────────────────────────
// Ad alanı önekine (x:c, x:row — .NET OpenXML SDK böyle yazar) dayanıklı.
const ONEK = '(?:[A-Za-z_][\\w.-]*:)?';

/** XML varlıkları + Excel'in _xHHHH_ kaçışı (ör. _x000D_ = satır başı). */
export function xmlCoz(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, k: string) => {
      const kk = k.toLowerCase();
      if (kk === 'amp') return '&';
      if (kk === 'lt') return '<';
      if (kk === 'gt') return '>';
      if (kk === 'quot') return '"';
      if (kk === 'apos') return "'";
      const kod = kk.startsWith('#x') ? parseInt(kk.slice(2), 16) : parseInt(kk.slice(1), 10);
      return Number.isFinite(kod) && kod >= 0 && kod <= 0x10ffff ? String.fromCodePoint(kod) : '';
    })
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

function nitelikler(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1]] = m[2] ?? m[3] ?? '';
  return out;
}

/** <si>/<is> içindeki metni topla: düz <t> ya da zengin metin parçaları <r><t>. Fonetik (<rPh>) hariç. */
function metinTopla(ic: string): string {
  const temiz = ic.replace(new RegExp(`<${ONEK}rPh\\b[\\s\\S]*?</${ONEK}rPh>`, 'g'), '');
  let s = '';
  // Nitelik kısmı TEMBEL: açgözlü olsaydı <t xml:space="preserve"/> içindeki
  // "/" niteliğe yenir, ">" sonrası bir SONRAKİ </t>'ye kadar yutulurdu.
  for (const m of temiz.matchAll(new RegExp(`<${ONEK}t(?:\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</${ONEK}t>)`, 'g'))) {
    s += xmlCoz(m[1] ?? '');
  }
  return s;
}

/** "C7" → 2 (0 tabanlı kolon) */
export function kolonNo(ref: string): number {
  const m = /^([A-Za-z]+)/.exec(ref);
  if (!m) return -1;
  let n = 0;
  for (const ch of m[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Sayı hücresinin metni: tam sayı aynen, kesirli 15 anlamlı basamağa (0.30000000000000004 → 0.3). */
function sayiMetni(v: string, ondalikVirgul: boolean): string {
  const n = Number(v);
  if (v.trim() === '' || !Number.isFinite(n)) return v;
  let s = Number.isInteger(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER ? String(n) : String(parseFloat(n.toPrecision(15)));
  if (/e/i.test(s)) {
    // 1e-7 gibi üslü yazım: trNumber "e"yi atar, sayı bozulur → düz ondalığa çevir.
    const f = n.toFixed(Math.min(20, Math.max(0, -Math.floor(Math.log10(Math.abs(n))) + 14)));
    s = f.includes('.') ? f.replace(/0+$/, '').replace(/\.$/, '') : f;
  }
  return ondalikVirgul ? s.replace('.', ',') : s;
}

export interface XlsxSecenek {
  /** Sayı hücrelerinde ondalık ayracı virgül yap (Türk CSV biçimi, trNumber için). */
  ondalikVirgul?: boolean;
}

/**
 * XLSX'in İLK görünen sayfasını satır satır metin olarak döndürür.
 * Boş hücre '' olur, satırlar en geniş satıra kadar doldurulur; tamamen boş
 * satırlar atılır (CSV ayrıştırıcısı da öyle yapıyor).
 */
export async function xlsxOku(buf: ArrayBuffer, secenek: XlsxSecenek = {}): Promise<string[][]> {
  const zip = zipDizini(buf);
  const dc = new TextDecoder('utf-8');
  const oku = async (yol: string): Promise<string | null> => {
    const g = zip.get(yol) ?? [...zip.entries()].find(([k]) => k.toLowerCase() === yol.toLowerCase())?.[1];
    return g ? dc.decode(await girdiyiAc(buf, g)) : null;
  };

  // ── Sayfa yolu: workbook.xml (sıra) + rels (dosya) ──
  const kitap = await oku('xl/workbook.xml');
  const iliski = await oku('xl/_rels/workbook.xml.rels');
  const hedefler = new Map<string, { tur: string; hedef: string }>();
  if (iliski) {
    for (const m of iliski.matchAll(new RegExp(`<${ONEK}Relationship\\b([^>]*)/?>`, 'g'))) {
      const a = nitelikler(m[1]);
      if (a.Id && a.Target) hedefler.set(a.Id, { tur: a.Type || '', hedef: a.Target });
    }
  }
  const yolCoz = (hedef: string) => {
    const t = hedef.replace(/\\/g, '/');
    if (t.startsWith('/')) return t.slice(1);
    const parcalar = ['xl', ...t.split('/')];
    const out: string[] = [];
    for (const p of parcalar) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
    return out.join('/');
  };

  let sayfaYolu: string | null = null;
  if (kitap) {
    const sayfalar = [...kitap.matchAll(new RegExp(`<${ONEK}sheet\\b([^>]*)/?>`, 'g'))].map((m) => nitelikler(m[1]));
    const gorunen = sayfalar.find((a) => !a.state || a.state === 'visible') ?? sayfalar[0];
    if (gorunen) {
      const rid = Object.entries(gorunen).find(([k]) => k === 'r:id' || k.endsWith(':id'))?.[1];
      const h = rid ? hedefler.get(rid) : undefined;
      if (h) sayfaYolu = yolCoz(h.hedef);
    }
  }
  if (!sayfaYolu || !zip.has(sayfaYolu)) {
    // Yedek: numarası en küçük worksheets/sheetN.xml
    const aday = [...zip.keys()]
      .map((k) => ({ k, n: /^xl\/worksheets\/sheet(\d+)\.xml$/i.exec(k) }))
      .filter((x) => x.n)
      .sort((a, b) => Number(a.n![1]) - Number(b.n![1]))[0];
    sayfaYolu = aday?.k ?? null;
  }
  if (!sayfaYolu) throw new XlsxHatasi('SAYFA_YOK', 'Dosyada çalışma sayfası yok');

  // ── Ortak metin tablosu ──
  const ssHedef = [...hedefler.values()].find((h) => /\/sharedStrings$/i.test(h.tur));
  const ssXml = await oku(ssHedef ? yolCoz(ssHedef.hedef) : 'xl/sharedStrings.xml');
  const ortak: string[] = [];
  if (ssXml) {
    for (const m of ssXml.matchAll(new RegExp(`<${ONEK}si\\b[^>]*?(?:/>|>([\\s\\S]*?)</${ONEK}si>)`, 'g'))) {
      ortak.push(metinTopla(m[1] ?? ''));
    }
  }

  // ── Hücreler ──
  const sayfa = await oku(sayfaYolu);
  if (sayfa == null) throw new XlsxHatasi('SAYFA_YOK', 'Çalışma sayfası okunamadı');
  const virgul = !!secenek.ondalikVirgul;
  // SEYREK tutuluyor: biçimlenmiş ama boş bir hücre (ör. r="XFD1", 16.384.
  // kolon) ya da sayfanın en altındaki biçimli satır (r="1048576") dizi
  // olarak doldurulsaydı her satır 16 bin kolon, dosya 1 milyon satır olurdu.
  // Yalnız DEĞERİ olan hücre yer kaplar; genişlik en sağdaki dolu hücredir.
  const seyrek = new Map<number, Map<number, string>>();
  const satirRe = new RegExp(`<${ONEK}row\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${ONEK}row>)`, 'g');
  const hucreRe = new RegExp(`<${ONEK}c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${ONEK}c>)`, 'g');
  const degerRe = new RegExp(`<${ONEK}v(?:\\s[^>]*)?>([\\s\\S]*?)</${ONEK}v>`);
  const satirIciRe = new RegExp(`<${ONEK}is\\b[^>]*>([\\s\\S]*?)</${ONEK}is>`);
  let sonrakiSatir = 0;
  for (const sm of sayfa.matchAll(satirRe)) {
    const sa = nitelikler(sm[1]);
    const r = sa.r ? parseInt(sa.r, 10) - 1 : sonrakiSatir;
    sonrakiSatir = r + 1;
    const satir = seyrek.get(r) ?? new Map<number, string>();
    let sonrakiKolon = 0;
    for (const hm of (sm[2] ?? '').matchAll(hucreRe)) {
      const a = nitelikler(hm[1]);
      const ic = hm[2] ?? '';
      const k = a.r ? kolonNo(a.r) : sonrakiKolon;
      if (k < 0) continue;
      sonrakiKolon = k + 1;
      const ham = degerRe.exec(ic)?.[1];
      let deger = '';
      switch (a.t) {
        case 's': { const i = ham != null ? parseInt(ham, 10) : NaN; deger = Number.isInteger(i) ? (ortak[i] ?? '') : ''; break; }
        case 'inlineStr': { const is = satirIciRe.exec(ic); deger = is ? metinTopla(is[1]) : ''; break; }
        case 'str': deger = ham != null ? xmlCoz(ham) : ''; break;
        case 'b': deger = ham == null ? '' : ham.trim() === '1' ? 'TRUE' : 'FALSE'; break;
        case 'e': deger = ''; break; // #N/A, #DIV/0! — veri değil
        case 'd': deger = ham != null ? xmlCoz(ham) : ''; break;
        default: deger = ham != null ? sayiMetni(xmlCoz(ham), virgul) : '';
      }
      if (deger.trim() !== '') satir.set(k, deger);
    }
    if (satir.size) seyrek.set(r, satir);
  }

  const sira = [...seyrek.keys()].sort((x, y) => x - y);
  let genislik = 0;
  for (const r of sira) for (const k of seyrek.get(r)!.keys()) genislik = Math.max(genislik, k + 1);
  return sira.map((r) => {
    const hucre = seyrek.get(r)!;
    return Array.from({ length: genislik }, (_, k) => hucre.get(k) ?? '');
  });
}

/** Satırları içe aktarmanın beklediği CSV metnine çevir (noktalı virgül, gerekirse tırnak). */
export function satirlarCsv(satirlar: string[][], ayrac = ';'): string {
  const alan = (v: string) => (v.includes(ayrac) || v.includes('"') || /[\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return satirlar.map((s) => s.map(alan).join(ayrac)).join('\n');
}
