// BANKA EKSTRESİ — veritabanı katmanı.
//
// Önizleme: dosyadaki gelen havaleler için müşteri, fatura ve daha önce
// işlenmiş satır bilgisini toplar, saf motora (lib/banka-ekstresi) verir.
// İşleme: onaylanan her satır TEK işlemde yazılır —
//   1. BankaHareketi (tekil iz: aynı satır ikinci kez buraya giremez)
//   2. açık kira/sayaç faturalarına mahsup (mevcut tek yazma yolu)
//   3. artan servis cari borcuna ödeme kaydı
//   4. o da artarsa avans (faturaya bağlanmamış tahsilat)
// Biri başarısız olursa hiçbiri yazılmaz.

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { allocatePaymentTx, musteriyiKilitle } from '@/lib/invoicing';
import { tumBakiyeler } from '@/lib/musteri-bakiye';
import {
  eslestir, dagit, izHesapla,
  type Hareket, type SatirSonucu, type MusteriKaydi, type FaturaKaydi, type OdemeKaydi,
} from '@/lib/banka-ekstresi';

const ACIK: ('OPEN' | 'PARTIAL' | 'OVERDUE')[] = ['OPEN', 'PARTIAL', 'OVERDUE'];
const yuvarla = (n: number) => Math.round(n * 100) / 100;
const GUN = 86_400_000;

/**
 * Önizleme: her gelen havale için eşleşme önerisi + müşterilerin güncel
 * TOPLAM borcu. Borç ekranda seçilen müşterinin yanında görünür: borcu
 * olmayan müşteriye giden para avans olur ve bu çoğu zaman yanlış
 * müşterinin seçildiğini gösterir.
 */
export async function ekstreOnizle(tenantId: string, hareketler: Hareket[]): Promise<{
  satirlar: SatirSonucu[];
  musteriler: { id: string; ad: string; borc: number }[];
}> {
  const tarihler = hareketler.map((h) => Date.parse(h.tarih)).filter(Number.isFinite);
  const bas = new Date(Math.min(...tarihler) - 5 * GUN);
  const son = new Date(Math.max(...tarihler) + 5 * GUN);
  const ikiYilOnce = new Date(Date.now() - 730 * GUN);

  const [bakiyeler, musteriler, faturalar, odemeler, cariOdemeler, islenmis, bankadan] = await Promise.all([
    tumBakiyeler(tenantId),
    prisma.customer.findMany({
      where: { tenantId },
      select: { id: true, name: true, legalName: true, taxNo: true },
      orderBy: { name: 'asc' },
    }),
    prisma.customerInvoice.findMany({
      where: { tenantId, deletedAt: null, status: { notIn: ['DRAFT', 'CANCELLED'] }, invoiceDate: { gte: ikiYilOnce } },
      select: { id: true, customerId: true, invoiceNumber: true, gibNo: true, totalAmount: true, paidAmount: true, status: true },
    }),
    prisma.payment.findMany({
      where: { tenantId, customerId: { not: null }, paymentDate: { gte: bas, lte: son } },
      select: { id: true, customerId: true, amount: true, paymentDate: true },
    }),
    prisma.accountEntry.findMany({
      where: { tenantId, type: 'PAYMENT', date: { gte: bas, lte: son }, NOT: { importKey: { startsWith: 'banka:' } } },
      select: { customerId: true, amount: true, date: true },
    }),
    prisma.bankaHareketi.findMany({
      where: { tenantId, iz: { in: hareketler.map((h) => h.iz) } },
      select: { iz: true, customerId: true },
    }),
    // Bankadan işlenmiş tahsilatlar "elle girilmiş olabilir" uyarısına girmesin.
    prisma.bankaHareketi.findMany({
      where: { tenantId, paymentId: { not: null }, tarih: { gte: bas, lte: son } },
      select: { paymentId: true },
    }),
  ]);

  const bankaOdemeleri = new Set(bankadan.map((b) => b.paymentId));
  const mk: MusteriKaydi[] = musteriler.map((m) => ({ id: m.id, ad: m.name, unvan: m.legalName, vergiNo: m.taxNo }));
  const fk: FaturaKaydi[] = faturalar.map((f) => ({
    id: f.id, musteriId: f.customerId, no: f.invoiceNumber, gibNo: f.gibNo,
    acik: ACIK.includes(f.status as (typeof ACIK)[number]) ? yuvarla(Number(f.totalAmount) - Number(f.paidAmount)) : 0,
  }));
  const ok: OdemeKaydi[] = [
    ...odemeler.filter((o) => !bankaOdemeleri.has(o.id)).map((o) => ({
      musteriId: o.customerId as string, tutar: Number(o.amount), tarih: o.paymentDate.toISOString().slice(0, 10),
    })),
    ...cariOdemeler.map((o) => ({ musteriId: o.customerId, tutar: Number(o.amount), tarih: o.date.toISOString().slice(0, 10) })),
  ];

  const islenmisMusteri = new Map(islenmis.map((x) => [x.iz, x.customerId]));
  const borcu = (id: string) => Math.max(0, bakiyeler.get(id)?.toplamBorc ?? 0);
  const satirlar = eslestir(hareketler, { musteriler: mk, faturalar: fk, odemeler: ok, islenmis: new Set(islenmisMusteri.keys()) })
    .map((s) => {
      // İşlenmiş satır hangi müşteriye işlendiyse onu göstersin.
      if (s.durum === 'ISLENMIS') return { ...s, musteriId: islenmisMusteri.get(s.hareket.iz) ?? null };
      // Yalnız adla eşleşen ve hiç borcu olmayan müşteri: para avansa gider,
      // çoğu zaman adaş başka müşteridir. İşaretli gelmez, bayi baksın.
      if (s.durum === 'ESLESTI' && s.neden === 'ISIM' && s.musteriId && borcu(s.musteriId) <= 0.004) return { ...s, secili: false };
      return s;
    });
  return {
    satirlar,
    musteriler: musteriler.map((m) => ({ id: m.id, ad: m.name, borc: Math.max(0, bakiyeler.get(m.id)?.toplamBorc ?? 0) })),
  };
}

