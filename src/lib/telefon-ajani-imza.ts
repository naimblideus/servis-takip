/**
 * TELEFON AJANI — SIR VE İMZA (sunucu tarafı, `crypto`).
 *
 * Araç ucu (`/api/voice/tools`) ve Retell olay ucu (`/api/voice/webhook`)
 * herkese açık: Retell bizi internetten çağırıyor. İki kilit var ve araç
 * ucunda İKİSİ BİRDEN tutmalı:
 *
 *  1. PAYLAŞILAN SIR (`VOICE_TOOL_SECRET`, en az 16 karakter). Retell araç
 *     tanımındaki başlıkla gönderir. Tanımsızsa ya da kısaysa uç TAMAMEN
 *     KAPALIDIR. Sorgu dizesinden (`?secret=`) kabul EDİLMEZ: adresler
 *     erişim loglarına düşer.
 *  2. RETELL İMZASI (`x-retell-signature`): `v={ms},d={hex}`,
 *     HMAC-SHA256(ham gövde + zaman damgası, RETELL_API_KEY). Ayrı bir
 *     webhook sırrı yoktur; anahtar Retell API anahtarının kendisidir.
 *     5 dakikadan eski paket reddedilir (tekrar oynatma).
 *
 * Karşılaştırmalar sabit zamanlı: `===` ile karşılaştırma, sırrın harf harf
 * tahmin edilmesine kapı açar.
 */
import crypto from 'crypto';
import { SIR_EN_AZ } from './telefon-ajani';

function sabitZamanliEsit(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  if (x.length !== y.length) {
    // Uzunluk farkı da zaman farkı üretmesin: yine bir karşılaştırma yap.
    crypto.timingSafeEqual(x, x);
    return false;
  }
  return crypto.timingSafeEqual(x, y);
}

/** Araç sırrı doğru mu. Sır tanımsız ya da kısa ise HER ZAMAN false (fail-closed). */
export function aracSirriGecerli(gelen: string | null | undefined, sir: string | null | undefined): boolean {
  if (typeof sir !== 'string' || sir.length < SIR_EN_AZ) return false;
  if (typeof gelen !== 'string' || !gelen) return false;
  return sabitZamanliEsit(gelen, sir);
}

/**
 * Retell imzası geçerli mi.
 *
 * Anahtar yoksa, başlık yoksa, biçim bozuksa ya da zaman damgası 5 dakikadan
 * eski / 1 dakikadan ileri ise REDDEDİLİR. İleri sapmaya küçük tolerans:
 * iki sunucunun saati arasındaki fark geçerli paketi düşürmesin.
 */
export function retellImzasiGecerli(
  hamGovde: string,
  baslik: string | null | undefined,
  anahtar: string | null | undefined,
  simdi = Date.now(),
): boolean {
  if (!anahtar || !baslik) return false;
  const m = /^v=(\d{10,16}),d=([0-9a-f]{64})$/i.exec(baslik.trim());
  if (!m) return false;
  const [, zamanHam, ozet] = m;
  const zaman = Number(zamanHam);
  if (!Number.isFinite(zaman)) return false;
  const yas = simdi - zaman;
  if (yas > 5 * 60_000 || yas < -60_000) return false;
  const beklenen = crypto.createHmac('sha256', anahtar).update(hamGovde + zamanHam, 'utf8').digest('hex');
  return sabitZamanliEsit(beklenen, ozet.toLowerCase());
}

/** Testte ve yerel denemede imza üretmek için (Retell'in yaptığının aynısı). */
export function retellImzasi(hamGovde: string, anahtar: string, zaman = Date.now()): string {
  const ozet = crypto.createHmac('sha256', anahtar).update(hamGovde + String(zaman), 'utf8').digest('hex');
  return `v=${zaman},d=${ozet}`;
}
