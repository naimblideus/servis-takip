/**
 * CİHAZIN KENDİ GÖNDERDİĞİ SAYAÇ E-POSTASINI OKUMA
 *
 * Çoğu çok fonksiyonlu cihaz (Canon, Konica, Kyocera, Ricoh, Xerox…) ayın belirli
 * bir günü sayaç raporunu e-postayla gönderecek şekilde ayarlanabiliyor. Bu dosya
 * o e-postayı okuyup hangi cihaz ve hangi sayaç olduğunu çıkarır.
 *
 * ── TASARIM KARARI: marka formatı TAHMİN EDİLMEZ ──────────────────────────────
 * Her üreticinin e-posta biçimi farklı ve zamanla değişiyor. "Serial Number:" gibi
 * kalıpları markaya göre yazmak kırılgan olurdu. Bunun yerine TERS EŞLEŞTİRME
 * yapılıyor: veritabanındaki seri numaraları e-posta metninde ARANIYOR. Bu yaklaşım
 * biçimden bağımsızdır — cihaz seri numarasını nasıl yazarsa yazsın bulunur.
 *
 * ── SAYAÇ ÇIKARIMINDA UYDURMA YOK ────────────────────────────────────────────
 * Sayaç güvenle bulunamazsa null döner ve e-posta İNCELEME KUYRUĞUNA düşer.
 * Yanlış okunan tek bir sayaç yanlış fatura demektir; tahmin etmek, hiç okumamaktan
 * kötüdür. (Fotoğraftan OCR'ı da aynı sebeple yapmıyoruz.)
 */

/** HTML e-postayı düz metne indirger; etiketler kaybolurken sayılar arası boşluk korunur. */
export function htmlToText(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(tr|p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')          // hücre sınırı korunsun, sayılar birleşmesin
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ');
}

/** Türkçe-duyarlı küçültme (I/ı sorunu) + aksan sadeleştirme. */
function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
}

/**
 * Metinde geçen BİLİNEN seri numarasını bul.
 * Uzun seriler önce denenir: kısa bir seri, uzun bir serinin içinde geçebilir
 * ("AB12" ile "XAB123" karışmasın diye en uzun eşleşme kazanır).
 */
export function findSerial(text: string, knownSerials: string[]): string | null {
  const t = fold(text).replace(/[\s\-_.]/g, '');
  const sorted = [...knownSerials].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const s of sorted) {
    const norm = fold(s).replace(/[\s\-_.]/g, '');
    if (norm.length >= 4 && t.includes(norm)) return s;
  }
  return null;
}

const SIYAH = ['siyah', 'black', 'mono', 'monochrome', 'b&w', 'bw', 'blackwhite', 'toplam', 'total'];
const RENKLI = ['renkli', 'color', 'colour', 'fullcolor', 'fullcolour'];

/** "1.234.567" / "1,234,567" / "1 234 567" → 1234567. Ondalık AYIRICI BEKLENMİYOR: sayaçlar tam sayıdır. */
function toInt(raw: string): number | null {
  const d = raw.replace(/[^\d]/g, '');
  if (!d || d.length > 9) return null;      // 9 haneden uzun sayaç gerçekçi değil
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

export interface CounterParse {
  black: number | null;
  color: number | null;
  /** Hangi etiketten okunduğu — incelemede "doğru yeri mi okumuş" diye bakılır. */
  blackLabel?: string;
  colorLabel?: string;
}

/**
 * Etiketli sayıları çıkar. Bir anahtar kelimeden sonraki İLK sayı alınır; araya en
 * fazla 40 karakter girebilir (tablo hücreleri, iki nokta, boşluk).
 *
 * Aynı anahtar birden fazla geçerse EN BÜYÜK değer alınır: cihazlar genelde hem
 * "bu ay" hem "toplam" yazar, faturalama için gereken kümülatif TOPLAM olandır.
 */
export function parseCounters(text: string): CounterParse {
  const t = fold(text);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /**
   * Bir anahtar kelimeden sonraki AYNI SATIRDA yer alan sayılardan EN BÜYÜĞÜ.
   *
   * Neden "sonraki ilk sayı" değil: cihazlar "Total 1: 145.230" gibi sayacın
   * SIRA NUMARASINI önce yazıyor. İlk sayıyı alsaydık 145.230 yerine 1 okurduk.
   * Neden en büyük: aynı satırda hem "bu ay" hem "toplam" geçebiliyor; faturalama
   * kümülatif toplamı ister.
   *
   * disallowPrefix: siyah aranırken "Color Total" gibi ifadelerin siyah sanılmaması
   * için, eşleşmenin hemen ÖNCESİNDEKİ 15 karakterde renk kelimesi varsa atlanır.
   */
  const pick = (keys: string[], disallowPrefix: string[] = []): { value: number | null; label?: string } => {
    let best: number | null = null;
    let bestLabel: string | undefined;
    for (const k of keys) {
      const re = new RegExp(esc(k), 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) {
        const onek = t.slice(Math.max(0, m.index - 15), m.index);
        if (disallowPrefix.some((p) => onek.includes(p))) continue;

        // Aynı satırda, anahtardan sonraki en fazla 40 karakter
        const kuyruk = t.slice(m.index + k.length, m.index + k.length + 40).split('\n')[0];
        for (const sayi of kuyruk.match(/\d[\d.,\s]*/g) ?? []) {
          const n = toInt(sayi);
          if (n !== null && (best === null || n > best)) { best = n; bestLabel = k; }
        }
      }
    }
    return { value: best, label: bestLabel };
  };

  const c = pick(RENKLI);
  const b = pick(SIYAH, RENKLI); // "color total" siyah sayılmasın
  return { black: b.value, color: c.value, blackLabel: b.label, colorLabel: c.label };
}

export interface EmailReading {
  serial: string | null;
  black: number | null;
  color: number | null;
  /** Otomatik işlenebilir mi? Seri VE siyah sayaç bulunmuşsa evet. */
  guvenli: boolean;
  sebep?: string;
}

/**
 * E-postayı okumaya çevir. Karar kuralı bilinçli olarak KATI:
 * seri numarası bulunamadıysa ya da siyah sayaç okunamadıysa otomatik işlenmez.
 * Renkli sayacın olmaması sorun değil — siyah-beyaz cihazlar var.
 */
export function parseCounterEmail(
  rawBody: string,
  knownSerials: string[],
  subject = '',
): EmailReading {
  const text = htmlToText(subject + '\n' + rawBody);
  const serial = findSerial(text, knownSerials);
  const { black, color } = parseCounters(text);

  if (!serial) return { serial: null, black, color, guvenli: false, sebep: 'Seri numarası eşleşmedi' };
  if (black === null) return { serial, black, color, guvenli: false, sebep: 'Siyah sayaç okunamadı' };
  return { serial, black, color, guvenli: true };
}