export type IslemGirdisi = { hareket: Hareket; musteriId: string };
export type IslemSonucu = {
  iz: string;
  durum: 'TAMAM' | 'ISLENMIS' | 'MUSTERI_YOK' | 'GECERSIZ' | 'HATA';
  musteriAd?: string;
  tutar?: number;
  faturaya?: number;
  servise?: number;
  avans?: number;
};

/** Hareket gövdesini doğrula; iz sunucuda YENİDEN hesaplanır. */
function hareketGecerli(h: Hareket | null | undefined): h is Hareket {
  if (!h || typeof h !== 'object') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(h.tarih)) || !Number.isFinite(Date.parse(h.tarih))) return false;
  if (typeof h.tutar !== 'number' || !Number.isFinite(h.tutar) || h.tutar <= 0 || h.tutar > 100_000_000) return false;
  if (!Number.isInteger(h.sira) || h.sira < 0 || h.sira > 10_000) return false;
  for (const k of ['aciklama', 'gonderen', 'referans'] as const) if (typeof h[k] !== 'string' || h[k].length > 2000) return false;
  // İstemciden gelen iz'e güvenilmez: içerikten yeniden hesaplanır ve tutmalı.
  // Tutmuyorsa satır değiştirilmiş demektir; aynı havale ikinci kez işlenebilirdi.
  return izHesapla(h) === h.iz;
}

