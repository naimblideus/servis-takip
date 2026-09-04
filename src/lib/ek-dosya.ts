// SAYAÇ E-POSTASI EKLERİNİ METNE ÇEVİR.
//
// NEDEN: Filo yazılımları (Kyocera Fleet Services, Lexmark Fleet Manager,
// MPS Monitor, FMAudit…) sayaç raporunu e-postanın GÖVDESİNDE değil, EK
// dosyada gönderiyor — KFS varsayılan olarak ZIP'li CSV atıyor. Uç yalnız
// gövde metnini okuduğu için bu raporlar SESSİZCE SIFIR okuma üretiyordu:
// e-posta geliyor, hiçbir sayaç işlenmiyor, kimse fark etmiyor.
//
// TASARIM — burada TAHMİN YOK: ek dosya yalnızca DÜZ METNE çevrilir ve
// mevcut, testli ayrıştırıcıya (lib/counter-email) verilir. Yeni bir sayaç
// çıkarma mantığı yazılmadı; CSV satırları metin hâline gelince zaten
// çalışan seri/sayaç eşleştirmesi devreye giriyor.
//
// ZIP okuyucu elle yazıldı: Node'un zlib'i yeterli, halka açık depoya yeni
// bağımlılık sokmaya gerek yok.

import { inflateRawSync } from 'node:zlib';

// ── Güvenlik sınırları ──────────────────────────────────────────────────
// Uç dışarıya açık; kötü niyetli ya da bozuk bir ek sunucuyu yormamalı.
const MAX_EK_SAYISI = 20;
const MAX_ACILMIS_BAYT = 20 * 1024 * 1024;   // 20 MB — 1000 cihazlık CSV ~1 MB
const MAX_DOSYA_SAYISI = 50;                  // ZIP içindeki dosya adedi

/** Metne çevrilebilir ek türleri. Görsel/PDF burada işlenmez. */
const METIN_UZANTI = /\.(csv|txt|xml|tsv|htm|html|json)$/i;
const ZIP_UZANTI = /\.zip$/i;

export type GelenEk = {
  /** Dosya adı — türü buradan anlaşılır. */
  ad?: string | null;
  /** base64 içerik. Köprüler eki böyle taşır. */
  base64?: string | null;
  /** İsteğe bağlı MIME türü. */
  tip?: string | null;
};

export type EkSonucu = {
  /** Ayrıştırıcıya verilecek düz metin (hepsi birleşik). */
  metin: string;
  /** Metne çevrilen dosya adları — kuyrukta "bu nereden geldi" için. */
  okunan: string[];
  /** Atlananlar ve sebebi — sessiz kayıp olmasın. */
  atlanan: { ad: string; sebep: string }[];
};

/** ZIP merkez dizininden dosyaları çıkarır. Bozuk ZIP'te boş döner. */
function zipAc(buf: Buffer): { ad: string; icerik: Buffer }[] {
  const cikan: { ad: string; icerik: Buffer }[] = [];

  // End of Central Directory: PK\x05\x06. Sondan geriye aranır (yorum olabilir).
  let eocd = -1;
  const enAz = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= enAz; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return cikan;

  const girisSayisi = Math.min(buf.readUInt16LE(eocd + 10), MAX_DOSYA_SAYISI);
  let p = buf.readUInt32LE(eocd + 16); // merkez dizin başlangıcı
  let toplamAcilmis = 0;

  for (let n = 0; n < girisSayisi; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break;

    const yontem = buf.readUInt16LE(p + 10);
    const sikBoyut = buf.readUInt32LE(p + 20);
    const acikBoyut = buf.readUInt32LE(p + 24);
    const adUz = buf.readUInt16LE(p + 28);
    const ekAlanUz = buf.readUInt16LE(p + 30);
    const yorumUz = buf.readUInt16LE(p + 32);
    const yerelOfs = buf.readUInt32LE(p + 42);
    const ad = buf.subarray(p + 46, p + 46 + adUz).toString('utf8');
    p += 46 + adUz + ekAlanUz + yorumUz;

    if (ad.endsWith('/')) continue;                       // klasör
    toplamAcilmis += acikBoyut;
    if (toplamAcilmis > MAX_ACILMIS_BAYT) break;          // zip bomb koruması

    // Yerel başlıktan gerçek veri konumunu bul (başlıktaki alan uzunlukları
    // merkez dizindekinden farklı olabilir).
    if (yerelOfs + 30 > buf.length || buf.readUInt32LE(yerelOfs) !== 0x04034b50) continue;
    const yAdUz = buf.readUInt16LE(yerelOfs + 26);
    const yEkUz = buf.readUInt16LE(yerelOfs + 28);
    const veriBas = yerelOfs + 30 + yAdUz + yEkUz;
    const ham = buf.subarray(veriBas, veriBas + sikBoyut);

    try {
      if (yontem === 0) cikan.push({ ad, icerik: Buffer.from(ham) });          // stored
      else if (yontem === 8) cikan.push({ ad, icerik: inflateRawSync(ham) });  // deflate
      // diğer yöntemler (bzip2/lzma) filo raporlarında görülmüyor
    } catch { /* bozuk giriş atlanır, diğerleri denenir */ }
  }
  return cikan;
}

