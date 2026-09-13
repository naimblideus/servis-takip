import { deflateRawSync } from 'zlib';

/**
 * KÜÇÜK ZIP YAZICI.
 *
 * ── NEDEN KENDİMİZ YAZIYORUZ ─────────────────────────────────────────────
 * Ay sonunda 40-50 faturanın UBL dosyası tek tek indirilmiyor; entegratör
 * portalları toplu yüklemede ZIP istiyor. Bunun için depoya bir paket
 * eklemek (ve onun bağımlılıklarını, güncellemelerini taşımak) gerekmiyor:
 * ihtiyacımız olan ZIP'in en dar hâli ve Node'un kendi zlib'i yetiyor.
 *
 * ── KASITLI SINIRLAR ─────────────────────────────────────────────────────
 * ZIP64 YOK. 4 GB'ı ya da 65.535 dosyayı aşan arşiv üretilemez; aşılırsa
 * sessizce bozuk dosya vermek yerine HATA veriyoruz. Fatura XML'lerinde bu
 * sınırların yanına bile yaklaşılmıyor.
 *
 * Tarih alanı SABİT (1980-01-01). Gerçek saat yazsaydık aynı faturaların
 * arşivi her indirişte farklı bir dosya olurdu; sabit tarih arşivi
 * tekrarlanabilir yapıyor. Dosyaların kendi tarihi zaten XML'in içinde.
 */

const CRC_TABLO = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

export function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLO[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

export type ZipGirdisi = { ad: string; icerik: string | Buffer };

const DOS_SAAT = 0;      // 00:00:00
const DOS_TARIH = 0x0021; // 1980-01-01

export function zipUret(girdiler: ZipGirdisi[]): Buffer {
  if (girdiler.length > 0xffff) {
    throw new Error(`ZIP en fazla 65535 dosya alabilir (${girdiler.length} verildi).`);
  }
  const adlar = new Set<string>();
  for (const g of girdiler) {
    if (adlar.has(g.ad)) throw new Error(`Arşivde aynı ad iki kez var: ${g.ad}`);
    adlar.add(g.ad);
  }

  const yerel: Buffer[] = [];
  const merkez: Buffer[] = [];
  let uzaklik = 0;

  for (const g of girdiler) {
    const ad = Buffer.from(g.ad, 'utf8');
    const ham = Buffer.isBuffer(g.icerik) ? g.icerik : Buffer.from(g.icerik, 'utf8');
    const sikisik = deflateRawSync(ham);
    const crc = crc32(ham);

    if (ham.length > 0xffffffff || sikisik.length > 0xffffffff) {
      throw new Error(`Dosya ZIP64 gerektiriyor: ${g.ad}`);
    }

    const bas = Buffer.alloc(30);
    bas.writeUInt32LE(0x04034b50, 0);
    bas.writeUInt16LE(20, 4);      // gereken sürüm
    bas.writeUInt16LE(0x0800, 6);  // bayrak: dosya adı UTF-8
    bas.writeUInt16LE(8, 8);       // yöntem: deflate
    bas.writeUInt16LE(DOS_SAAT, 10);
    bas.writeUInt16LE(DOS_TARIH, 12);
    bas.writeUInt32LE(crc, 14);
    bas.writeUInt32LE(sikisik.length, 18);
    bas.writeUInt32LE(ham.length, 22);
    bas.writeUInt16LE(ad.length, 26);
    bas.writeUInt16LE(0, 28);
    yerel.push(bas, ad, sikisik);

    const mrk = Buffer.alloc(46);
    mrk.writeUInt32LE(0x02014b50, 0);
    mrk.writeUInt16LE(20, 4);      // üreten sürüm
    mrk.writeUInt16LE(20, 6);      // gereken sürüm
    mrk.writeUInt16LE(0x0800, 8);
    mrk.writeUInt16LE(8, 10);
    mrk.writeUInt16LE(DOS_SAAT, 12);
    mrk.writeUInt16LE(DOS_TARIH, 14);
    mrk.writeUInt32LE(crc, 16);
    mrk.writeUInt32LE(sikisik.length, 20);
    mrk.writeUInt32LE(ham.length, 24);
    mrk.writeUInt16LE(ad.length, 28);
    mrk.writeUInt16LE(0, 30);      // ek alan
    mrk.writeUInt16LE(0, 32);      // açıklama
    mrk.writeUInt16LE(0, 34);      // disk
    mrk.writeUInt16LE(0, 36);      // iç öznitelik
    mrk.writeUInt32LE(0, 38);      // dış öznitelik
    mrk.writeUInt32LE(uzaklik, 42);
    merkez.push(mrk, ad);

    uzaklik += bas.length + ad.length + sikisik.length;
  }

  const merkezGovde = Buffer.concat(merkez);
  const son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0);
  son.writeUInt16LE(0, 4);
  son.writeUInt16LE(0, 6);
  son.writeUInt16LE(girdiler.length, 8);
  son.writeUInt16LE(girdiler.length, 10);
  son.writeUInt32LE(merkezGovde.length, 12);
  son.writeUInt32LE(uzaklik, 16);
  son.writeUInt16LE(0, 20);

  return Buffer.concat([...yerel, merkezGovde, son]);
}
