// Sıfır-dokunuş muhasebe çekirdeği
// Tek kaynak fatura üretici + FIFO tahsilat mahsubu.
// Kullanıcı hiç hesap/onay yapmaz; bu modül olay-tetikli + cron ile çalışır.
import { prisma } from '@/lib/prisma';
import {
  Prisma,
  PaymentMethod,
  InvoiceLineKind,
  InvoiceSource,
} from '@prisma/client';
import { ayCarpani, donemAraligi, donemOf, donemOkumaKosulu } from '@/lib/fatura-donemi';
import { bekletmeGerekceleri, type CihazOzeti, type Gerekce } from '@/lib/fatura-bekletme';

type Tx = Prisma.TransactionClient;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

type PriceDevice = {
  pricePerBlack: unknown;
  pricePerColor: unknown;
  includedBlack?: number | null;
  includedColor?: number | null;
  overagePriceBlack?: unknown;
  overagePriceColor?: unknown;
};
type PriceTenant = { pricePerBlack: unknown; pricePerColor: unknown };

/** Cihazın efektif SAYFA fiyatları: cihaz bazlı > tenant varsayılanı. */
export function effectivePrices(device: PriceDevice, tenant: PriceTenant) {
  const black = device.pricePerBlack != null ? Number(device.pricePerBlack) : Number(tenant.pricePerBlack);
  const color = device.pricePerColor != null ? Number(device.pricePerColor) : Number(tenant.pricePerColor);
  return { black, color };
}

/**
 * AŞIM fiyatları: dahil paketi aşan sayfalar bu fiyattan faturalanır.
 *   cihazın aşım fiyatı > cihazın sayfa fiyatı > bayi varsayılanı
 *
 * BU ALAN OKUNMUYORDU. Cihaz kartında ve Toplu Zam ekranında "Aşım (S/B)"
 * diye ayarlanabiliyordu ama faturalama her zaman sayfa fiyatını
 * kullanıyordu: "dahil 1.000 sayfa, aşımı ₺0,60" diye anlaşan bayi aşan
 * sayfaları ₺0,42'den faturalıyordu ve bunu hiçbir ekran söylemiyordu.
 * Alan boşken davranış AYNI (sayfa fiyatına düşüyor) — yani mevcut
 * verinin faturası değişmiyor, alan doldurulunca çalışmaya başlıyor.
 */
export function overagePrices(device: PriceDevice, tenant: PriceTenant) {
  const sayfa = effectivePrices(device, tenant);
  return {
    black: device.overagePriceBlack != null ? Number(device.overagePriceBlack) : sayfa.black,
    color: device.overagePriceColor != null ? Number(device.overagePriceColor) : sayfa.color,
  };
}

/**
 * Kademeli sayaç ücreti (dahil paket + aşım). dahil sayfa kira içinde (ücretsiz),
 * aşan kısım birim fiyattan faturalanır. includedBlack/Color=0 ise klasik düz fiyat.
 *
 * prevBlack/prevColor = bu dönemde DAHA ÖNCE faturalanmış sayfa adedi. Dahil paket dönem
 * boyunca KÜMÜLATİF tek kez uygulanır; aynı dönemde ikinci kesimde mükerrer indirim olmaz
 * (marjinal aşım = kümülatif aşım − önceki aşım).
 */
export function counterOverage(
  device: PriceDevice, sumBlack: number, sumColor: number, tenant: PriceTenant,
  prevBlack = 0, prevColor = 0
) {
  const inclB = device.includedBlack ?? 0;
  const inclC = device.includedColor ?? 0;
  // Aşan sayfalar AŞIM fiyatından: sözleşmede ayrı bir aşım bedeli
  // konuşulduysa fatura onu kullanmalı.
  const { black, color } = overagePrices(device, tenant);
  const billB = Math.max(0, (prevBlack + sumBlack) - inclB) - Math.max(0, prevBlack - inclB);
  const billC = Math.max(0, (prevColor + sumColor) - inclC) - Math.max(0, prevColor - inclC);
  return {
    inclB, inclC, billB, billC, overBlack: black, overColor: color,
    blackTotal: round2(billB * black),
    colorTotal: round2(billC * color),
    total: round2(billB * black + billC * color),
  };
}

/**
 * ── OKUNMAYAN AY FAZLA FATURA ÜRETMEZ ─────────────────────────────────────
 * Eylül'de sayaç hiç okunmadıysa Eylül faturasında sayaç satırı yoktu (yalnız
 * kira). Ekim okuması iki ayın sayfasını taşır ama dahil paket TEK ay
 * uygulanıyordu: "ayda 1.000 dahil" anlaşmasında 2.500 sayfa için 1.500 aşım
 * kesiliyordu, doğrusu 500. Müşteri fazla ödüyordu ve itiraz ettiğinde haklıydı.
 *
 * Çarpan = son faturalanmış sayaç dönemi ile bu dönem arasındaki ay sayısı
 * (lib/fatura-donemi ayCarpani, 1..12). Renkli kanal ayrı sayılır: e-posta
 * raporunda renkli sayaç yoksa son değer taşınır (renkliOlculdu=false); o
 * aylar renkli için "okunmamış" sayılır, renkli sayfalar gelince paketi de gelir.
 */
