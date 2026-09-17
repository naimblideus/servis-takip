/**
 * KURUMSAL GRUP — VERİTABANI KATMANI.
 *
 * Saf hesap src/lib/kurumsal.ts'te; burası veriyi toplayıp oraya veriyor.
 *
 * HİÇBİR SAYI BURADA YENİDEN TÜRETİLMİYOR. Hepsi zaten sistemde tek bir
 * doğruluk kaynağına sahip:
 *   · SLA uyumu   → lib/sla-veri.ts (müşteri kırılımı)
 *   · bakiye      → lib/musteri-bakiye.ts
 *   · arıza mı    → lib/fault-categories.ts
 *   · sayfa       → CounterReading.deltaBlack/deltaColor (faturalamanın da
 *                   kullandığı alanlar)
 * Grup ekranı bunları YALNIZCA birleştirir. Ayrı bir hesap yazmak, aynı
 * müşteri için iki ekranın farklı sayı söylemesi demekti.
 */
import { prisma } from '@/lib/prisma';
import { isFailure } from '@/lib/fault-categories';
import { slaOlc } from '@/lib/sla-veri';
import { tumBakiyeler } from '@/lib/musteri-bakiye';
import { grupToplami, subeSirala, type SubeSatiri, type GrupToplami } from '@/lib/kurumsal';

export interface GrupOzeti {
  id: string;
  ad: string;
  not: string | null;
  sube: number;
}

export interface GrupRaporu {
  grup: GrupOzeti;
  donem: string;
  subeler: SubeSatiri[];
  toplam: GrupToplami;
}

/** Bayinin grupları, şube sayısıyla. */
export async function grupListesi(tenantId: string): Promise<GrupOzeti[]> {
  const gruplar = await prisma.customerGroup.findMany({
    where: { tenantId },
    select: { id: true, name: true, note: true, _count: { select: { customers: true } } },
    orderBy: { name: 'asc' },
    take: 500,
  });
  return gruplar.map((g) => ({ id: g.id, ad: g.name, not: g.note, sube: g._count.customers }));
}

/** Gruba atanabilecek müşteriler — zaten BAŞKA gruptakiler listede yok. */
export async function bostakiMusteriler(tenantId: string, grupId: string, arama = '') {
  const q = arama.trim();
  return prisma.customer.findMany({
    where: {
      tenantId,
      OR: [{ groupId: null }, { groupId: grupId }],
      ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
    },
    select: { id: true, name: true, groupId: true },
    orderBy: { name: 'asc' },
    take: 50,
  });
}

/**
 * Grubun dönem raporu.
 *
 * @param donem 'YYYY-MM'. Sayfa ve fatura bu döneme ait; BAKİYE bugünkü
 *              borçtur ve döneme bağlı değildir — ekran bunu yazar.
 */
