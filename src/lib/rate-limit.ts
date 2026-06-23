// Basit bellek-içi rate limit — tek-instance Node (standalone) sunucu için yeterli.
// Sabit pencere; key = IP+amaç. Brute-force/spam'a karşı ilk savunma.
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();
let lastPrune = 0;

function prune(now: number) {
  if (now - lastPrune < 60_000) return; // dakikada bir temizlik
  lastPrune = now;
  for (const [k, b] of store) if (b.resetAt < now) store.delete(k);
}

/** İstemci IP'sini header'lardan çıkar (proxy/Coolify arkasında x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * @returns ok=false ise limit aşıldı; retryAfter saniye.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  prune(now);
  const b = store.get(key);
  if (!b || b.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  return { ok: true, retryAfter: 0 };
}

/** Yardımcı: 429 cevabı için standart gövde. */
export function tooMany(retryAfter: number) {
  return { error: `Çok fazla deneme. ${retryAfter} sn sonra tekrar deneyin.`, retryAfter };
}