export type AyCarpani = { siyah: number; renkli: number };

/** Cihazların bu dönem için dahil paket çarpanları — tek sorgu (N+1 yok). */
export async function sayacAyCarpanlari(
  db: Pick<Tx, '$queryRaw'>,
  tenantId: string,
  deviceIds: string[],
  period: string,
): Promise<Map<string, AyCarpani>> {
  const harita = new Map<string, AyCarpani>();
  if (deviceIds.length === 0) return harita;
  // Dönem: damga varsa damga, yoksa okumanın İstanbul ayı (fatura-donemi ile aynı kural).
  const satirlar = await db.$queryRaw<{ deviceId: string; son: string | null; sonRenkli: string | null }[]>`
    SELECT "deviceId",
      MAX(donem) FILTER (WHERE donem < ${period}) AS "son",
      MAX(donem) FILTER (WHERE donem < ${period} AND "renkliOlculdu") AS "sonRenkli"
    FROM (
      SELECT "deviceId", "renkliOlculdu",
        COALESCE("faturaDonemi", to_char("readingDate" + interval '3 hours', 'YYYY-MM')) AS donem
      FROM "CounterReading"
      WHERE "tenantId" = ${tenantId} AND "deviceId" = ANY(${deviceIds}) AND "billed" = true
    ) r
    GROUP BY "deviceId"
  `;
  for (const s of satirlar) harita.set(s.deviceId, { siyah: ayCarpani(s.son, period), renkli: ayCarpani(s.sonRenkli, period) });
  return harita;
}

/** Dahil paketi çarpanla genişletilmiş cihaz (counterOverage'a verilir). */
export function dahilCarpanli<T extends PriceDevice>(d: T, k: AyCarpani | undefined): T {
  if (!k || (k.siyah === 1 && k.renkli === 1)) return d;
  return { ...d, includedBlack: (d.includedBlack ?? 0) * k.siyah, includedColor: (d.includedColor ?? 0) * k.renkli };
}

/**
 * ── SAYFA BAŞI ÜCRETLİ Mİ ─────────────────────────────────────────────────
 * İki durumda sayfa faturalanır:
 *   • kiralık cihaz (kira + dahil paket + aşım), ya da
 *   • cihaz kartında KENDİ sayfa fiyatı girilmiş müşteri makinesi — kopya
 *     başı servis anlaşması (makine müşterinin, toner+servis sayfa başına).
 *
 * SESSİZ SAYAÇ YANMASI (kapatıldı): aylık fatura müşterinin BÜTÜN
 * cihazlarının okumalarını "faturalandı" diye kapatıyor ama ücreti yalnız
 * kiralık cihaz için hesaplıyordu. Karma parkta (aynı müşteride kiralık +
 * anlaşmalı müşteri makinesi) anlaşmalı makinenin sayfaları hiç
 * faturalanmadan kapanıyor, sonraki ay da geri gelmiyordu — iz bırakmadan.
 * Artık ücretli olmayan cihazın okuması kapatılmıyor, anlaşmalı müşteri
 * makinesi kendi fiyatıyla faturalanıyor.
 *
 * Bayinin GENEL varsayılan sayfa fiyatı müşteri makinesine UYGULANMAZ:
 * uygulansaydı tamire gelen her makine sayfa başı faturalanırdı. Anlaşma
 * cihaz kartına fiyat yazılınca başlar.
 */
export function sayfaUcretliMi(d: { isRental: boolean; pricePerBlack: unknown; pricePerColor: unknown }): boolean {
  return d.isRental || d.pricePerBlack != null || d.pricePerColor != null;
}

/**
 * Veritabanı süzgeci olarak aynı kural: sayfa başı ücretli (faturalı) cihaz.
 * Kaçan Gelir ve abonelik cihaz sayımı buradan okur — kural tek yerde.
 */
export const SAYFA_UCRETLI_CIHAZ = {
  OR: [{ isRental: true }, { pricePerBlack: { not: null } }, { pricePerColor: { not: null } }],
} satisfies Prisma.DeviceWhereInput;

/** Fiyat tabanı: kiralıkta bayi varsayılanı; müşteri makinesinde varsayılan yok (girilmeyen kanal ücretsiz). */
export function fiyatTabani(d: { isRental: boolean }, tenant: PriceTenant): PriceTenant {
  return d.isRental ? tenant : { pricePerBlack: 0, pricePerColor: 0 };
}

/**
 * Bir anın takvim ayı: "YYYY-MM" — İSTANBUL saatiyle. Eskiden sunucunun
 * saat dilimini kullanıyordu (canlıda UTC): İstanbul'da ayın 1'i gece
 * 00:00–03:00 arası hâlâ geçen ay sayılıyordu. Kural lib/fatura-donemi'de.
 */
