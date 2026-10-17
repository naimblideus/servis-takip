/**
 * SAYAÇSIZ KAPANMAZ — kiralık cihazın fişi sayaç girilmeden teslim edilemez.
 *
 * ── NİYE VAR ─────────────────────────────────────────────────────────────
 * Ay sonunda faturası kesilemeyen kiralık cihazın en sık sebebi, teknisyenin
 * sayacı yazmadan çıkması. Sonra biri müşteriyi arar, müşteri "geçen hafta
 * geldiniz ya" der; o haftanın sayfaları ya tahmin edilir ya kaybolur.
 * Paperpan'da bu kural var; bayi açarsa bizde de var.
 *
 * ── KURAL ────────────────────────────────────────────────────────────────
 * Engel YALNIZ şu dördü birlikteyse: ayar açık (Tenant.sayacZorunlu, varsayılan
 * KAPALI) + fiş "teslim edildi"ye GEÇİYOR + cihaz kiralık + bu fişe bağlı sayaç
 * okuması yok. Satılmış cihazın sayacı faturaya girmez, ona engel yok; zaten
 * teslim edilmiş fişte başka alan düzeltmek de engellenmez.
 *
 * Durumu değiştiren tek etkileşimli yol PATCH /api/tickets/<id>. SQL içe
 * aktarımı geçmiş kayıt taşıdığı için bu kurala bağlı değildir.
 */
import { prisma } from '@/lib/prisma';

export function sayacZorunluEngeli(g: {
  ayarAcik: boolean;
  kiralik: boolean;
  fisteOkumaVar: boolean;
  oncekiDurum: string;
  yeniDurum: string;
}): boolean {
  if (!g.ayarAcik) return false;
  if (g.yeniDurum !== 'DELIVERED' || g.oncekiDurum === 'DELIVERED') return false;
  return g.kiralik && !g.fisteOkumaVar;
}

/** Fiş teslime geçerken engel var mı? Bayi, cihaz ve okuma veritabanından. */
export async function teslimSayacEngeli(tenantId: string, ticketId: string, oncekiDurum: string): Promise<boolean> {
  const bayi = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { sayacZorunlu: true } });
  // Ayar kapalıysa başka sorgu yok: kuralın bedelini yalnız açan bayi öder.
  if (!bayi?.sayacZorunlu) return false;
  const fis = await prisma.serviceTicket.findFirst({
    where: { id: ticketId, tenantId },
    select: { device: { select: { isRental: true } } },
  });
  if (!fis) return false;
  const okuma = await prisma.counterReading.count({ where: { tenantId, ticketId } });
  return sayacZorunluEngeli({
    ayarAcik: true,
    kiralik: Boolean(fis.device?.isRental),
    fisteOkumaVar: okuma > 0,
    oncekiDurum,
    yeniDurum: 'DELIVERED',
  });
}
