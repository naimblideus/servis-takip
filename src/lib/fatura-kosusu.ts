/**
 * DÖNEM FATURA KOŞUSU — bir bayinin bir dönemini baştan sona faturalar.
 * Gece işi (api/cron/generate-customer-invoices) ve elle "Dönemi Faturala"
 * (api/invoices) aynı fonksiyonu çağırır; eskiden iki ayrı kopyaydı.
 *
 * ── HATA ALAN MÜŞTERİ KAYBOLMAZ ──────────────────────────────────────────
 * Eskiden koşu, müşterilerden biri hata alsa da (zaman aşımı, kilit beklemesi,
 * bağlantı kopması) dönemi TAMAM işaretliyordu. Gece işi TAMAM dönemi bir daha
 * açmadığı için o müşteri hiç denenmiyor, okumaları kapanmış dönemde
 * faturalanmadan kalıyordu. Hata alma ihtimali en yüksek müşteri, en çok
 * cihazı olandır. Artık:
 *   · Hata varsa dönem TAMAM olmaz (HATA). Gece işi ertesi gün yeniden koşar;
 *     koşu idempotent — kesilmiş olan bir daha kesilmez, yalnız kalan kesilir.
 *   · Gece işi son üç kapanmış dönemden kapanmamış olanı da yeniden dener
 *     (ay dönse bile).
 *
 * ── KOŞU SIRASINDA GELEN OKUMA ───────────────────────────────────────────
 * Dönem TAMAM olana kadar o döneme düşen okuma o dönemle damgalanır. Müşterisi
 * az önce faturalanmışsa okuma kapanan dönemde faturasız kalırdı. Dönem
 * kapandıktan SONRA bir süpürme geçişi yapılır: o dönemde faturasız sayfası
 * kalan (ve taslağı beklemeyen) müşteriler bir kez daha faturalanır.
 */
import { prisma } from '@/lib/prisma';
import { donemFaturasiHazirla } from '@/lib/invoicing';
import { donemAraligi } from '@/lib/fatura-donemi';
import { kosuDonemiKapatir, kosuyuKaydet } from '@/lib/fatura-turu';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface KosuSonucu {
  period: string;
  invoices: number;
  total: number;
  errors: number;
  bekleyen: number;
  /** Dönem bu koşuyla kapandı mı (TAMAM) */
  kapandi: boolean;
}

type Sayac = { invoices: number; total: number; bekleyen: number; hatalar: { customerId: string; hata: string }[] };

async function musterileriFaturala(tenantId: string, customerIds: string[], period: string, s: Sayac): Promise<void> {
  for (const customerId of customerIds) {
    try {
      // Şüpheli / şoklu fatura (ya da bayi onayı açıksa hepsi) taslakta bekler.
      const r = await donemFaturasiHazirla(tenantId, customerId, period, { source: 'AUTO_MONTHLY' });
      if (r?.tur === 'KESILDI') {
        s.invoices++;
        s.total += Number(r.invoice.totalAmount);
      } else if (r?.tur === 'TASLAK') s.bekleyen++;
    } catch (e: unknown) {
      const mesaj = e instanceof Error ? e.message : String(e);
      s.hatalar.push({ customerId, hata: mesaj.slice(0, 300) });
      console.error(`FATURA KOSUSU HATASI tenant=${tenantId} customer=${customerId}:`, mesaj);
    }
  }
}

/**
 * Dönemde faturasız SAYFASI kalan müşteriler (taslağı bekleyenler hariç).
 * Okumanın müşterisi damgalıysa o, değilse cihazın şimdiki müşterisi.
 */
export async function faturasizKalanMusteriler(tenantId: string, period: string): Promise<string[]> {
  const { start, end } = donemAraligi(period);
  const satirlar = await prisma.$queryRaw<{ customerId: string }[]>`
    SELECT DISTINCT COALESCE(r."customerId", d."customerId") AS "customerId"
    FROM "CounterReading" r
    JOIN "Device" d ON d."id" = r."deviceId"
    WHERE r."tenantId" = ${tenantId} AND r."billed" = false
      AND (r."deltaBlack" > 0 OR r."deltaColor" > 0)
      AND (d."isRental" OR d."pricePerBlack" IS NOT NULL OR d."pricePerColor" IS NOT NULL)
      AND (r."faturaDonemi" = ${period} OR (r."faturaDonemi" IS NULL AND r."readingDate" >= ${start} AND r."readingDate" < ${end}))
  `;
  if (satirlar.length === 0) return [];
  const bekleyen = new Set(
    (await prisma.faturaTaslagi.findMany({ where: { tenantId, period, durum: 'BEKLIYOR' }, select: { customerId: true } })).map((t) => t.customerId),
  );
  return satirlar.map((x) => x.customerId).filter((id) => !bekleyen.has(id));
}

export async function bayiDoneminiFaturala(
  tenantId: string,
  period: string,
  kaynak: 'CRON' | 'ELLE',
  kesim: number,
): Promise<KosuSonucu> {
  const customers = await prisma.customer.findMany({ where: { tenantId }, select: { id: true } });
  const s: Sayac = { invoices: 0, total: 0, bekleyen: 0, hatalar: [] };
  await musterileriFaturala(tenantId, customers.map((c) => c.id), period, s);

  // Kapanmış ayı faturalamak dönemi kapatır (geç okumalar sonraki aya kayar);
  // açık ayı ayın ortasında faturalamak ara faturadır, dönem açık kalır.
  // Hata varsa dönem KAPANMAZ: gece işi ertesi gün yeniden dener.
  const kapat = kosuDonemiKapatir(period, kesim) && s.hatalar.length === 0;
  try {
    await kosuyuKaydet(tenantId, period, kaynak,
      { faturaSayisi: s.invoices, toplam: round2(s.total), hataSayisi: s.hatalar.length, hatalar: s.hatalar }, kapat);
  } catch (e: unknown) {
    console.error(`FATURA TURU KAYIT HATASI tenant=${tenantId}:`, e instanceof Error ? e.message : e);
  }

  // Süpürme: dönem kapandıktan sonra o döneme yeni okuma düşemez; koşu
  // sırasında düşmüş olanlar burada faturalanır.
  if (kapat) {
    const kalan = await faturasizKalanMusteriler(tenantId, period).catch(() => [] as string[]);
    if (kalan.length) {
      const ek: Sayac = { invoices: 0, total: 0, bekleyen: 0, hatalar: [] };
      await musterileriFaturala(tenantId, kalan, period, ek);
      if (ek.invoices || ek.hatalar.length) {
        await kosuyuKaydet(tenantId, period, kaynak,
          { faturaSayisi: ek.invoices, toplam: round2(ek.total), hataSayisi: ek.hatalar.length, hatalar: ek.hatalar }, true).catch(() => {});
      }
      s.invoices += ek.invoices;
      s.total += ek.total;
      s.bekleyen += ek.bekleyen;
      s.hatalar.push(...ek.hatalar);
    }
  }

  return { period, invoices: s.invoices, total: round2(s.total), errors: s.hatalar.length, bekleyen: s.bekleyen, kapandi: kapat };
}