export function periodOf(date: Date = new Date()): string {
  return donemOf(date);
}

interface LineInput {
  tenantId: string;
  kind: InvoiceLineKind;
  description: string;
  deviceId?: string | null;
  readingId?: string | null;
  ticketId?: string | null;
  partId?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Sayaç satırında UYGULANAN dahil sayfa (çarpanlı) — fatura eki bunu gösterir */
  dahilSayfa?: number | null;
  /** Dahil paket kaç aylık uygulandı (okunmayan ay varsa >1) */
  ayCarpani?: number | null;
}

/**
 * KİRA BU DÖNEM KESİLİR Mİ — fatura, dönem kesimi ve Kaçan Gelir'in ortak kuralı.
 *
 * Cihazın `lastInvoicedPeriod`u kirasının kesildiği SON dönemdir ('YYYY-AA';
 * metin karşılaştırması sıralı). Eskiden kural "son dönem bu dönem değilse"
 * idi: geçmiş bir dönemi kesmek ("2026-07 dönemini kes") her kiralık cihaza
 * o ayın kirasını İKİNCİ kez yazıyor, işareti de geriye çekip bu ayın kirasını
 * yeniden "kesilmemiş" gösteriyordu. Doğrusu: yalnız işaretten SONRAKİ dönem
 * kesilir, işaret asla geri gitmez (kiraIsaretiKosulu).
 *
 * Cihaz dönem bittikten sonra kurulduysa o dönemin kirası yoktur.
 */
export type KiraCihazi = {
  isRental: boolean;
  monthlyRent: unknown;
  lastInvoicedPeriod: string | null;
  createdAt?: Date | null;
};

export function kiraKesilir(d: KiraCihazi, period: string, donemSonu?: Date): boolean {
  if (!d.isRental || !(Number(d.monthlyRent) > 0)) return false;
  if ((d.lastInvoicedPeriod ?? '') >= period) return false;
  if (donemSonu && d.createdAt && d.createdAt >= donemSonu) return false;
  return true;
}

/** updateMany koşulu: işaret yalnız ileri gider (eşzamanlı iki kesimde de). */
export const kiraIsaretiKosulu = (period: string) => ({
  OR: [{ lastInvoicedPeriod: null }, { lastInvoicedPeriod: { lt: period } }],
});

/** Fatura toplamları — kesilen fatura ve taslak AYNI hesaptan. */
export function faturaToplami(lines: { lineTotal: number }[], vatRate: number) {
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const vatAmount = round2((subtotal * vatRate) / 100);
  return { subtotal, vatAmount, totalAmount: round2(subtotal + vatAmount) };
}

/** Per-tenant atomik fatura numarası: SF-FAT-2026-00001 */
async function nextInvoiceNumber(tx: Tx, tenantId: string): Promise<string> {
  const t = await tx.tenant.update({
    where: { id: tenantId },
    data: { nextInvoiceSeq: { increment: 1 } },
    select: { nextInvoiceSeq: true },
  });
  const year = donemOf(new Date()).slice(0, 4); // İstanbul yılı (yılbaşı gecesi UTC hâlâ eski yıl)
  return `SF-FAT-${year}-${String(t.nextInvoiceSeq).padStart(5, '0')}`;
}

/**
 * Faturayı + satırları + LOGO kuyruğunu oluşturur.
 * NAKİT-ESASLI: Gelir burada YAZILMAZ; tahsilat anında (allocatePayment) yazılır.
 * Fatura yalnızca cari borç/alacak belgesidir. Faturalanacak satır yoksa null döner.
 */
async function postInvoice(
  tx: Tx,
  params: {
    tenantId: string;
    customerId: string;
    period: string;
    source: InvoiceSource;
    lines: LineInput[];
  }
) {
  const { tenantId, customerId, period, source, lines } = params;
  if (lines.length === 0) return null;

  const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant bulunamadı');

  const vatRate = Number(tenant.vatRate);
  const { subtotal, vatAmount, totalAmount } = faturaToplami(lines, vatRate);

  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate.getTime() + tenant.paymentTermDays * 86400000);
  const invoiceNumber = await nextInvoiceNumber(tx, tenantId);

  const invoice = await tx.customerInvoice.create({
    data: {
      tenantId,
      customerId,
      invoiceNumber,
      period,
      invoiceDate,
      dueDate,
      status: 'OPEN',
      subtotal,
      vatRate,
      vatAmount,
      totalAmount,
      paidAmount: 0,
      source,
    },
  });

  await tx.invoiceLine.createMany({
    data: lines.map((l) => ({
      tenantId,
      invoiceId: invoice.id,
      kind: l.kind,
      description: l.description,
      deviceId: l.deviceId ?? null,
      readingId: l.readingId ?? null,
      ticketId: l.ticketId ?? null,
      partId: l.partId ?? null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      dahilSayfa: l.dahilSayfa ?? null,
      ayCarpani: l.ayCarpani ?? null,
    })),
  });

  // Gelir burada YAZILMAZ (nakit-esaslı). Gelir tahsilat anında allocatePayment'ta yazılır.

  // LOGO/e-Fatura senkron kuyruğu
  await tx.logoSyncLog.create({
    data: {
      tenantId,
      operation: 'customer_invoice_create',
      entityType: 'invoice',
      entityId: invoice.id,
      direction: 'export',
      status: 'pending',
    },
  });

  return invoice;
}

