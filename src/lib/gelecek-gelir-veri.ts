/**
 * GELECEK GELİR — VERİTABANI KATMANI.
 *
 * Saf hesap src/lib/gelecek-gelir.ts'te. Burada dört sorgu var, 5.000
 * cihazlı bayide de dört: bayi fiyatı, sayfa ücretli cihazlar, aktif
 * sözleşmeler (cihaz bağlarıyla) ve son 3 ayın okuma özeti (tek GROUP BY;
 * pencereden önceki son okuma cihaz başına indeksle).
 *
 * Hangi cihaz? Faturanın kuralı (invoicing SAYFA_UCRETLI_CIHAZ): kiralık
 * cihazlar + kendi sayfa fiyatı girilmiş müşteri makineleri (kopya başı).
 * İkisi de her ay faturalanıyor; birini dışarıda bırakmak geliri eksik
 * gösterirdi.
 */
import { prisma } from '@/lib/prisma';
import { SAYFA_UCRETLI_CIHAZ } from '@/lib/invoicing';
import {
  EN_UZUN_UFUK, SAYFA_PENCERE_AY, UFUKLAR,
  aylikGelir, aylikSayfa, gelecekGelir, risktekiGelir, riskToplami, tahminAylari,
  type BirimTahmini, type GelirKalemi, type RiskSatiri, type RiskSozlesmesi, type SozlesmeBagi,
} from '@/lib/gelecek-gelir';

export interface GelecekGelirVerisi {
  olusturuldu: string;
  /** İlk tahmin ayı 'YYYY-AA'. */
  ilkAy: string;
  ufuklar: number[];
  /** Bayinin para birimi (boş durumda ve riskte varsayılan). */
  birim: string;
  birimler: BirimTahmini[];
  risk: RiskSatiri[];
  riskAylik: Record<string, number>;
  sozlesmeSayisi: number;
  /** Sayfa ücretli (kiralık ya da kopya başı) cihaz hiç yok. */
  bos: boolean;
}

const sayi = (v: unknown): number | null => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

export async function gelecekGelirVerisi(tenantId: string, simdi: Date = new Date()): Promise<GelecekGelirVerisi | null> {
  const bayi = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { currency: true, pricePerBlack: true, pricePerColor: true },
  });
  if (!bayi) return null;
  const birim = bayi.currency || 'TRY';
  const pencereBas = new Date(simdi);
  pencereBas.setMonth(pencereBas.getMonth() - SAYFA_PENCERE_AY);

  const [cihazlar, sozlesmeler, okumalar] = await Promise.all([
    prisma.device.findMany({
      where: { tenantId, ...SAYFA_UCRETLI_CIHAZ },
      select: {
        id: true, isRental: true, monthlyRent: true, pricePerBlack: true, pricePerColor: true,
        includedBlack: true, includedColor: true, overagePriceBlack: true, overagePriceColor: true,
      },
    }),
    prisma.contract.findMany({
      where: { tenantId, status: 'AKTIF' },
      select: {
        id: true, contractNo: true, customerId: true, startDate: true, endDate: true,
        noticeDays: true, autoRenew: true, escalationMonths: true, escalationRate: true, lastEscalationAt: true,
        customer: { select: { name: true } },
        devices: { select: { deviceId: true } },
      },
    }),
    prisma.$queryRaw<{ deviceId: string; siyah: number; renkli: number; ilk: Date; son: Date; onceki: Date | null }[]>`
      SELECT r."deviceId" AS "deviceId",
        SUM(r."deltaBlack")::float8 AS "siyah",
        SUM(r."deltaColor")::float8 AS "renkli",
        MIN(r."readingDate") AS "ilk",
        MAX(r."readingDate") AS "son",
        (SELECT MAX(o."readingDate") FROM "CounterReading" o
          WHERE o."tenantId" = ${tenantId} AND o."deviceId" = r."deviceId" AND o."readingDate" < ${pencereBas}) AS "onceki"
      FROM "CounterReading" r
      WHERE r."tenantId" = ${tenantId} AND r."readingDate" >= ${pencereBas} AND r."readingDate" <= ${simdi}
      GROUP BY r."deviceId"
    `,
  ]);

  const okuma = new Map(okumalar.map((o) => [o.deviceId, o]));

  // Cihaz birden çok aktif sözleşmede görünüyorsa EN GEÇ biteni: bayi o güne
  // kadar bağlı (ana paneldeki sözleşme uyarısıyla aynı kural).
  const bag = new Map<string, { s: (typeof sozlesmeler)[number] }>();
  for (const s of sozlesmeler) {
    for (const d of s.devices) {
      const v = bag.get(d.deviceId);
      if (!v || s.endDate > v.s.endDate || (s.endDate.getTime() === v.s.endDate.getTime() && s.startDate > v.s.startDate)) {
        bag.set(d.deviceId, { s });
      }
    }
  }
  const sozlesmeBagi = (s: (typeof sozlesmeler)[number]): SozlesmeBagi => {
    const oran = sayi(s.escalationRate);
    const ay = sayi(s.escalationMonths);
    return {
      id: s.id,
      bitis: s.endDate,
      otomatikYenileme: s.autoRenew,
      // Oran ya da aralık yoksa zam YOK (oran pazarlıkla belirlenecekse uydurulmaz).
      zam: oran !== null && oran > 0 && ay !== null && ay >= 1 ? { oran, ay, taban: s.lastEscalationAt ?? s.startDate } : null,
    };
  };

  const kalemler: GelirKalemi[] = cihazlar.map((c) => {
    const o = okuma.get(c.id);
    const hacim = aylikSayfa(o ? { siyah: Number(o.siyah), renkli: Number(o.renkli), ilk: o.ilk, son: o.son, onceki: o.onceki } : null);
    const g = aylikGelir(c, bayi, hacim);
    const b = bag.get(c.id);
    return { cihazId: c.id, birim, kira: g.kira, sayfa: g.sayfa, sozlesme: b ? sozlesmeBagi(b.s) : null };
  });

  const riskSozlesmeleri: RiskSozlesmesi[] = sozlesmeler.map((s) => ({
    id: s.id, contractNo: s.contractNo, musteriId: s.customerId, musteri: s.customer?.name ?? '',
    bitis: s.endDate, noticeDays: s.noticeDays, otomatikYenileme: s.autoRenew,
    cihazIdleri: s.devices.map((d) => d.deviceId),
  }));
  const risk = risktekiGelir(riskSozlesmeleri, kalemler, simdi, birim);

  return {
    olusturuldu: simdi.toISOString(),
    ilkAy: tahminAylari(simdi, 1)[0].anahtar,
    ufuklar: [...UFUKLAR],
    birim,
    birimler: gelecekGelir(kalemler, simdi, EN_UZUN_UFUK),
    risk,
    riskAylik: riskToplami(risk),
    sozlesmeSayisi: sozlesmeler.length,
    bos: cihazlar.length === 0,
  };
}