export async function grupRaporu(tenantId: string, grupId: string, donem: string): Promise<GrupRaporu | null> {
  const grup = await prisma.customerGroup.findFirst({
    where: { id: grupId, tenantId },
    select: { id: true, name: true, note: true },
  });
  if (!grup) return null;

  const m = /^(\d{4})-(\d{2})$/.exec(donem);
  if (!m) return null;
  const yil = Number(m[1]), ay = Number(m[2]) - 1;
  const bas = new Date(yil, ay, 1, 0, 0, 0, 0);
  const son = new Date(yil, ay + 1, 0, 23, 59, 59, 999);

  const musteriler = await prisma.customer.findMany({
    where: { tenantId, groupId: grupId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 500,
  });
  const bos: GrupOzeti = { id: grup.id, ad: grup.name, not: grup.note, sube: musteriler.length };
  if (!musteriler.length) {
    return { grup: bos, donem, subeler: [], toplam: grupToplami([]) };
  }
  const musteriIdleri = musteriler.map((c) => c.id);

  const [cihazlar, fisler, faturalar, bakiyeler, sla] = await Promise.all([
    prisma.device.findMany({
      where: { tenantId, customerId: { in: musteriIdleri } },
      select: { id: true, customerId: true },
      take: 5000,
    }),
    prisma.serviceTicket.findMany({
      where: {
        tenantId, deletedAt: null,
        customerId: { in: musteriIdleri },
        createdAt: { gte: bas, lte: son },
      },
      select: { customerId: true, faultCategory: true },
      take: 5000,
    }),
    prisma.customerInvoice.groupBy({
      by: ['customerId'],
      where: { tenantId, customerId: { in: musteriIdleri }, period: donem },
      _sum: { totalAmount: true },
    }),
    tumBakiyeler(tenantId),
    slaOlc(tenantId, bas, son),
  ]);

  // Sayfa: faturalamanın kullandığı delta alanlarından, cihaz bazında.
  const cihazMusteri = new Map(cihazlar.map((d) => [d.id, d.customerId]));
  const okumalar = cihazlar.length
    ? await prisma.counterReading.groupBy({
        by: ['deviceId'],
        where: {
          tenantId, deviceId: { in: cihazlar.map((d) => d.id) },
          readingDate: { gte: bas, lte: son },
        },
        _sum: { deltaBlack: true, deltaColor: true },
      })
    : [];

  const sayfa = new Map<string, { siyah: number; renkli: number; okunanCihaz: number }>();
  for (const o of okumalar) {
    const musteriId = cihazMusteri.get(o.deviceId);
    if (!musteriId) continue;
    const k = sayfa.get(musteriId) ?? { siyah: 0, renkli: 0, okunanCihaz: 0 };
    k.siyah += o._sum.deltaBlack ?? 0;
    k.renkli += o._sum.deltaColor ?? 0;
    k.okunanCihaz += 1;
    sayfa.set(musteriId, k);
  }

  const cihazSayisi = new Map<string, number>();
  for (const d of cihazlar) cihazSayisi.set(d.customerId, (cihazSayisi.get(d.customerId) ?? 0) + 1);

  const fisSayisi = new Map<string, { ariza: number; planli: number }>();
  for (const f of fisler) {
    const k = fisSayisi.get(f.customerId) ?? { ariza: 0, planli: 0 };
    // Kategorisi girilmemiş fiş hiçbir kutuya yazılmaz: arıza mı planlı mı
    // bilinmiyor ve ikisinden birine saymak sayıyı bozar.
    if (f.faultCategory) {
      if (isFailure(String(f.faultCategory))) k.ariza += 1; else k.planli += 1;
    }
    fisSayisi.set(f.customerId, k);
  }

  const faturaTutari = new Map(faturalar.map((f) => [f.customerId, Number(f._sum.totalAmount ?? 0)]));
  const slaMusteri = new Map(sla.musteriler.map((s) => [s.musteriId, s]));

  const subeler: SubeSatiri[] = musteriler.map((c) => {
    const s = sayfa.get(c.id);
    const fs = fisSayisi.get(c.id) ?? { ariza: 0, planli: 0 };
    const sl = slaMusteri.get(c.id);
    return {
      musteriId: c.id,
      musteri: c.name,
      cihaz: cihazSayisi.get(c.id) ?? 0,
      okunanCihaz: s?.okunanCihaz ?? 0,
      // Hiç okuma yoksa sayfa SIFIR değil BİLİNMİYOR.
      siyah: s ? s.siyah : null,
      renkli: s ? s.renkli : null,
      ariza: fs.ariza,
      planli: fs.planli,
      slaMudahaleYuzde: sl?.ozet.mudahaleUyumYuzde ?? null,
      slaCozumYuzde: sl?.ozet.cozumUyumYuzde ?? null,
      slaOlculen: sl?.ozet.olculen ?? 0,
      donemFaturasi: faturaTutari.get(c.id) ?? 0,
      bakiye: bakiyeler.get(c.id)?.toplamBorc ?? 0,
    };
  });

  const sirali = subeSirala(subeler);
  return { grup: bos, donem, subeler: sirali, toplam: grupToplami(sirali) };
}

// ─────────────────────────────────────────────────────────────────────────
// Yazma işlemleri — hepsi tenantId ile sınırlı.
// ─────────────────────────────────────────────────────────────────────────

export async function grupOlustur(tenantId: string, ad: string, not?: string | null) {
  const temiz = ad.trim();
  if (!temiz) return null;
  const varOlan = await prisma.customerGroup.findFirst({
    where: { tenantId, name: temiz }, select: { id: true },
  });
  if (varOlan) return null; // aynı adla ikinci grup açılmaz
  return prisma.customerGroup.create({
    data: { tenantId, name: temiz, note: not?.trim() || null },
    select: { id: true, name: true },
  });
}

export async function grupGuncelle(tenantId: string, grupId: string, ad?: string, not?: string | null) {
  const grup = await prisma.customerGroup.findFirst({ where: { id: grupId, tenantId }, select: { id: true } });
  if (!grup) return null;
  const temiz = ad?.trim();
  if (temiz) {
    const cakisma = await prisma.customerGroup.findFirst({
      where: { tenantId, name: temiz, id: { not: grupId } }, select: { id: true },
    });
    if (cakisma) return null;
  }
  await prisma.customerGroup.update({
    where: { id: grupId },
    data: { ...(temiz ? { name: temiz } : {}), ...(not !== undefined ? { note: not?.trim() || null } : {}) },
  });
  return { id: grupId };
}

/**
 * Grubu siler. Şubeler SİLİNMEZ, yalnız çatıları kalkar.
 * Müşteri kaydına, faturasına, sözleşmesine dokunulmaz.
 */
export async function grupSil(tenantId: string, grupId: string) {
  const grup = await prisma.customerGroup.findFirst({ where: { id: grupId, tenantId }, select: { id: true } });
  if (!grup) return null;
  await prisma.customerGroup.delete({ where: { id: grupId } });
  return { id: grupId };
}

/** Şubeyi gruba bağlar. Başka bayinin müşterisi bağlanamaz. */
export async function subeEkle(tenantId: string, grupId: string, musteriId: string) {
  const [grup, musteri] = await Promise.all([
    prisma.customerGroup.findFirst({ where: { id: grupId, tenantId }, select: { id: true } }),
    prisma.customer.findFirst({ where: { id: musteriId, tenantId }, select: { id: true } }),
  ]);
  if (!grup || !musteri) return null;
  await prisma.customer.update({ where: { id: musteriId }, data: { groupId: grupId } });
  return { musteriId };
}

/** Şubeyi gruptan çıkarır — müşteri kaydı yerinde kalır. */
export async function subeCikar(tenantId: string, musteriId: string) {
  const musteri = await prisma.customer.findFirst({ where: { id: musteriId, tenantId }, select: { id: true } });
  if (!musteri) return null;
  await prisma.customer.update({ where: { id: musteriId }, data: { groupId: null } });
  return { musteriId };
}
