/**
 * VADE HATIRLATMASI — vadesi geçen faturalar için müşteriye WhatsApp.
 *
 * ── ESKİ HÂLİ ─────────────────────────────────────────────────────────────
 * Vadesi geçen HER FATURA için HER GÜN ayrı mesaj gidiyordu: üç faturası
 * gecikmiş müşteri ödeyene kadar her sabah üç mesaj alırdı. Bütün bayiler tek
 * platform numarasından gönderdiği için bu, WhatsApp'ın numarayı spam diye
 * kısıtlaması demekti — bir bayinin ısrarı hepsinin kanalını kapatırdı.
 * Değişkenler de yanlıştı (üçüncüsü müşterinin kendi telefonuydu).
 *
 * ── ŞİMDİ ─────────────────────────────────────────────────────────────────
 * Müşteri başına TEK mesaj, toplam açık tutarla; aynı müşteriye en fazla 7
 * günde bir (bayinin elle attığı borç hatırlatması da sayılır). Gönderilemeyen
 * (Meta hatası) ertesi gün yeniden denenir. Şablon: lib/whatsapp-sablon.ts.
 * WhatsApp kurulu değilse kayıt PENDING kalır, "gitti" gibi görünmez.
 */
import { prisma } from '@/lib/prisma';
import { markOverdueInvoices } from '@/lib/invoicing';
import { sendOneWhatsApp, waConfigured } from '@/lib/whatsapp';
import { borcParametreleri } from '@/lib/whatsapp-sablon';
import { retListesi, son10 } from '@/lib/whatsapp-inbound';
import { fmtTLm } from '@/lib/reminders';

export const HATIRLATMA_ARALIGI_GUN = 7;
/** Hem otomatik hem bayinin elle gönderdiği borç hatırlatması bu önekle kaydedilir. */
export const BORC_KAYIT_ONEKI = 'Borç hatırlatma';

const SAAT = 3_600_000;

export async function vadeHatirlatmalari(simdi = new Date()) {
  const overdueCount = await markOverdueInvoices();
  const tenants = await prisma.tenant.findMany({
    // Yalnız bayinin açtığı (Ayarlar → WhatsApp hatırlatmaları). Demo: numaralar uydurma.
    where: { deletedAt: null, isActive: true, vadeHatirlatma: true, demo: false },
    select: { id: true, name: true },
  });

  let queued = 0, sent = 0, failed = 0, atlanan = 0;
  for (const t of tenants) {
    const faturalar = await prisma.customerInvoice.findMany({
      where: { tenantId: t.id, status: 'OVERDUE', deletedAt: null },
      select: { invoiceNumber: true, totalAmount: true, paidAmount: true, customerId: true, customer: { select: { name: true, phone: true } } },
      orderBy: { invoiceNumber: 'asc' },
    });
    // "DUR" yazmış numaralara hatırlatma gitmez (lib/whatsapp-inbound retUygula).
    const ret = await retListesi(t.id);
    // Müşteri başına topla: tek mesaj, toplam açık tutar.
    const musteriler = new Map<string, { ad: string; telefon: string; acik: number; faturalar: string[] }>();
    for (const f of faturalar) {
      if (!f.customerId || !f.customer?.phone || ret.has(son10(f.customer.phone))) continue;
      const acik = Number(f.totalAmount) - Number(f.paidAmount);
      if (acik < 0.01) continue;
      const m = musteriler.get(f.customerId) ?? { ad: f.customer.name, telefon: f.customer.phone, acik: 0, faturalar: [] };
      m.acik += acik;
      m.faturalar.push(f.invoiceNumber);
      musteriler.set(f.customerId, m);
    }

    for (const m of musteriler.values()) {
      const son = await prisma.notificationLog.findFirst({
        where: {
          tenantId: t.id, recipient: m.telefon, channel: 'WHATSAPP', message: { startsWith: BORC_KAYIT_ONEKI },
          OR: [
            // Gitmiş (ya da WhatsApp kurulu değilken bekleyen) hatırlatma: 7 gün sus.
            { status: { in: ['SENT', 'PENDING'] }, createdAt: { gte: new Date(simdi.getTime() - HATIRLATMA_ARALIGI_GUN * 24 * SAAT) } },
            // Gidemeyen: aynı gün tekrar deneme, ertesi gün dene.
            { createdAt: { gte: new Date(simdi.getTime() - 20 * SAAT) } },
          ],
        },
        select: { id: true },
      });
      if (son) { atlanan++; continue; }

      const tutar = fmtTLm(m.acik);
      const log = await prisma.notificationLog.create({
        data: {
          tenantId: t.id, recipient: m.telefon, channel: 'WHATSAPP', status: 'PENDING',
          message: `${BORC_KAYIT_ONEKI} (otomatik) — ${m.ad} · ${tutar} TL · ${m.faturalar.join(', ')}`.slice(0, 1000),
        },
      });
      queued++;
      if (!waConfigured()) continue;
      const r = await sendOneWhatsApp(m.telefon, borcParametreleri(m.ad, t.name, tutar), process.env.WHATSAPP_TEMPLATE);
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: r.ok ? 'SENT' : 'FAILED', sentAt: r.ok ? new Date() : null, error: r.ok ? null : (r.error ?? 'bilinmeyen hata'), waMessageId: r.ok ? (r.id ?? null) : null },
      }).catch(() => {});
      if (r.ok) sent++; else failed++;
    }
  }
  return { overdueCount, queued, sent, failed, atlanan };
}
