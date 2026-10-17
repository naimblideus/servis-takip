/**
 * SAHADA GEÇEN SÜRE — VERİTABANI KATMANI.
 *
 * Karar saf dosyada (saha-suresi.ts); burası yazar. Her yazım, kararın
 * dayandığı hâli `where` şartı olarak taşır: aynı anda gelen iki "Vardım"dan
 * yalnız biri saati yazar, ikincisi boşa düşer ve ilk saat kalır.
 *
 * "Vardım" fişi "Yeni"den "Serviste"ye alıyorsa bu, panelin durum düğmesiyle
 * AYNI yoldan geçer: durum + statusUpdatedAt + aşama geçmişi satırı
 * (kaydetAsama). Müşterinin panelindeki çizelge de böylece "serviste" der.
 */
import { prisma } from '@/lib/prisma';
import { kaydetAsama } from '@/lib/ticket-asama';
import { sahaKarari, type SahaHataKodu, type SahaKisisi } from '@/lib/saha-suresi';

export interface SahaHali {
  status: string;
  varisAt: Date | null;
  ayrilisAt: Date | null;
  assignedUserId: string | null;
}

export type SahaSonucu =
  | { durum: 'TAMAM'; degisti: boolean; fis: SahaHali }
  | { durum: 'YOK' }
  | { durum: 'HATA'; kod: SahaHataKodu; http: number };

const HAL = { status: true, varisAt: true, ayrilisAt: true, assignedUserId: true } as const;

export async function sahaIslemi(
  tenantId: string,
  ticketId: string,
  kisi: SahaKisisi,
  islem: string,
  simdi: Date = new Date(),
): Promise<SahaSonucu> {
  const kapsam = { id: ticketId, tenantId, deletedAt: null };
  const fis = await prisma.serviceTicket.findFirst({
    where: kapsam,
    select: HAL,
  });
  if (!fis) return { durum: 'YOK' };

  const k = sahaKarari({ ...fis, status: String(fis.status) }, islem, kisi, simdi);
  if (k.tur === 'HATA') return { durum: 'HATA', kod: k.kod, http: k.durum };
  const yeniHal = async (): Promise<SahaHali> => {
    const h = await prisma.serviceTicket.findFirst({ where: kapsam, select: HAL });
    return h ? { ...h, status: String(h.status) } : { ...fis, status: String(fis.status) };
  };
  if (k.tur === 'AYNI') return { durum: 'TAMAM', degisti: false, fis: await yeniHal() };

  // Kararın dayandığı hâl: arada başka bir basış yazdıysa bu yazım boşa düşer.
  const sart =
    islem === 'ustlen' ? { assignedUserId: null }
    : islem === 'vardim' ? { varisAt: null }
      : islem === 'ciktim' ? { varisAt: { not: null }, ayrilisAt: null }
        : 'ayrilisAt' in k.alanlar ? { ayrilisAt: { not: null } }
          : { varisAt: { not: null }, ayrilisAt: null };
  const yazim = await prisma.serviceTicket.updateMany({ where: { ...kapsam, ...sart }, data: k.alanlar });
  if (yazim.count === 0) {
    const h = await yeniHal();
    // Üstlenme yarışını başkası kazandıysa söylenir: "aldım" sanıp sahaya çıkmasın.
    if (islem === 'ustlen' && h.assignedUserId !== kisi.id) return { durum: 'HATA', kod: 'SAHA_ZATEN_ATANMIS', http: 409 };
    return { durum: 'TAMAM', degisti: false, fis: h };
  }

  if (k.serviseAl) {
    // Yalnız hâlâ "Yeni"yse: bu arada biri başka duruma aldıysa ona dokunulmaz.
    const d = await prisma.serviceTicket.updateMany({
      where: { ...kapsam, status: 'NEW' },
      data: { status: 'IN_SERVICE', statusUpdatedAt: simdi },
    });
    if (d.count) {
      await kaydetAsama({
        tenantId, ticketId, status: 'IN_SERVICE', oncekiStatus: 'NEW',
        changedByUserId: kisi.id, kaynak: 'PANEL',
      });
    }
  }
  return { durum: 'TAMAM', degisti: true, fis: await yeniHal() };
}