/**
 * MÜŞTERİ FATURA KİLİDİ — işlemin İLK ifadesi olmak zorunda.
 * "Bu Dönemi Faturala" aynı anda iki sekmeden / iki yöneticiden (ya da
 * herkese açık demoda) basılınca her işlem okumaları ve kira işaretini
 * ötekinin yazmasından ÖNCE okuyordu: dönemde müşteri başına 3 fatura,
 * kira ve aşım 3 kez kesildi. Kilit işlem bitene kadar ikinciyi bekletir;
 * ikinci, birincinin billed / lastInvoicedPeriod / invoiceId işaretlerini
 * görür, satır çıkmaz, null döner. Bu yüzden bütün okumalar kilitten SONRA.
 * Anahtar dönemsiz (bayi + müşteri): iş emri satırları döneme bağlı değil;
 * aynı müşteride iki FARKLI dönem aynı anda kesilirse (gece işi Eylül'ü,
 * yönetici Ekim'i) aynı fiş iki faturaya girerdi. Taslak da aynı kilitle
 * yazılır ve kesilir.
 */
async function musteriFaturaKilidi(tx: Tx, tenantId: string, customerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${`fatura:${customerId}`}))`;
}

/**
 * Kilit beklemesi işlem süresine sayılır: öndeki müşterinin faturası çok
 * cihazlıysa bekleyen işlem varsayılan 5 sn'de boşuna düşmesin. Bekleyen
 * işlemler bağlantı tuttuğu için havuzdan bağlantı alma süresi de uzun.
 */
const FATURA_ISLEMI = { timeout: 30_000, maxWait: 10_000 } as const;

/** Bir dönem faturasının hesabı — veritabanına HİÇBİR ŞEY yazmaz. */
interface FaturaHesabi {
  tenant: Prisma.TenantGetPayload<object>;
  customerId: string;
  period: string;
  lines: LineInput[];
  readingIdsToBill: string[];
  deviceRentToMark: string[];
  ticketIdsToMark: string[];
  /** Sayaç satırı olan cihazlar — bekletme kuralları buna bakar */
  cihazlar: CihazOzeti[];
}

/**
 * Bir müşterinin dönem faturasını HESAPLAR (kilit içinde çağrılır):
 *  - Faturalanmamış sayaç okumaları (mono/renkli delta × birim fiyat)
 *  - Sabit aylık kira (dönem başına 1 kez)
 *  - Teslim edilmiş, faturalanmamış iş emirleri (parça + işçilik)
 * Kesmek ayrı adım (faturaKes): taslakta bekleyen fatura hiçbir işareti
 * değiştirmez, kesilirken hesap yeniden yapılır.
 */
async function faturaHesapla(tx: Tx, tenantId: string, customerId: string, period: string): Promise<FaturaHesabi> {
  // Kira kuralı dönem sonuna bakar (dönemden sonra kurulan cihazın o ayın
  // kirası yok). Okumalar ise DÖNEM DAMGASIYLA seçilir (donemOkumaKosulu):
  // kesim günü 3 olan bayide 1 Kasım'da gelen rapor Ekim'in okumasıdır.
  const { end } = donemAraligi(period);
  const donemdeki = donemOkumaKosulu(period);

  const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant bulunamadı');

  const lines: LineInput[] = [];
  const readingIdsToBill: string[] = [];
  const deviceRentToMark: string[] = [];
  const cihazlar: CihazOzeti[] = [];

  const devices = await tx.device.findMany({ where: { tenantId, customerId } });
  // Okunmayan ayların dahil paketi (tek sorgu): bkz. sayacAyCarpanlari.
  const carpanlar = await sayacAyCarpanlari(tx, tenantId, devices.filter(sayfaUcretliMi).map((d) => d.id), period);

  for (const device of devices) {
    // a) Faturalanmamış sayaç okumaları (bu dönem) — YALNIZ sayfa başı
    // ücretli cihazda. Ücretsiz cihazın okuması "faturalandı" diye
    // kapatılmaz (bkz. sayfaUcretliMi: sessiz sayaç yanması).
    if (sayfaUcretliMi(device)) {
      const readings = await tx.counterReading.findMany({
        where: { tenantId, deviceId: device.id, billed: false, ...donemdeki },
      });
      let sumBlack = 0;
      let sumColor = 0;
      let supheli = 0;
      for (const r of readings) {
        sumBlack += r.deltaBlack;
        sumColor += r.deltaColor;
        if (r.supheli) supheli++;
        readingIdsToBill.push(r.id);
      }
      // Dahil paketi dönem boyunca KÜMÜLATİF uygula: bu dönemde daha önce faturalanmış sayfaları çek
      const prevAgg = await tx.counterReading.aggregate({
        where: { tenantId, deviceId: device.id, billed: true, ...donemdeki },
        _sum: { deltaBlack: true, deltaColor: true },
      });
      // Kademeli: dahil sayfa kira içinde; yalnız aşım faturalanır (included=0 ise düz fiyat).
      // Okunmayan ay varsa dahil paket o kadar ay uygulanır (dahilCarpanli).
      const k = carpanlar.get(device.id) ?? { siyah: 1, renkli: 1 };
      const ch = counterOverage(dahilCarpanli(device, k), sumBlack, sumColor, fiyatTabani(device, tenant), prevAgg._sum.deltaBlack ?? 0, prevAgg._sum.deltaColor ?? 0);
      const fmtN = (n: number) => n.toLocaleString('tr-TR');
      const ayEki = (n: number) => (n > 1 ? ` (${n} ay)` : '');
      // Müşteri makinesinde fiyatı girilmemiş kanal (yalnız S/B anlaşması
      // yapılmış renkli makine gibi) ₺0'lık satır olarak faturaya düşmesin.
      const kanalVar = (tutar: number) => device.isRental || tutar > 0;
      let tutar = 0;
      if (ch.billB > 0 && kanalVar(ch.blackTotal)) {
        tutar += ch.blackTotal;
        lines.push({
          tenantId,
          kind: 'COUNTER',
          description: `Sayaç (S/B) — ${device.brand} ${device.model}${ch.inclB > 0 ? ` · ${fmtN(sumBlack)} okundu, ${fmtN(ch.inclB)} dahil${ayEki(k.siyah)}, ${fmtN(ch.billB)} aşım` : ''}`,
          deviceId: device.id,
          quantity: ch.billB,
          unitPrice: ch.overBlack,
          lineTotal: ch.blackTotal,
          dahilSayfa: ch.inclB,
          ayCarpani: k.siyah,
        });
      }
      if (ch.billC > 0 && kanalVar(ch.colorTotal)) {
        tutar += ch.colorTotal;
        lines.push({
          tenantId,
          kind: 'COUNTER',
          description: `Sayaç (Renkli) — ${device.brand} ${device.model}${ch.inclC > 0 ? ` · ${fmtN(sumColor)} okundu, ${fmtN(ch.inclC)} dahil${ayEki(k.renkli)}, ${fmtN(ch.billC)} aşım` : ''}`,
          deviceId: device.id,
          quantity: ch.billC,
          unitPrice: ch.overColor,
          lineTotal: ch.colorTotal,
          dahilSayfa: ch.inclC,
          ayCarpani: k.renkli,
        });
      }
      if (readings.length)
        cihazlar.push({
          deviceId: device.id,
          cihaz: `${device.brand} ${device.model}${device.serialNo ? ` · ${device.serialNo}` : ''}`,
          sayfa: sumBlack + sumColor,
          tutar: round2(tutar),
          carpan: k.siyah,
          supheli,
        });
    }

    // b) Sabit kira — dönem başına 1 kez; geçmiş dönem kesimi kirayı tekrar yazmaz (kiraKesilir)
    if (kiraKesilir(device, period, end)) {
      lines.push({
        tenantId,
        kind: 'RENTAL',
        description: `Aylık kira — ${device.brand} ${device.model}`,
        deviceId: device.id,
        quantity: 1,
        unitPrice: Number(device.monthlyRent),
        lineTotal: round2(Number(device.monthlyRent)),
      });
      deviceRentToMark.push(device.id);
    }
  }

  // c) Teslim edilmiş, faturalanmamış ve HENÜZ ÖDENMEMİŞ iş emirleri (parça + işçilik).
  // Fişten doğrudan ödenmiş (PAID) servisler gelirini ödeme anında yazdığı için
  // burada tekrar faturalanmaz (mükerrer gelir önlenir).
  // Cariye (AccountEntry) otomatik işlenmiş servis fişlerini aylık faturadan HARİÇ tut — çift sayım önle
  const cariRows = await tx.accountEntry.findMany({
    where: { tenantId, customerId, ticketId: { not: null } },
    select: { ticketId: true },
  });
  const cariTicketIds = cariRows.map((r) => r.ticketId).filter((x): x is string => !!x);

  const tickets = await tx.serviceTicket.findMany({
    where: {
      tenantId, customerId, status: 'DELIVERED', invoiceId: null, deletedAt: null, paymentStatus: 'UNPAID',
      ...(cariTicketIds.length ? { id: { notIn: cariTicketIds } } : {}),
    },
    include: { ticketParts: { include: { part: true } } },
  });
  const ticketIdsToMark: string[] = [];
  for (const t of tickets) {
    for (const tp of t.ticketParts) {
      lines.push({
        tenantId,
        kind: 'PART',
        description: `Parça: ${tp.part.name} (${t.ticketNumber})`,
        ticketId: t.id,
        partId: tp.partId,
        quantity: tp.quantity,
        unitPrice: Number(tp.unitPrice),
        lineTotal: round2(tp.quantity * Number(tp.unitPrice)),
      });
    }
    if (Number(t.laborCost) > 0) {
      lines.push({
        tenantId,
        kind: 'LABOR',
        description: `İşçilik (${t.ticketNumber})`,
        ticketId: t.id,
        quantity: 1,
        unitPrice: Number(t.laborCost),
        lineTotal: round2(Number(t.laborCost)),
      });
    }
    ticketIdsToMark.push(t.id);
  }

  return { tenant, customerId, period, lines, readingIdsToBill, deviceRentToMark, ticketIdsToMark, cihazlar };
}

/** Hesabı keser: fatura + satırlar + "faturalandı" işaretleri (aynı işlem). Satır yoksa null. */
async function faturaKes(tx: Tx, h: FaturaHesabi, source: InvoiceSource) {
  const { tenant, customerId, period } = h;
  const tenantId = tenant.id;
  const invoice = await postInvoice(tx, { tenantId, customerId, period, source, lines: h.lines });
  if (!invoice) return null;

  // Idempotency işaretleri — aynı transaction
  if (h.readingIdsToBill.length)
    await tx.counterReading.updateMany({ where: { id: { in: h.readingIdsToBill } }, data: { billed: true } });
  if (h.deviceRentToMark.length)
    await tx.device.updateMany({ where: { id: { in: h.deviceRentToMark }, ...kiraIsaretiKosulu(period) }, data: { lastInvoicedPeriod: period } });
  if (h.ticketIdsToMark.length)
    await tx.serviceTicket.updateMany({
      where: { id: { in: h.ticketIdsToMark } },
      data: { invoiceId: invoice.id, invoicedAt: invoice.invoiceDate },
    });
  return invoice;
}

/**
 * Bir müşterinin verilen dönemi için TEK fatura keser (idempotent), bekletme
 * kurallarına BAKMADAN. Faturalanacak bir şey yoksa null döner. Gece işi ve
 * "Dönem Faturala" bunu değil donemFaturasiHazirla'yı kullanır.
 */
export async function buildInvoiceForCustomerPeriod(
  tenantId: string,
  customerId: string,
  period: string = periodOf(),
  source: InvoiceSource = 'AUTO_MONTHLY'
) {
  return prisma.$transaction(async (tx) => {
    await musteriFaturaKilidi(tx, tenantId, customerId);
    const h = await faturaHesapla(tx, tenantId, customerId, period);
    return faturaKes(tx, h, source);
  }, FATURA_ISLEMI);
}

/**
 * ── TASLAK → KONTROL → KES ────────────────────────────────────────────────
 * Dönem faturasını hazırlar. Kesilir; ya da bekletme gerekçesi varsa
 * (lib/fatura-bekletme) veya bayi her faturayı önce görmek istiyorsa
 * (Tenant.faturaOnayi = ELLE) taslakta bekler. Taslak hiçbir işareti
 * değiştirmez: okumalar faturalanmamış, kira işareti yerinde kalır.
 *
 * `taslakId` verilirse bayi o taslağı onaylıyor demektir ("yine de kes"):
 * gerekçelere bakılmaz ama hesap kilit içinde YENİDEN yapılır. Toplam
 * taslaktakinden farklıysa (o arada okuma geldi, fiş teslim edildi) kesilmez;
 * taslak yeni rakamlarla güncellenir ve DEGISTI döner — bayi gördüğünden
 * başka bir tutarı onaylamış olmasın.
 */
export type HazirlamaSonucu =
  | { tur: 'KESILDI'; invoice: NonNullable<Awaited<ReturnType<typeof postInvoice>>> }
  | { tur: 'TASLAK'; taslakId: string; toplam: number; gerekceler: Gerekce[] }
  | { tur: 'DEGISTI'; taslakId: string; toplam: number }
  | null;

export async function donemFaturasiHazirla(
  tenantId: string,
  customerId: string,
  period: string,
  opts: { source?: InvoiceSource; taslakId?: string } = {},
): Promise<HazirlamaSonucu> {
  const source = opts.source ?? 'AUTO_MONTHLY';
  return prisma.$transaction(async (tx) => {
    await musteriFaturaKilidi(tx, tenantId, customerId);
    const bekleyen = await tx.faturaTaslagi.findFirst({ where: { tenantId, customerId, period, durum: 'BEKLIYOR' } });
    // Onaylanan taslak hâlâ bekliyor mu (başka sekmede kesildi / atıldı mı)?
    if (opts.taslakId && bekleyen?.id !== opts.taslakId) return null;

    const h = await faturaHesapla(tx, tenantId, customerId, period);
    if (h.lines.length === 0) {
      // Faturalanacak bir şey kalmadı (başka yoldan kesildi): taslak düşer.
      if (bekleyen) await tx.faturaTaslagi.update({ where: { id: bekleyen.id }, data: { durum: 'ATILDI' } });
      return null;
    }
    const { subtotal, totalAmount } = faturaToplami(h.lines, Number(h.tenant.vatRate));
    const onizleme = h.lines.map((l) => ({ kind: l.kind, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal }));

    if (opts.taslakId && bekleyen) {
      if (Math.abs(Number(bekleyen.toplam) - totalAmount) > 0.005) {
        const gerekceler = await bekletmeGerekceleri(tx, tenantId, period, h.cihazlar);
        await tx.faturaTaslagi.update({
          where: { id: bekleyen.id },
          data: { satirlar: onizleme, gerekceler, araToplam: subtotal, toplam: totalAmount },
        });
        return { tur: 'DEGISTI', taslakId: bekleyen.id, toplam: totalAmount };
      }
    } else {
      const gerekceler = await bekletmeGerekceleri(tx, tenantId, period, h.cihazlar);
      if (gerekceler.length > 0 || h.tenant.faturaOnayi === 'ELLE') {
        const veri = { satirlar: onizleme, gerekceler, araToplam: subtotal, toplam: totalAmount };
        const taslak = bekleyen
          ? await tx.faturaTaslagi.update({ where: { id: bekleyen.id }, data: veri })
          : await tx.faturaTaslagi.create({ data: { tenantId, customerId, period, ...veri } });
        return { tur: 'TASLAK', taslakId: taslak.id, toplam: totalAmount, gerekceler };
      }
    }

    const invoice = await faturaKes(tx, h, source);
    if (!invoice) return null;
    if (bekleyen) await tx.faturaTaslagi.update({ where: { id: bekleyen.id }, data: { durum: 'KESILDI', invoiceId: invoice.id } });
    return { tur: 'KESILDI', invoice };
  }, FATURA_ISLEMI);
}

/**
 * Tek iş emri için anlık fatura (DELIVERED tetiği — peşin servis).
 * Parça + işçilik kalemleriyle fatura keser, ticket'ı faturaya bağlar.
 */
export async function createInvoiceForTicket(ticketId: string) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.serviceTicket.findUnique({
      where: { id: ticketId },
      include: { ticketParts: { include: { part: true } } },
    });
    if (!t || t.invoiceId || t.deletedAt) return null; // yok / zaten faturalı

    const lines: LineInput[] = [];
    for (const tp of t.ticketParts) {
      lines.push({
        tenantId: t.tenantId,
        kind: 'PART',
        description: `Parça: ${tp.part.name} (${t.ticketNumber})`,
        ticketId: t.id,
        partId: tp.partId,
        quantity: tp.quantity,
        unitPrice: Number(tp.unitPrice),
        lineTotal: round2(tp.quantity * Number(tp.unitPrice)),
      });
    }
    if (Number(t.laborCost) > 0) {
      lines.push({
        tenantId: t.tenantId,
        kind: 'LABOR',
        description: `İşçilik (${t.ticketNumber})`,
        ticketId: t.id,
        quantity: 1,
        unitPrice: Number(t.laborCost),
        lineTotal: round2(Number(t.laborCost)),
      });
    }

    const invoice = await postInvoice(tx, {
      tenantId: t.tenantId,
      customerId: t.customerId,
      period: periodOf(),
      source: 'TICKET',
      lines,
    });
    if (!invoice) return null;

    await tx.serviceTicket.update({
      where: { id: t.id },
      data: { invoiceId: invoice.id, invoicedAt: invoice.invoiceDate },
    });
    return invoice;
  });
}

/**
 * FIFO tahsilat mahsubu (onaysız):
 * Cari bazlı bir tahsilatı en eski açık faturalardan başlayarak otomatik dağıtır.
 * Mevcut bir Payment kaydı verilebilir (paymentId), yoksa yeni oluşturulur.
 * Artan tutar (avans) unallocated olarak döner — sonraki faturaya mahsup edilebilir.
 */
/** Müşteri satırını işlem sonuna kadar kilitler (SELECT … FOR UPDATE). */
export async function musteriyiKilitle(tx: Tx, tenantId: string, customerId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${customerId} AND "tenantId" = ${tenantId} FOR UPDATE`;
}

