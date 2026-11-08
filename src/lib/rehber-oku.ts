/**
 * TELEFON REHBERİ (vCard, .vcf) OKUYUCU — kaydı olmayan bayinin "listesi"
 *
 * Hiç Excel tutmamış bayinin müşteri listesi telefonunun rehberindedir. iPhone
 * Kişiler'den, Google Kişiler'den ya da Android'den dışa aktarılan .vcf dosyası
 * burada okunur; bayi müşterilerini işaretler (lib/musteri-ekle musterileriEkle).
 *
 * Desteklenen: vCard 2.1 / 3.0 / 4.0.
 *   · katlanmış satırlar (boşluk/sekmeyle başlayan devam satırı),
 *   · Android'in vCard 2.1 dökümündeki QUOTED-PRINTABLE + CHARSET (Türkçe
 *     harfler "=C3=87" diye gelir, "=" ile biten satır devam eder),
 *   · grup önekli alanlar (item1.TEL), 4.0'daki "tel:" URI'si,
 *   · 3.0/4.0 kaçışları (\, \; \n).
 * Yalnız ad, firma ve telefon okunur. Tarayıcıda çalışır; dosya sunucuya
 * gitmez, yalnız bayinin seçtiği kişiler gider.
 */

export interface RehberKisisi {
  /** Kişinin adı (FN, yoksa N'den). */
  ad: string;
  /** Firma (ORG). */
  firma: string;
  /** Telefonlar; cep olan önce. */
  telefonlar: string[];
}

export const REHBER_AZAMI_KISI = 5000;
/** Tek seferde müşteri yapılabilecek kişi (sunucu da aynısını uygular: lib/musteri-ekle). */
export const TOPLU_AZAMI = 500;

const bayt = (hex: string) => parseInt(hex, 16);

/** QUOTED-PRINTABLE çöz: =XX baytları verilen karakter kümesiyle metne. */
function qpCoz(s: string, charset: string): string {
  const baytlar: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) { baytlar.push(bayt(s.slice(i + 1, i + 3))); i += 2; }
    else {
      // QP içinde düz karakter: UTF-8 baytlarıyla eklenir.
      for (const b of new TextEncoder().encode(ch)) baytlar.push(b);
    }
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(Uint8Array.from(baytlar));
  } catch {
    return new TextDecoder('utf-8').decode(Uint8Array.from(baytlar));
  }
}

/** 3.0/4.0 metin kaçışları. */
const kacisCoz = (s: string) => s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? ' ' : c));

/** ";" ile ayrılmış bileşenler (kaçışlı ";" bölmez). */
function bilesenler(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) { cur += s[i] + s[i + 1]; i++; continue; }
    if (s[i] === ';') { out.push(cur); cur = ''; continue; }
    cur += s[i];
  }
  out.push(cur);
  return out.map((x) => kacisCoz(x).trim());
}

/** Fiziksel satırları mantıksal satırlara birleştirir. */
function satirlariBirlestir(metin: string): string[] {
  const ham = metin.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let qpDevam = false;
  for (const s of ham) {
    if (qpDevam && out.length) {
      // QUOTED-PRINTABLE yumuşak satır sonu: önceki satır "=" ile bitti.
      out[out.length - 1] = out[out.length - 1].slice(0, -1) + s;
    } else if ((s.startsWith(' ') || s.startsWith('\t')) && out.length) {
      out[out.length - 1] += s.slice(1);
    } else {
      out.push(s);
    }
    const son = out[out.length - 1] ?? '';
    qpDevam = /ENCODING=QUOTED-PRINTABLE/i.test(son.split(':')[0] ?? '') && son.endsWith('=');
  }
  return out;
}

/** Bir satırı alan adı, parametreler ve değere ayırır. */
function satirCoz(satir: string): { ad: string; param: string[]; deger: string } | null {
  const i = satir.indexOf(':');
  if (i <= 0) return null;
  const sol = satir.slice(0, i).split(';');
  const ad = (sol[0].split('.').pop() ?? '').toUpperCase();
  return { ad, param: sol.slice(1), deger: satir.slice(i + 1) };
}

function degerCoz(param: string[], deger: string): string {
  const qp = param.some((p) => /^(ENCODING=)?QUOTED-PRINTABLE$/i.test(p));
  const charset = param.find((p) => /^CHARSET=/i.test(p))?.split('=')[1] ?? 'utf-8';
  return qp ? qpCoz(deger, charset) : deger;
}

/** .vcf metnini kişilere çevirir. Telefonu olmayan kişi atlanır. */
export function rehberOku(metin: string): RehberKisisi[] {
  const kisiler: RehberKisisi[] = [];
  let kart: { fn: string; n: string; org: string; tel: { no: string; cep: boolean }[] } | null = null;
  for (const satir of satirlariBirlestir(metin)) {
    const c = satirCoz(satir);
    if (!c) continue;
    if (c.ad === 'BEGIN' && /^VCARD$/i.test(c.deger.trim())) { kart = { fn: '', n: '', org: '', tel: [] }; continue; }
    if (!kart) continue;
    if (c.ad === 'END' && /^VCARD$/i.test(c.deger.trim())) {
      const nParca = kart.n ? bilesenler(kart.n) : [];
      const nAd = [nParca[3], nParca[1], nParca[2], nParca[0], nParca[4]].filter(Boolean).join(' ');
      const ad = (kacisCoz(kart.fn).trim() || nAd).replace(/\s+/g, ' ').trim();
      const firma = (kart.org ? bilesenler(kart.org)[0] : '').replace(/\s+/g, ' ').trim();
      const telefonlar = [...new Set(kart.tel.sort((a, b) => Number(b.cep) - Number(a.cep)).map((t) => t.no))];
      if (telefonlar.length && (ad || firma)) kisiler.push({ ad, firma, telefonlar });
      kart = null;
      if (kisiler.length >= REHBER_AZAMI_KISI) break;
      continue;
    }
    const deger = degerCoz(c.param, c.deger);
    if (c.ad === 'FN') kart.fn = deger;
    else if (c.ad === 'N') kart.n = deger;
    else if (c.ad === 'ORG') kart.org = deger;
    else if (c.ad === 'TEL') {
      const no = deger.replace(/^tel:/i, '').trim();
      if (!/\d/.test(no)) continue;
      const tur = c.param.join(';').toUpperCase();
      kart.tel.push({ no, cep: /CELL|MOBILE|IPHONE/.test(tur) });
    }
  }
  return kisiler;
}

/**
 * Rehber kişisinden müşteri: firma yazılıysa müşteri adı firmadır, kişi
 * yetkili olur; yoksa kişinin adı müşteri adıdır.
 */
export function musteriAdi(k: { ad: string; firma: string }): { ad: string; yetkili: string | null } {
  if (k.firma) return { ad: k.firma, yetkili: k.ad && k.ad !== k.firma ? k.ad : null };
  return { ad: k.ad, yetkili: null };
}