/**
 * CSV/TSV'yi ayrıştırıcının okuyabileceği düz metne çevirir.
 *
 * Ayrıştırıcı satır içinde seri ve sayaç arıyor; virgül/noktalı virgül
 * ayraçları boşluğa çevrilince satır zaten okunabilir hâle geliyor.
 * Kolon adı tahmin EDİLMEZ — bu bilinçli: yanlış kolonu sayaç sanmak
 * yanlış fatura demektir, mevcut ayrıştırıcının kuralları geçerli kalır.
 */
function tabloyuMetneCevir(icerik: string): string {
  return icerik
    .split(/\r?\n/)
    .map((satir) => satir.replace(/"/g, '').replace(/[;,\t]+/g, '  ').trim())
    .filter(Boolean)
    .join('\n');
}

function xmlMetneCevir(icerik: string): string {
  return icerik
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .split(/\r?\n/).map((s) => s.trim()).filter(Boolean).join('\n');
}

/**
 * Ekleri düz metne çevirir. ZIP'ler açılır, içindeki metin dosyaları da
 * işlenir. Okunamayan her ek SEBEBİYLE birlikte döner — sessizce kaybolmaz.
 */
export function ekleriMetneCevir(ekler: GelenEk[] | null | undefined): EkSonucu {
  const sonuc: EkSonucu = { metin: '', okunan: [], atlanan: [] };
  if (!Array.isArray(ekler) || ekler.length === 0) return sonuc;

  const parcalar: string[] = [];

  const isle = (ad: string, buf: Buffer, zipIcinden: boolean) => {
    if (ZIP_UZANTI.test(ad) && !zipIcinden) {
      const icindekiler = zipAc(buf);
      if (icindekiler.length === 0) {
        sonuc.atlanan.push({ ad, sebep: 'ZIP açılamadı ya da boş' });
        return;
      }
      for (const f of icindekiler) isle(f.ad, f.icerik, true);
      return;
    }
    if (!METIN_UZANTI.test(ad)) {
      sonuc.atlanan.push({ ad, sebep: 'metin değil (yalnız csv/txt/xml/tsv/html/json okunur)' });
      return;
    }
    const ham = buf.toString('utf8');
    const metin = /\.(xml|html?)$/i.test(ad) ? xmlMetneCevir(ham) : tabloyuMetneCevir(ham);
    if (!metin.trim()) {
      sonuc.atlanan.push({ ad, sebep: 'içerik boş' });
      return;
    }
    parcalar.push(`--- ek: ${ad} ---\n${metin}`);
    sonuc.okunan.push(ad);
  };

  for (const ek of ekler.slice(0, MAX_EK_SAYISI)) {
    const ad = (ek?.ad || '').trim() || 'adsiz';
    if (!ek?.base64) { sonuc.atlanan.push({ ad, sebep: 'içerik yok' }); continue; }
    let buf: Buffer;
    try {
      buf = Buffer.from(ek.base64, 'base64');
    } catch {
      sonuc.atlanan.push({ ad, sebep: 'base64 çözülemedi' });
      continue;
    }
    if (buf.length === 0) { sonuc.atlanan.push({ ad, sebep: 'içerik boş' }); continue; }
    if (buf.length > MAX_ACILMIS_BAYT) { sonuc.atlanan.push({ ad, sebep: 'çok büyük' }); continue; }
    try {
      isle(ad, buf, false);
    } catch (e: any) {
      sonuc.atlanan.push({ ad, sebep: e?.message?.slice(0, 80) || 'okunamadı' });
    }
  }

  sonuc.metin = parcalar.join('\n\n');
  return sonuc;
}
