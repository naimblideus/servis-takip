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
    // SEKME KORUNUR: yukarıda </td> yerine bilerek sekme konuyor, hücre sınırı
    // odur. Eskiden sekmeler de tek boşluğa indiriliyordu ve TABLO YAPISI
    // KAYBOLUYORDU — çok cihazlı raporda sütun okunamıyordu.
    .replace(/ +/g, ' ');
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

// SİYAH etiketleri İKİ KADEMELİ, ve bu sıra faturayı belirliyor.
//
// ÖZEL kademe, cihazın "bu sayaç siyahtır" dediği yerdir. GENEL kademe yalnız
// "toplam" der — renkli cihazda o toplam siyah + renklinin TAMAMIDIR. Tek
// listede toplayıp en büyüğü alan eski mantık şu raporda:
//     Total 100000 · Black 70000 · Full Color 30000
// siyahı 100.000 okuyordu; 30.000 renkli sayfa siyah tarifesinden DE
// faturalanırdı. Artık önce ÖZEL aranır, ancak o boş çıkarsa GENEL'e düşülür
// (mono cihazda yalnız "Total" bulunur; orada doğru davranış budur).
// Yazım varyantları ayrı ayrı yazılmak zorunda: fold() noktalama silmiyor,
// yani 'bw' girdisi 'b/w' metnini yakalamaz. Brother 'B/W', Türkçe arayüzler
// 'S/B' yazıyor — biri eksik kalırsa o marka sessizce kuyruğa düşer.
const SIYAH_OZEL = ['siyah', 'black', 'mono', 'monochrome', 'monokrom', 'b&w', 'b/w', 'bw', 's/b', 'blackwhite'];
const SIYAH_GENEL = ['toplam', 'total'];
const RENKLI = ['renkli', 'color', 'colour', 'fullcolor', 'fullcolour'];

// Bölüm başlıkları. Kyocera raporunda "Scanned Pages" altında da "Total" var
// ve tarama sayısı yazdırmayı geçebiliyor — en büyüğü alan mantık TARAMAYI
// faturalıyordu. Artık eşleşmenin hangi bölümde olduğuna bakılıyor.
const BOLUM_TARAMA = ['scanned page', 'taranan sayfa', 'tarama sayac'];
const BOLUM_DIGER = ['printed page', 'yazdirilan', 'basilan sayfa', 'counters by', 'total counter'];

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
  // Sekme hücre sınırıdır; sayı taramasında iki hücrenin sayısı birleşmesin
  // diye ayırıcıya çevriliyor — "145.230⇥22.410" tek sayı sanılırdı.
  const t = fold(text).replace(/\t/g, ' | ');
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

  /** Eşleşme TARAMA bölümünde mi — en yakın önceki bölüm başlığına bakılır. */
  const taramaBolumunde = (idx: number): boolean => {
    const onceki = t.slice(0, idx);
    const enYakin = (kelimeler: string[]) =>
      kelimeler.reduce((en, k) => Math.max(en, onceki.lastIndexOf(k)), -1);
    // Yalnız EN YAKIN başlık belirleyici: "Scanned Pages"tan sonra gelen
    // "Counters by Duplex" bölümü artık tarama değildir, oradaki toplam sayılır.
    return enYakin(BOLUM_TARAMA) > enYakin(BOLUM_DIGER);
  };

  const pick = (keys: string[], disallowPrefix: string[] = []): { value: number | null; label?: string } => {
    let best: number | null = null;
    let bestLabel: string | undefined;
    for (const k of keys) {
      const re = new RegExp(esc(k), 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) {
        const onek = t.slice(Math.max(0, m.index - 15), m.index);
        if (disallowPrefix.some((p) => onek.includes(p))) continue;
        if (taramaBolumunde(m.index)) continue;

        // Aynı satırda, anahtardan sonraki en fazla 40 karakter
        const kuyruk = t.slice(m.index + k.length, m.index + k.length + 40).split('\n')[0];
        const sayiRe = /\d[\d.,\s]*/g;
        let s: RegExpExecArray | null;
        while ((s = sayiRe.exec(kuyruk)) !== null) {
          // YÜZDE SAYAÇ DEĞİLDİR. Kyocera raporunun sonunda "black: 53%" var —
          // bu toner seviyesi. Sayaç sanılırsa cihazın sayacı 53'e düşmüş
          // görünür; bir sonraki gerçek okumada "sayaç geriledi" alarmı çalar
          // ve bayi sebebini bulamaz.
          const sonrasi = kuyruk.slice(s.index + s[0].length).trimStart();
          if (sonrasi.startsWith('%')) continue;

          const n = toInt(s[0]);
          if (n !== null && (best === null || n > best)) { best = n; bestLabel = k; }
        }
      }
    }
    return { value: best, label: bestLabel };
  };

  const c = pick(RENKLI);
  // Önce cihazın "siyah" dediği sayaç; yoksa genel toplam. Sırayı bozma —
  // gerekçesi SIYAH_OZEL/SIYAH_GENEL tanımlarının başında.
  const ozel = pick(SIYAH_OZEL, RENKLI);
  const b = ozel.value !== null ? ozel : pick(SIYAH_GENEL, RENKLI);
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