type TahsilatGirdisi = {
  tenantId: string;
  customerId: string;
  amount: number;
  method?: string;
  referenceNo?: string | null;
  notes?: string | null;
  date?: Date;
  paymentId?: string;
  ticketId?: string | null;
};

export async function allocatePayment(params: TahsilatGirdisi) {
  return prisma.$transaction((tx) => allocatePaymentTx(tx, params));
}

/**
 * Aynı mahsup, çağıranın işleminin İÇİNDE. Banka ekstresinden tahsilat
 * satırı kendi kaydını, faturaya giden kısmı ve servis carisine giden kısmı
 * tek işlemde yazmak zorunda: biri yazılıp diğeri yazılmazsa para ya kaybolur
 * ya ikiye katlanır. Tek yazma yolu korunuyor — mantık burada, bir kez.
 */
export async function allocatePaymentTx(tx: Tx, params: TahsilatGirdisi) {
  const { tenantId, customerId } = params;
  const amount = round2(params.amount);

  const pmethod = PaymentMethod[(params.method ?? '') as keyof typeof PaymentMethod] ?? PaymentMethod.TRANSFER;

  // MÜŞTERİ KİLİDİ: aynı müşteriye iki tahsilat aynı anda girerse ikisi de
  // faturanın ESKİ ödenen tutarını okuyup üstüne yazıyordu — biri kayboluyor,
  // fatura ödendiği hâlde açık görünüyordu. Kilit işlem bitene kadar ikinciyi
  // bekletir. Aynı işlemde ikinci kez almak serbesttir.
  await musteriyiKilitle(tx, tenantId, customerId);

  {
    // IDEMPOTENCY: verilen paymentId zaten dağıtıldıysa (invoicePayment var) TEKRAR dağıtma → çift INCOME/kredi engeli.
    if (params.paymentId) {
      const already = await tx.invoicePayment.count({ where: { tenantId, paymentId: params.paymentId } });
      if (already > 0) return { paymentId: params.paymentId, allocations: [], allocated: 0, unallocated: amount, alreadyAllocated: true };
    }
    let paymentId = params.paymentId;
    if (!paymentId) {
      const p = await tx.payment.create({
        data: {
          tenantId,
          customerId,
          ticketId: params.ticketId ?? null,
          amount,
          method: pmethod,
          paymentDate: params.date ?? new Date(),
          referenceNo: params.referenceNo ?? null,
          notes: params.notes ?? null,
        },
      });
      paymentId = p.id;
    }

    const open = await tx.customerInvoice.findMany({
      where: { tenantId, customerId, status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] }, deletedAt: null },
      orderBy: [{ dueDate: 'asc' }, { invoiceDate: 'asc' }],
    });

    let remaining = amount;
    const allocations: { invoiceId: string; invoiceNumber: string; amount: number; status: string }[] = [];

    for (const inv of open) {
      if (remaining <= 0.001) break;
      const openAmt = round2(Number(inv.totalAmount) - Number(inv.paidAmount));
      if (openAmt <= 0) continue;
      const alloc = round2(Math.min(remaining, openAmt));
      const newPaid = round2(Number(inv.paidAmount) + alloc);
      const fullyPaid = newPaid >= Number(inv.totalAmount) - 0.001;

      await tx.invoicePayment.create({ data: { tenantId, invoiceId: inv.id, paymentId, amount: alloc } });
      await tx.customerInvoice.update({
        where: { id: inv.id },
        data: {
          paidAmount: newPaid,
          status: fullyPaid ? 'PAID' : 'PARTIAL',
          paidAt: fullyPaid ? new Date() : inv.paidAt,
        },
      });
      // Nakit-esaslı gelir kaydı — mahsup edilen tutar kadar
      await tx.financialTransaction.create({
        data: {
          tenantId,
          customerId,
          invoiceId: inv.id,
          type: 'INCOME',
          category: inv.source === 'TICKET' ? 'SERVICE_FEE' : 'COUNTER_FEE',
          amount: alloc,
          method: pmethod,
          description: `Tahsilat — ${inv.invoiceNumber}`,
          date: params.date ?? new Date(),
        },
      });
      allocations.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: alloc,
        status: fullyPaid ? 'PAID' : 'PARTIAL',
      });
      remaining = round2(remaining - alloc);
    }

    if (params.method && params.method !== 'OPEN_ACCOUNT') {
      await tx.payment.update({ where: { id: paymentId }, data: { reconciled: true } });
    }

    // LOGO ödeme kuyruğu
    await tx.logoSyncLog.create({
      data: {
        tenantId,
        operation: 'payment_create',
        entityType: 'payment',
        entityId: paymentId,
        direction: 'export',
        status: 'pending',
      },
    });

    return { paymentId, allocations, allocated: round2(amount - remaining), unallocated: round2(remaining) };
  }
}

/** Vadesi geçen OPEN/PARTIAL faturaları OVERDUE'ya çevirir (cron). Etkilenen sayıyı döner. */
export async function markOverdueInvoices(tenantId?: string): Promise<number> {
  const now = new Date();
  const res = await prisma.customerInvoice.updateMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      status: { in: ['OPEN', 'PARTIAL'] },
      dueDate: { lt: now },
      deletedAt: null,
    },
    data: { status: 'OVERDUE' },
  });
  return res.count;
}