/** Onaylanan satırları sırayla işler. Her satır kendi işleminde. */
export async function ekstreIsle(
  tenantId: string,
  kullanici: { id: string; name: string | null },
  girdiler: IslemGirdisi[],
): Promise<IslemSonucu[]> {
  const sonuclar: IslemSonucu[] = [];
  for (const g of girdiler) {
    const h = g?.hareket;
    if (!hareketGecerli(h) || typeof g.musteriId !== 'string' || !g.musteriId) {
      sonuclar.push({ iz: String(h?.iz ?? ''), durum: 'GECERSIZ' });
      continue;
    }
    try {
      const r = await prisma.$transaction(async (tx) => {
        const musteri = await tx.customer.findFirst({ where: { id: g.musteriId, tenantId }, select: { id: true, name: true } });
        if (!musteri) return { iz: h.iz, durum: 'MUSTERI_YOK' as const };
        // Borç havuzları okunmadan ÖNCE kilit: arada başka tahsilat girip
        // dağıtımı eskimiş rakama göre yapmasın.
        await musteriyiKilitle(tx, tenantId, musteri.id);

        const tarih = new Date(`${h.tarih}T12:00:00.000Z`);
        const aciklama = [h.gonderen, h.aciklama].filter(Boolean).join(' — ').slice(0, 500) || null;

        // İLK YAZIM: tekil iz. Aynı satır ikinci kez gelirse burada durur ve
        // işlemin geri kalanı hiç çalışmaz.
        const kayit = await tx.bankaHareketi.create({
          data: { tenantId, iz: h.iz, tarih, tutar: h.tutar, aciklama, customerId: musteri.id, musteriAd: musteri.name, isleyen: kullanici.name },
          select: { id: true },
        });

        const [faturalar, cari] = await Promise.all([
          tx.customerInvoice.findMany({
            where: { tenantId, customerId: musteri.id, deletedAt: null, status: { in: ACIK } },
            select: { totalAmount: true, paidAmount: true },
          }),
          tx.accountEntry.groupBy({ by: ['type'], where: { tenantId, customerId: musteri.id }, _sum: { amount: true } }),
        ]);
        const faturaAcik = yuvarla(faturalar.reduce((s, f) => s + Number(f.totalAmount) - Number(f.paidAmount), 0));
        const satis = Number(cari.find((c) => c.type === 'SALE')?._sum.amount ?? 0);
        const odeme = Number(cari.find((c) => c.type === 'PAYMENT')?._sum.amount ?? 0);
        const { faturaya, servise, avans } = dagit(h.tutar, faturaAcik, Math.max(0, yuvarla(satis - odeme)));

        const referans = (h.referans || h.aciklama).slice(0, 120) || null;
        let paymentId: string | null = null;
        if (faturaya + avans > 0.004) {
          const p = await allocatePaymentTx(tx, {
            tenantId, customerId: musteri.id, amount: yuvarla(faturaya + avans), method: 'TRANSFER',
            referenceNo: referans, notes: `Banka ekstresi: ${aciklama ?? ''}`.slice(0, 500), date: tarih,
          });
          paymentId = p.paymentId ?? null;
        }
        if (servise > 0.004) {
          await tx.accountEntry.create({
            data: {
              tenantId, customerId: musteri.id, type: 'PAYMENT', amount: servise, method: 'TRANSFER',
              notes: `Banka ekstresi: ${aciklama ?? ''}`.slice(0, 500), importKey: `banka:${h.iz}`,
              createdByUserId: kullanici.id, createdByName: kullanici.name, date: tarih,
            },
          });
        }
        await tx.bankaHareketi.update({ where: { id: kayit.id }, data: { paymentId, faturaya, servise, avans } });
        return { iz: h.iz, durum: 'TAMAM' as const, musteriAd: musteri.name, tutar: h.tutar, faturaya, servise, avans };
      });
      sonuclar.push(r);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        sonuclar.push({ iz: h.iz, durum: 'ISLENMIS' });
      } else {
        console.error('BANKA EKSTRESI ISLEME:', (e as Error)?.message);
        sonuclar.push({ iz: h.iz, durum: 'HATA' });
      }
    }
  }
  return sonuclar;
}

/** Son işlenen banka satırları — "ne yaptım" listesi. */
export async function sonIslenenler(tenantId: string, adet = 50) {
  const kayitlar = await prisma.bankaHareketi.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: adet,
    select: {
      id: true, tarih: true, tutar: true, aciklama: true, customerId: true, musteriAd: true,
      faturaya: true, servise: true, avans: true, isleyen: true, createdAt: true,
    },
  });
  return kayitlar.map((k) => ({
    ...k,
    tarih: k.tarih.toISOString(),
    createdAt: k.createdAt.toISOString(),
    tutar: Number(k.tutar), faturaya: Number(k.faturaya), servise: Number(k.servise), avans: Number(k.avans),
  }));
}