/* ══════════════════════════════════════════════════════════════════════════
   ÇOK CİHAZLI E-POSTA — filo raporu
   ══════════════════════════════════════════════════════════════════════════
   Onlarca makinesi olan bir firmada cihazlar tek tek e-posta atmaz; filo
   yönetim yazılımı TEK bir e-postada hepsinin sayacını tablo hâlinde gönderir.

   Tek-cihaz okuyucusunu böyle bir e-postaya uygulamak SESSİZ BİR PARA
   HATASIDIR: findSerial ilk eşleşen seriyi döndürür, parseCounters ise TÜM
   belgedeki en büyük sayıyı alır. 200 cihazlık raporun en büyük sayacı
   rastgele bir cihaza faturalanır.

   ── İKİ FARKLI YERLEŞİM, İKİ FARKLI STRATEJİ ─────────────────────────────
   A) BLOK: her cihaz için ayrı bir paragraf, etiketler cihazın yanında
        Serial: ABC123   Total: 145230   Color: 22410
      → Etiket tabanlı okuma (parseCounters) cihazın KENDİ bölgesinde çalışır.

   B) TABLO: etiketler BAŞLIK satırında, cihaz satırında yalnız sayılar
        Seri No     Model          Siyah     Renkli
        ABC12345    Canon iR2530   145.230   22.410
      → Etiket cihaz satırında YOK. Başlık satırındaki sütun sırası bulunur,
        cihaz satırındaki değer o SÜTUNDAN alınır.

   ── SÜTUN TAHMİNİ YAPILMAZ ───────────────────────────────────────────────
   Tablo yerleşiminde "satırdaki ilk sayıyı al" demek cazip ama YANLIŞ: model
   adları rakam içerir (iR2530, M2540). Başlık bulunamazsa okuma yapılmaz,
   kayıt kuyruğa düşer. Tahmin etmektense elle incelensin.
   ═══════════════════════════════════════════════════════════════════════ */

export interface CihazOkumasi {
  serial: string;
  black: number | null;
  color: number | null;
  guvenli: boolean;
  sebep?: string;
}

export interface CokluSonuc {
  okumalar: CihazOkumasi[];
  /** Metinde hiç bilinen seri bulunamadı */
  seriYok: boolean;
  cihazSayisi: number;
  /** Hangi strateji işe yaradı — incelemede "doğru yeri mi okumuş" için */
  yerlesim: 'blok' | 'tablo' | 'yok';
}

/** Seriyi ayırıcılara toleranslı arayan regex: "KM-4471" ⇔ "KM 4471" ⇔ "KM4471". */
function seriRegex(serial: string): RegExp {
  const harfler = serial.replace(/[\s\-_.]/g, '').split('');
  const govde = harfler.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\-_.]*');
  return new RegExp(govde, 'gi');
}

/** Satırı sütunlara ayır: 2+ boşluk ya da sekme sütun sınırıdır. */
function sutunlar(satir: string): string[] {
  return satir.split(/\t|\s{2,}/).map((h) => h.trim()).filter((h) => h !== '');
}

/** Metinde sayaç etiketlerini taşıyan BAŞLIK satırını ve sütun sırasını bul. */
function basligiBul(satirlar: string[]): { siyah: number; renkli: number; satirNo: number } | null {
  for (let i = 0; i < satirlar.length; i++) {
    const h = sutunlar(satirlar[i]).map((x) => fold(x));
    if (h.length < 2) continue;
    // Başlıkta ÖZEL sütun (Siyah/Black) varsa o kullanılır; yoksa genel
    // toplam sütununa düşülür — mono cihazın tablosunda yalnız "Total" olur.
    const ozel = h.findIndex((x) => SIYAH_OZEL.some((k) => x.includes(k)) && !RENKLI.some((k) => x.includes(k)));
    const genel = h.findIndex((x) => SIYAH_GENEL.some((k) => x.includes(k)) && !RENKLI.some((k) => x.includes(k)));
    const siyah = ozel >= 0 ? ozel : genel;
    const renkli = h.findIndex((x) => RENKLI.some((k) => x.includes(k)));
    // Siyah sütunu şart; renkli olmayabilir (s/b filolar)
    if (siyah >= 0) return { siyah, renkli, satirNo: i };
  }
  return null;
}

