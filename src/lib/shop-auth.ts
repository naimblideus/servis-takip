/**
 * MAĞAZA SERVİS KİMLİĞİ.
 *
 * Nextus Mağaza ayrı bir uygulamadır ve servis-takip'in veritabanına YAZMAZ.
 * Yazması gereken tek şey vardır — sipariş kapandığında stok düşümü ve cari
 * kaydı — ve o da buradan, servis-takip'in kendi kanıtlanmış işlemiyle olur.
 *
 * NEDEN BÖYLE: iki uygulama aynı satırlara yazarsa stok iki kez düşer, cari
 * iki kez işlenir ve hata sessiz olur. Yazma yolunu tek kapıya indirmek,
 * o hata sınıfını yapısal olarak ortadan kaldırır.
 *
 * Kimlik doğrulama oturum değil, PAYLAŞILAN SIR ile: çağıran bir kullanıcı
 * değil, bir sunucudur. SHOP_SERVICE_TOKEN tanımlı değilse uç nokta KAPALIDIR
 * — boş sır ile "herkes geçsin" davranışı, sessiz bir güvenlik açığıdır.
 */
import { timingSafeEqual } from 'crypto';

export function shopServisYetkili(req: Request): boolean {
  const secret = process.env.SHOP_SERVICE_TOKEN;
  if (!secret || secret.length < 16) return false;

  const header = req.headers.get('authorization') ?? '';
  const gelen = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (gelen.length !== secret.length) return false;

  // Sabit süreli karşılaştırma: uzunluk eşitse içerik farkı zamana yansımasın.
  try {
    return timingSafeEqual(Buffer.from(gelen), Buffer.from(secret));
  } catch {
    return false;
  }
}
