// Girişsiz paylaşılabilir belge linki için imzalı token (HMAC).
// Müşteri login olmadan faturasını/makbuzunu görebilsin diye; token doğruysa erişim açılır.
// Stateless: DB'de token saklamayız, AUTH_SECRET'tan türetilir.
import { createHmac, timingSafeEqual } from 'crypto';

// Anahtar SADECE ortam değişkeninden; zayıf sabit fallback YOK (forge edilebilir token önlenir).
// Lazy okunur (build sırasında çağrılmaz; yalnız istek anında) — yoksa fail-closed.
function getSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET/NEXTAUTH_SECRET tanımlı değil — belge linki imzalanamıyor');
  return s;
}

/** kind: 'fatura' | 'makbuz' — belge türü + id'den 40 haneli imza üret. */
export function docToken(kind: string, id: string): string {
  return createHmac('sha256', getSecret()).update(`${kind}:${id}`).digest('hex').slice(0, 40);
}

/** Sabit zamanlı doğrulama (timing attack'a kapalı). Secret yoksa fail-closed (false). */
export function verifyDocToken(kind: string, id: string, token: string | undefined | null): boolean {
  if (!token || token.length !== 40) return false;
  let expected: string;
  try {
    expected = docToken(kind, id);
  } catch {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}
