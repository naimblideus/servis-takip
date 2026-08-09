/**
 * MÜŞTERİ PORTALI — güvenlik sınırı.
 *
 * Portala giren kişi KİMLİĞİ DOĞRULANMAMIŞ bir ziyaretçidir; elinde yalnızca
 * bir bağlantı var. Bu yüzden "müşteriye ne gösterilir" kararı tek bir yerde,
 * burada toplandı. Sayfa ve API bu dosyanın döndürdüğünden fazlasını asla
 * göremez — yeni bir alan sızdırmak için bilerek buraya yazmak gerekir.
 *
 * ── DIŞARI ÇIKMAYANLAR (bilerek) ─────────────────────────────────────────
 * · Parça maliyeti, işçilik kırılımı, bayinin kâr marjı
 * · Başka müşterilerin hiçbir verisi
 * · Bayinin iç notları (ServiceTicket.notes)
 * · Cihazın birim fiyatları ve sözleşme koşulları
 * Müşteri kendi cihazını, fişinin DURUMUNU ve kendi faturasının TOPLAMINI görür.
 */
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sonOkumalar } from '@/lib/readings';

/** 32 bayt = 64 karakter hex. Kaba kuvvetle bulunması pratikte imkânsız. */
export function yeniPortalJetonu(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Jeton biçimi doğru mu? Veritabanına gitmeden önce ucuz eleme. */
export function jetonBicimiGecerli(t: string | undefined | null): boolean {
  return typeof t === 'string' && /^[a-f0-9]{64}$/.test(t);
}

export interface PortalMusteri {
  id: string;
  tenantId: string;
  name: string;
}

/**
 * Jetondan müşteriyi bul. Portal kapalıysa ya da bayi askıdaysa BULUNAMAZ
 * sayılır — bayi aboneliği bitince müşteri portalı da kapanmalı.
 */
export async function jetondanMusteri(token: string): Promise<PortalMusteri | null> {
  if (!jetonBicimiGecerli(token)) return null;
  const m = await prisma.customer.findFirst({
    where: { portalToken: token, portalEnabled: true },
    select: {
      id: true, tenantId: true, name: true,
      tenant: { select: { isActive: true, isSuspended: true, deletedAt: true } },
    },
  });
  if (!m || !m.tenant.isActive || m.tenant.isSuspended || m.tenant.deletedAt) return null;
  return { id: m.id, tenantId: m.tenantId, name: m.name };
}

const TL = (v: unknown) => Number(v ?? 0);

/** Bu kadar gündür hareket görmemiş fiş artık "devam eden servis" sayılmaz. */
const ACIK_FIS_GUN = 45;

/** Fiş durumlarının müşteriye gösterilecek karşılıkları — iç kodu göstermeyiz. */
export const DURUM_ETIKET: Record<string, string> = {
  NEW: 'Talebiniz alındı',
  IN_SERVICE: 'Serviste — işlem yapılıyor',
  WAITING_FOR_PART: 'Parça bekleniyor',
  READY: 'Hazır',
  DELIVERED: 'Tamamlandı',
  CANCELLED: 'İptal edildi',
};

/**
 * Portalda gösterilecek her şey. Tek sorgu kümesi — sayfa hızlı açılsın,
 * müşteri "yükleniyor" ekranına bakmasın.
 */
export async function portalVerisi(m: PortalMusteri) {
  const [firma, cihazlar, fisler, faturalar, odemeler, talepler] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: m.tenantId },
      select: { name: true, phone: true, address: true },
    }),
    prisma.device.findMany({
      where: { tenantId: m.tenantId, customerId: m.id },
      select: {
        id: true, brand: true, model: true, serialNo: true, location: true, isRental: true,
      },
      orderBy: [{ location: 'asc' }, { brand: 'asc' }],
    }),
    prisma.serviceTicket.findMany({
      // deletedAt: çöp kutusundaki fiş müşteriye görünmemeli
      where: { tenantId: m.tenantId, customerId: m.id, deletedAt: null },
      select: {
        id: true, ticketNumber: true, status: true, createdAt: true, statusUpdatedAt: true,
        issueText: true, actionText: true, totalCost: true,
        device: { select: { brand: true, model: true, location: true } },
        // notes, parça maliyeti, teknisyen adı BİLEREK yok
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.customerInvoice.findMany({
      // Silinen fatura müşteriye görünmemeli, bakiyeye de girmemeli
      where: { tenantId: m.tenantId, customerId: m.id, deletedAt: null },
      select: {
        id: true, invoiceNumber: true, invoiceDate: true, dueDate: true,
        totalAmount: true, paidAmount: true, status: true,
      },
      orderBy: { invoiceDate: 'desc' },
      take: 24,
    }),
    prisma.payment.aggregate({
      where: { tenantId: m.tenantId, customerId: m.id },
      _sum: { amount: true },
    }),
    prisma.portalRequest.findMany({
      where: { customerId: m.id },
      select: { id: true, tur: true, durum: true, createdAt: true, aciklama: true, notu: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  // Sayaç için Device alanı DEĞİL son OKUMA gösteriliyor: fatura farkı son
  // okumaya göre hesaplanıyor, müşteri de faturasını belirleyen sayıyı görsün.
  const okuma = await sonOkumalar(m.tenantId, cihazlar.map((c) => c.id));

  const faturaToplam = faturalar.reduce((a, f) => a + TL(f.totalAmount), 0);
  const odenen = faturalar.reduce((a, f) => a + TL(f.paidAmount), 0);

  return {
    firma: { ad: firma?.name ?? '', telefon: firma?.phone ?? '', adres: firma?.address ?? '' },
    musteri: { ad: m.name },
    cihazlar: cihazlar.map((c) => ({
      id: c.id,
      ad: `${c.brand} ${c.model}`,
      seri: c.serialNo,
      yer: c.location,
      kiralik: c.isRental,
      sayacBlack: okuma.get(c.id)?.counterBlack ?? null,
      sayacColor: okuma.get(c.id)?.counterColor ?? null,
      sayacTarih: okuma.get(c.id)?.readingDate.toISOString() ?? null,
    })),
    fisler: fisler.map((f) => ({
      id: f.id,
      no: f.ticketNumber,
      durum: f.status,
      durumEtiket: DURUM_ETIKET[f.status] ?? f.status,
      // "Devam ediyor" DEMEK İÇİN kapanmamış olmak yetmez, YAKIN TARİHLİ de
      // olmalı. Gerçek veride aylar önce açılıp kapatılmamış onlarca fiş
      // birikiyor; hepsini "devam eden servis" diye göstermek müşteriyi
      // telefona sarılmaya iter — portalın amacının tam tersi. Eski ama
      // kapanmamış fişler geçmiş listesinde DURUMUYLA birlikte görünür,
      // yani gizlenmiyor, yalnızca doğru yere konuyor.
      acik: f.status !== 'DELIVERED' && f.status !== 'CANCELLED'
        && f.statusUpdatedAt.getTime() >= Date.now() - ACIK_FIS_GUN * 86_400_000,
      tarih: f.createdAt.toISOString(),
      sonHareket: f.statusUpdatedAt.toISOString(),
      cihaz: f.device ? `${f.device.brand} ${f.device.model}${f.device.location ? ` · ${f.device.location}` : ''}` : null,
      ariza: f.issueText,
      yapilan: f.actionText,
      tutar: TL(f.totalCost),
    })),
    faturalar: faturalar.map((f) => ({
      no: f.invoiceNumber,
      tarih: f.invoiceDate.toISOString(),
      vade: f.dueDate?.toISOString() ?? null,
      tutar: TL(f.totalAmount),
      odenen: TL(f.paidAmount),
      kalan: TL(f.totalAmount) - TL(f.paidAmount),
      durum: f.status,
    })),
    // Bakiye faturalar üzerinden: "ne kadar borcum var" en sık gelen telefon.
    bakiye: Math.max(0, faturaToplam - odenen),
    tahsilatToplam: TL(odemeler._sum.amount),
    talepler: talepler.map((t) => ({
      id: t.id, tur: t.tur, durum: t.durum,
      tarih: t.createdAt.toISOString(),
      aciklama: t.aciklama, notu: t.notu,
    })),
  };
}

export type PortalVeri = Awaited<ReturnType<typeof portalVerisi>>;

/**
 * Kötüye kullanım freni: aynı müşteri son bir saatte kaç talep gönderdi?
 * Bir kişi bir saatte 10 arıza bildiremez; bildiriyorsa bu bir hata ya da
 * yanlışlıkla üst üste basılmış bir düğmedir. Bayinin kuyruğunu kirletmesin.
 */
export async function talepSiniriAsildi(customerId: string): Promise<boolean> {
  const sayi = await prisma.portalRequest.count({
    where: { customerId, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  return sayi >= 10;
}