/** Sütun değerini sayıya çevir; sayaç değilse null. */
function sutunSayisi(hucreler: string[], index: number): number | null {
  if (index < 0 || index >= hucreler.length) return null;
  const h = hucreler[index];
  // Hücre SADECE sayı (ve ayırıcı) olmalı — "Canon iR2530" sayaç değildir.
  if (!/^[\d.,\s]+$/.test(h)) return null;
  const d = h.replace(/[^\d]/g, '');
  if (!d || d.length > 9) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tek e-postadan BİRDEN FAZLA cihaz okuması çıkar.
 *
 * @param bilinenSeriler O BAYİYE ait seriler. Çağıran taraf listeyi kiracıya
 *   göre daraltmalıdır; aksi hâlde başka bayinin cihazı eşleşebilir.
 */
export function parseCounterEmailCoklu(
  rawBody: string,
  bilinenSeriler: string[],
  subject = '',
): CokluSonuc {
  // HTML ise etiketleri sök; DÜZ METİNSE DOKUNMA. htmlToText boşluk yığınlarını
  // sadeleştiriyor ve düz metin tablolarındaki SÜTUN HİZASINI bozuyor —
  // hizalama, tablo yerleşiminin tek ipucu.
  const htmlMi = /<[a-z!/][\s\S]*?>/i.test(rawBody);
  const govde = htmlMi ? htmlToText(rawBody) : rawBody;
  const metin = (subject ? subject + '\n' : '') + govde;
  const satirlar = metin.split('\n');
  const seriler = [...new Set(bilinenSeriler.filter((s) => s && s.replace(/[\s\-_.]/g, '').length >= 4))]
    .sort((a, b) => b.length - a.length); // uzun seri önce: kısa olan uzunun içinde geçebilir

  // ── Hangi seri hangi satırda geçiyor ──────────────────────────────────
  const satirdaSeri = new Map<number, string>();   // satırNo → serial
  const bulunanSeriler = new Set<string>();
  for (let i = 0; i < satirlar.length; i++) {
    for (const s of seriler) {
      if (satirdaSeri.has(i)) break;               // bir satırda ilk (en uzun) seri kazanır
      if (seriRegex(s).test(satirlar[i])) {
        satirdaSeri.set(i, s);
        bulunanSeriler.add(s);
      }
    }
  }

  if (bulunanSeriler.size === 0) {
    return { okumalar: [], seriYok: true, cihazSayisi: 0, yerlesim: 'yok' };
  }

  const baslik = basligiBul(satirlar);
  const enIyi = new Map<string, CihazOkumasi>();
  let kullanilan: 'blok' | 'tablo' = 'blok';

  for (const [satirNo, serial] of satirdaSeri) {
    // Bu seri için zaten güvenli bir okuma bulunduysa (başlıkta + tabloda
    // geçmiş olabilir) tekrar arama.
    if (enIyi.get(serial)?.guvenli) continue;

    let black: number | null = null;
    let color: number | null = null;

    // ── A) TABLO: başlık varsa ve cihaz satırı başlıktan SONRAYSA ───────
    if (baslik && satirNo > baslik.satirNo) {
      const h = sutunlar(satirlar[satirNo]);
      black = sutunSayisi(h, baslik.siyah);
      color = sutunSayisi(h, baslik.renkli);
      if (black !== null) kullanilan = 'tablo';
    }

    // ── B) BLOK: etiketler cihazın yanında ──────────────────────────────
    if (black === null) {
      // Bölge: bu satırdan bir SONRAKİ seri satırına kadar. Etiket ve değer
      // farklı satırlarda olabiliyor (dikey liste), o yüzden satır değil bölge.
      let bitis = satirlar.length;
      for (const [n] of satirdaSeri) if (n > satirNo && n < bitis) bitis = n;
      const bolge = satirlar.slice(satirNo, bitis).join('\n');
      const p = parseCounters(bolge);
      // Serinin KENDİ rakamları sayaç sanılmasın: seri metnini bölgeden çıkar
      if (p.black !== null) {
        const temiz = parseCounters(bolge.replace(seriRegex(serial), ' '));
        black = temiz.black;
        color = temiz.color;
      }
    }

    enIyi.set(serial, {
      serial, black, color,
      guvenli: black !== null,
      sebep: black === null ? 'Bu cihazın satırında sayaç okunamadı' : undefined,
    });
  }

  const okumalar = [...enIyi.values()];
  return {
    okumalar,
    seriYok: false,
    cihazSayisi: okumalar.length,
    yerlesim: okumalar.some((o) => o.guvenli) ? kullanilan : 'yok',
  };
}
