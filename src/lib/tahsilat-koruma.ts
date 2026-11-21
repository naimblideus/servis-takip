/**
 * Tahsilat yanlış basma koruması (2026-11-21, Saygılı olayı).
 *
 * Olay: bayi Tahsilat ekranına ₺22.074,60 yerine ₺220.741,60 yazdı (fazladan
 * bir hane). Ekran hiç sormadan kaydetti; açık faturaları aşan ₺198.667 avans
 * olarak kaldı ve aylarca kimse fark etmedi.
 *
 * İki kural, ikisi de SUNUCUDA (ekranı atlayan istek de takılır):
 *  1. FAZLA_TUTAR: tutar müşterinin açık faturalarını aşıyorsa, bayi açıkça
 *     "tutar doğru" demeden kaydedilmez. Fazlası avans olur; bu bazen doğrudur
 *     (peşin ödeme), o yüzden yasak değil, onaylı.
 *  2. AYNI_TAHSILAT: aynı müşteriye aynı tutar son 2 dakikada kaydedildiyse
 *     ikinci kayıt onaysız yapılmaz (çift tıklama, sayfayı yenileyip yeniden
 *     gönderme).
 *
 * Kontrol müşteri kilidi altında yapılır: aynı anda gelen iki istek ikisi de
 * "önceki kayıt yok" görüp geçemez.
 */
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export const AYNI_TAHSILAT_SN = 120;
/** Tutar açık borcun bu katı ya da fazlasıysa ekran "bir hane fazla olabilir" der. */
export const SUPHELI_KAT = 5;

const r2 = (n: number) => Math.round(n * 100) / 100;

export type TahsilatUyarisi =
  | { kod: 'FAZLA_TUTAR'; tutar: number; acik: number; avans: number; kat: number | null }
  | { kod: 'AYNI_TAHSILAT'; tutar: number; saniyeOnce: number };

export class TahsilatKorumasi extends Error {
  constructor(public uyari: TahsilatUyarisi) {
    super(uyari.kod);
  }
}

/** Tutar açık faturaları (kuruş yuvarlamasıyla) aşıyor mu? Saf; testler buradan. */
export function fazlaTutarUyarisi(tutar: number, acik: number): TahsilatUyarisi | null {
  const t = r2(tutar), a = r2(Math.max(0, acik));
  if (t <= a + 0.005) return null;
  const kat = a > 0 ? Math.round((t / a) * 10) / 10 : null;
  return { kod: 'FAZLA_TUTAR', tutar: t, acik: a, avans: r2(t - a), kat };
}

export async function acikFaturaToplami(tx: Tx, tenantId: string, customerId: string): Promise<number> {
  const fs = await tx.customerInvoice.findMany({
    where: { tenantId, customerId, status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] }, deletedAt: null },
    select: { totalAmount: true, paidAmount: true },
  });
  return r2(fs.reduce((s, f) => s + (Number(f.totalAmount) - Number(f.paidAmount)), 0));
}

/**
 * Müşteri kilidi ALINDIKTAN sonra, aynı işlemin içinde çağrılır.
 * Onaylanmamış bir uyarı varsa TahsilatKorumasi fırlatır.
 */
export async function tahsilatiDenetle(
  tx: Tx,
  g: { tenantId: string; customerId: string; tutar: number; fazlaOnay?: boolean; tekrarOnay?: boolean; simdi?: Date },
): Promise<void> {
  const tutar = r2(g.tutar);
  if (g.fazlaOnay !== true) {
    const u = fazlaTutarUyarisi(tutar, await acikFaturaToplami(tx, g.tenantId, g.customerId));
    if (u) throw new TahsilatKorumasi(u);
  }
  if (g.tekrarOnay !== true) {
    const simdi = g.simdi ?? new Date();
    const yakin = await tx.payment.findFirst({
      where: {
        tenantId: g.tenantId, customerId: g.customerId, ticketId: null, amount: tutar,
        createdAt: { gte: new Date(simdi.getTime() - AYNI_TAHSILAT_SN * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (yakin) {
      const saniyeOnce = Math.max(1, Math.round((simdi.getTime() - yakin.createdAt.getTime()) / 1000));
      throw new TahsilatKorumasi({ kod: 'AYNI_TAHSILAT', tutar, saniyeOnce });
    }
  }
}
