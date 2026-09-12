import { prisma } from '@/lib/prisma';

/**
 * RAPOR ÖZETİ — TEK KAYNAK.
 *
 * Hem ekran (/api/reports), hem CSV, hem YAZDIRMA sayfası buradan besleniyor.
 * Ayrı sorgu yazmak kolay olurdu ve yanlış olurdu: aynı rapor ekranda başka,
 * kâğıtta başka rakam gösterirse bayi hangisine güveneceğini bilemez. Bu depoda
 * aynı hata daha önce sayaç farkında yaşandı (iki ekran, iki tutar) — o yüzden
 * hesap tek yerde duruyor.
 *
 * NOT: "ciro" iki farklı şey demek ve ikisi bilerek ayrı:
 *   · totals.revenue  → bugüne kadarki TÜM fişlerin toplam tutarı (tahsil
 *                       edilmiş olsun olmasın) — iş hacmi.
 *   · aylik[].ciro    → yalnız ÖDENMİŞ fişler — kasaya giren.
 * Karıştırılırsa bayi kazanmadığı parayı kazanmış sanır.
 */

export interface RaporAyi {
  label: string;
  /** O ay AÇILAN fiş sayısı */
  adet: number;
  /** O ay ÖDENMİŞ fişlerin toplamı (kasaya giren) */
  ciro: number;
}

export interface RaporOzeti {
  toplamlar: { fis: number; musteri: number; cihaz: number; ciro: number };
  durumlar: { durum: string; adet: number }[];
  oncelikler: { oncelik: string; adet: number }[];
  aylik: RaporAyi[];
  /** Raporun kapsadığı ay sayısı — başlıkta ve CSV'de yazılıyor */
  ayAdedi: number;
}

export const DURUM_ADI: Record<string, string> = {
  NEW: 'Yeni',
  IN_SERVICE: 'Serviste',
  WAITING_FOR_PART: 'Parça bekliyor',
  READY: 'Hazır',
  DELIVERED: 'Teslim',
  CANCELLED: 'İptal',
};

export const ONCELIK_ADI: Record<string, string> = {
  LOW: 'Düşük', NORMAL: 'Normal', HIGH: 'Yüksek', URGENT: 'Acil',
};

/** Son `ayAdedi` ayın özeti. */
export async function raporOzeti(tenantId: string, ayAdedi = 6): Promise<RaporOzeti> {
  const now = new Date();

  const aylar = Array.from({ length: ayAdedi }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      label: d.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }),
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
    };
  }).reverse();

  const [fis, musteri, cihaz, ciroToplam, durumlar, oncelikler] = await Promise.all([
    prisma.serviceTicket.count({ where: { tenantId } }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.device.count({ where: { tenantId } }),
    prisma.serviceTicket.aggregate({ where: { tenantId }, _sum: { totalCost: true } }),
    prisma.serviceTicket.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
    prisma.serviceTicket.groupBy({ by: ['priority'], where: { tenantId }, _count: true }),
  ]);

  const aylik = await Promise.all(
    aylar.map(async (m) => {
      const [adet, ciro] = await Promise.all([
        prisma.serviceTicket.count({ where: { tenantId, createdAt: { gte: m.start, lte: m.end } } }),
        prisma.serviceTicket.aggregate({
          where: { tenantId, paymentStatus: 'PAID', updatedAt: { gte: m.start, lte: m.end } },
          _sum: { totalCost: true },
        }),
      ]);
      return { label: m.label, adet, ciro: Number(ciro._sum.totalCost || 0) };
    }),
  );

  return {
    toplamlar: {
      fis, musteri, cihaz,
      ciro: Number(ciroToplam._sum.totalCost || 0),
    },
    durumlar: durumlar.map((d) => ({ durum: d.status, adet: d._count })),
    oncelikler: oncelikler.map((o) => ({ oncelik: o.priority, adet: o._count })),
    aylik,
    ayAdedi,
  };
}
