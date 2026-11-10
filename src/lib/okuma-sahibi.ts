/**
 * OKUMANIN SAHİBİ — sayfalar, okundukları sırada cihaz kimdeyse ona faturalanır.
 *
 * Okuma kaydında müşteri yoktu; dönem faturası "müşterinin ŞİMDİKİ cihazlarının
 * faturalanmamış okumaları"nı topluyordu. Cihaz ay ortasında A'dan B'ye
 * taşınınca A'da basılan sayfalar B'nin faturasına giriyor, A'ya hiç
 * kesilmiyordu (hastane şubeleri arasında makine gezdiren bayide her ay).
 *
 * Yeni okumalar müşterisiyle yazılır (lib/readings createReading). Eski
 * okumalarda alan boştur ve "cihazın şimdiki müşterisi" sayılır; bu yüzden
 * cihazın müşterisi DEĞİŞMEDEN hemen önce eski müşterinin faturalanmamış,
 * damgasız okumaları onunla damgalanmalıdır. Cihazın müşterisini değiştiren
 * her yol bunu çağırır.
 */
import type { Prisma } from '@prisma/client';

type Db = Pick<Prisma.TransactionClient, 'counterReading'>;

/** Cihaz `eskiMusteriId`den ayrılıyor: onun döneminde okunmuş sahipsiz okumaları ona yaz. */
export async function cihazAyriliyor(db: Db, tenantId: string, deviceId: string, eskiMusteriId: string): Promise<number> {
  const r = await db.counterReading.updateMany({
    where: { tenantId, deviceId, customerId: null, billed: false },
    data: { customerId: eskiMusteriId },
  });
  return r.count;
}
