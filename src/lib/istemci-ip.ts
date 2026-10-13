/**
 * İstemci IP'si (hız sınırları için). Önce vekilin yazdığı X-Real-IP:
 * X-Forwarded-For'un ilk değerini istemci kendisi gönderebilir, sınırı öyle
 * atlatırdı. Yerel geliştirmede ikisi de yoksa null (IP sınırı uygulanmaz).
 */
export function istemciIp(req: Request): string | null {
  const gercek = req.headers.get('x-real-ip');
  if (gercek) return gercek.trim().slice(0, 60);
  const xff = req.headers.get('x-forwarded-for');
  return xff ? xff.split(',').pop()!.trim().slice(0, 60) : null;
}
