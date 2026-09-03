// MÜŞTERİ BAKİYESİ — TEK GERÇEK.
//
// Sistemde borç İKİ ayrı yerde birikiyor ve bu bilinçli bir para-modeli kararı:
//   • Servis işleri      → AccountEntry (SALE/PAYMENT)      → elle + servis fişi
//   • Kira / sayaç        → CustomerInvoice (totalAmount/paidAmount) → aylık otomatik
// İki havuz ÇAKIŞMAZ (servis ayrı kalem, kira ayrı kalem), ama bugüne kadar
// hiçbir ekran ikisini toplamıyordu: Muhasebe yalnız servisi, Faturalar yalnız
// kirayı gösteriyordu. Bayi "bu müşteri bana TOPLAM ne kadar borçlu?" diye
// sorduğunda tek sayı yoktu — "cari anlamıyorum"un kaynağı buydu.
//
// Bu dosya o iki havuzu YALNIZ OKUMADA toplar. Yazma yolları (fiş ödemesi,
// fatura kesme, elle giriş) hiç değişmez; burada tek bir "toplam borç" ve tek
// bir tarih-sıralı ekstre üretilir.

import { prisma } from '@/lib/prisma';
import { InvoiceStatus } from '@prisma/client';

// Faturada "hâlâ borç" sayılan durumlar. DRAFT henüz kesilmemiştir,
// CANCELLED iptal, PAID kapanmıştır — üçü de açık borç değildir.
const ACIK_FATURA: InvoiceStatus[] = ['OPEN', 'PARTIAL', 'OVERDUE'];

export type BakiyeSatiri = {
  id: string;
  kaynak: 'SERVIS' | 'FATURA';
  tip: 'BORC' | 'ODEME';        // BORC = müşteriyi borçlandıran, ODEME = düşen
  aciklama: string;
  tutar: number;                // her zaman pozitif
  tarih: string;                // ISO
  detay?: string | null;        // yöntem / dönem / fiş no
};

export type MusteriBakiye = {
  customerId: string;
  servisBorc: number;   // AccountEntry: SALE - PAYMENT
  faturaBorc: number;   // CustomerInvoice: Σ(total - paid), yalnız açık durumlar
  toplamBorc: number;   // ikisinin toplamı — EKRANDA GÖSTERİLEN GERÇEK
};

/**
 * Tüm müşterilerin birleşik bakiyesi — customerId → MusteriBakiye.
 * Borçsuz müşteri de haritada olur (toplamBorc 0), çağıran filtreler.
 */
export async function tumBakiyeler(tenantId: string): Promise<Map<string, MusteriBakiye>> {
  const [entries, invoices] = await Promise.all([
    prisma.accountEntry.groupBy({
      by: ['customerId', 'type'],
      where: { tenantId },
      _sum: { amount: true },
    }),
    prisma.customerInvoice.findMany({
      where: { tenantId, deletedAt: null, status: { in: ACIK_FATURA } },
      select: { customerId: true, totalAmount: true, paidAmount: true },
    }),
  ]);

  const harita = new Map<string, MusteriBakiye>();
  const al = (id: string) => {
    let b = harita.get(id);
    if (!b) { b = { customerId: id, servisBorc: 0, faturaBorc: 0, toplamBorc: 0 }; harita.set(id, b); }
    return b;
  };

  for (const g of entries) {
    const b = al(g.customerId);
    const tutar = Number(g._sum.amount ?? 0);
    if (g.type === 'SALE') b.servisBorc += tutar;
    else b.servisBorc -= tutar;
  }
  for (const inv of invoices) {
    const b = al(inv.customerId);
    b.faturaBorc += Number(inv.totalAmount) - Number(inv.paidAmount);
  }

  for (const b of harita.values()) {
    b.servisBorc = Math.round(b.servisBorc * 100) / 100;
    b.faturaBorc = Math.round(b.faturaBorc * 100) / 100;
    b.toplamBorc = Math.round((b.servisBorc + b.faturaBorc) * 100) / 100;
  }
  return harita;
}

/** Tek müşterinin birleşik bakiyesi. */
export async function bakiye(tenantId: string, customerId: string): Promise<MusteriBakiye> {
  const hepsi = await tumBakiyeler(tenantId);
  return hepsi.get(customerId) ?? { customerId, servisBorc: 0, faturaBorc: 0, toplamBorc: 0 };
}

/**
 * Tek müşterinin birleşik EKSTRESİ — servis kalemleri + fatura kalemleri,
 * tarihe göre (yeniden eskiye). Bayi "bu müşteriyle aramda ne oldu"yu tek
 * listede görür.
 */
export async function ekstre(tenantId: string, customerId: string): Promise<BakiyeSatiri[]> {
  const [entries, invoices] = await Promise.all([
    prisma.accountEntry.findMany({
      where: { tenantId, customerId },
      select: { id: true, type: true, product: true, amount: true, method: true, notes: true, date: true },
    }),
    // DRAFT ve CANCELLED ekstrede de GÖRÜNMEZ. Taslak henüz kesilmemiş bir
    // faturadır; ekstrede gösterip bakiyeye katmamak, ekstre toplamı ile
    // bakiyenin tutmaması demekti (test bunu yakaladı: fark tam taslak tutarı).
    // Ekstre ile bakiye AYNI faturaları görmek zorunda.
    prisma.customerInvoice.findMany({
      where: { tenantId, customerId, deletedAt: null, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      select: { id: true, invoiceNumber: true, period: true, totalAmount: true, paidAmount: true, invoiceDate: true, status: true },
    }),
  ]);

  const satirlar: BakiyeSatiri[] = [];

  for (const e of entries) {
    satirlar.push({
      id: e.id,
      kaynak: 'SERVIS',
      tip: e.type === 'SALE' ? 'BORC' : 'ODEME',
      aciklama: e.product || (e.type === 'SALE' ? 'Servis / satış' : 'Tahsilat'),
      tutar: Number(e.amount),
      tarih: e.date.toISOString(),
      detay: e.notes,
    });
  }

  for (const inv of invoices) {
    // Fatura kesimi = borç. Ödenen kısım ayrı bir ODEME satırı olarak görünür ki
    // "ne kadarını ödedi" ekstrede okunabilsin.
    satirlar.push({
      id: inv.id,
      kaynak: 'FATURA',
      tip: 'BORC',
      aciklama: `Kira/sayaç faturası · ${inv.period}`,
      tutar: Number(inv.totalAmount),
      tarih: inv.invoiceDate.toISOString(),
      detay: inv.invoiceNumber,
    });
    const odenen = Number(inv.paidAmount);
    if (odenen > 0) {
      satirlar.push({
        id: `${inv.id}-pay`,
        kaynak: 'FATURA',
        tip: 'ODEME',
        aciklama: `Fatura tahsilatı · ${inv.period}`,
        tutar: odenen,
        tarih: inv.invoiceDate.toISOString(),
        detay: inv.invoiceNumber,
      });
    }
  }

  satirlar.sort((a, b) => b.tarih.localeCompare(a.tarih));
  return satirlar;
}
