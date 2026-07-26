// TOTP (RFC 6238) — Google Authenticator / Microsoft Authenticator uyumlu. SIFIR BAĞIMLILIK.
// Kimlik doğrulama kodu üretmez/saklamaz; yalnız paylaşılan gizli anahtardan 6 haneli kodu
// hesaplar ve zaman penceresiyle doğrular.
import crypto from 'crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD = 30; // saniye
const DIGITS = 6;

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  const clean = (s || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** Yeni gizli anahtar (base32, 160 bit — standart) */
export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** Belirli bir zaman adımı için 6 haneli kod */
function codeForCounter(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function currentCounter(atMs: number = Date.now()): number {
  return Math.floor(atMs / 1000 / PERIOD);
}

/**
 * Kodu doğrula. window=1 → önceki/sonraki 30sn de kabul (saat kayması toleransı).
 * lastCounter verilirse TEKRAR KULLANIM engellenir (aynı kod ikinci kez geçmez).
 * @returns eşleşen counter (başarılı) ya da null
 */
export function verifyTOTP(
  secret: string,
  token: string,
  opts: { window?: number; lastCounter?: number | null; atMs?: number } = {},
): number | null {
  const { window = 1, lastCounter = null, atMs = Date.now() } = opts;
  const t = String(token || '').replace(/\D/g, '');
  if (t.length !== DIGITS || !secret) return null;

  const now = currentCounter(atMs);
  for (let w = -window; w <= window; w++) {
    const counter = now + w;
    if (lastCounter != null && counter <= lastCounter) continue; // tekrar kullanım (replay) engeli
    const expected = codeForCounter(secret, counter);
    // Zamanlama saldırısına kapalı karşılaştırma (uzunluklar eşit)
    if (crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(t, 'utf8'))) {
      return counter;
    }
  }
  return null;
}

/** Authenticator uygulamasının QR'dan okuduğu URI */
export function otpauthURI(params: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${params.issuer}:${params.account}`);
  const q = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}

/** Kurtarma kodları — telefon kaybolursa giriş için (tek kullanımlık, hash'lenerek saklanır) */
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 karakter
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
}
