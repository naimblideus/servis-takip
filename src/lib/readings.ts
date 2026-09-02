// Sayaç okuma oluşturma — TEK KAYNAK.
// Hem tekil uç (/api/devices/[id]/readings) hem toplu uç (/api/readings/bulk) bunu çağırır.
// KRİTİK: bu mantık kopyalanmamalı — aşım/dahil-paket hesabı ikiye çatallanırsa fatura hatası olur.
import { prisma } from '@/lib/prisma';
import { counterOverage } from '@/lib/invoicing';

export class ReadingError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'ReadingError';
    this.code = code;
    this.status = status;
  }
}

export interface CreateReadingInput {
  tenantId: string;
  deviceId: string;
  counterBlack: number;
  counterColor: number;
  ticketId?: string | null;
  includeMonthlyRent?: boolean;
  photo?: string | null;
  /** Sayaç sıfırlandı/cihaz değişti onayı — düşüş ancak bununla kabul edilir */
  reset?: boolean;
  /** Okuma nereden geldi — tartışmada kanıt ağırlığını belirler (bkz. şema) */
  source?: OkumaKaynagi;
}

export type OkumaKaynagi =
  | 'CIHAZ_EPOSTA'   // cihazın kendi sayaç raporu — en güçlü kanıt
  | 'FOTOGRAF'       // teknisyen fotoğraf çekti
  | 'WHATSAPP_FOTO'  // müşteri WhatsApp'tan fotoğraf gönderdi
  | 'PORTAL'         // müşteri portaldan kendi girdi
  | 'TOPLU'          // sayaç turunda toplu giriş
  | 'SERVIS_FISI'    // servis fişi açılırken girildi
  | 'ELLE';          // tekil elle giriş

/** Tek okumada olağandışı yüksek artış (bloklamaz, uyarır) */
const ANOMALY = 200000;

/** Sayaç fotoğrafı: küçültülmüş JPEG data URL; güvenli boyut sınırı */
export function safePhotoOf(photo: unknown): string | null {
  return typeof photo === 'string' && photo.startsWith('data:image/') && photo.length < 800000 ? photo : null;
}

export async function createReading(
  input: CreateReadingInput,
  /** Toplu çağrıda tenant'ı bir kez çekip geçir (N+1 önle) */
  preloadedTenant?: any,
) {
  const { tenantId, deviceId, counterBlack, counterColor, ticketId, includeMonthlyRent, reset } = input;

  if (counterBlack === undefined || counterColor === undefined || counterBlack === null || counterColor === null) {
    throw new ReadingError('MISSING', 'counterBlack ve counterColor zorunlu');
  }
  if (!Number.isFinite(counterBlack) || !Number.isFinite(counterColor) || counterBlack < 0 || counterColor < 0) {
    throw new ReadingError('INVALID', 'Sayaç değeri geçersiz');
  }

  // Tenant-scoped cihaz (IDOR guard)
  const device = await prisma.device.findFirst({ where: { id: deviceId, tenantId } });
  if (!device) throw new ReadingError('DEVICE_NOT_FOUND', 'Cihaz bulunamadı', 404);

  const tenant = preloadedTenant ?? await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new ReadingError('TENANT_NOT_FOUND', 'Tenant bulunamadı', 404);

  // Son okuma (delta hesabı)
  const prev = await prisma.counterReading.findFirst({
    where: { tenantId, deviceId },
    orderBy: { readingDate: 'desc' },
  });

  // Düşüş kontrolü: sayaç gerilemişse SESSİZCE 0 yazma. 'reset' onayı yoksa REDDET
  // (yoksa ya gelir kaybı [delta=0] ya da yanlış devasa delta oluşur).
  const prevB = prev ? prev.counterBlack : null;
  const prevC = prev ? prev.counterColor : null;
  const decreased = (prevB !== null && counterBlack < prevB) || (prevC !== null && counterColor < prevC);
  if (decreased && !reset) {
    throw new ReadingError(
      'COUNTER_DECREASE',
      'Sayaç değeri öncekinden düşük. Cihaz sıfırlandıysa/değiştiyse "sayaç sıfırlandı" onayıyla tekrar gönderin.',
    );
  }

  const deltaBlack = prevB === null ? 0 : (reset && counterBlack < prevB ? Math.max(0, counterBlack) : Math.max(0, counterBlack - prevB));
  const deltaColor = prevC === null ? 0 : (reset && counterColor < prevC ? Math.max(0, counterColor) : Math.max(0, counterColor - prevC));
  const warning = deltaBlack > ANOMALY || deltaColor > ANOMALY ? 'Olağandışı yüksek sayfa artışı — lütfen kontrol edin.' : null;

  // Kiralık cihazda kademeli (dahil paket + aşım) ücret — gerçek fatura mantığıyla AYNI kaynak
  let calculatedCost = 0;
  let monthlyRentAmount = 0;
  let ch: ReturnType<typeof counterOverage> | null = null;

  if (device.isRental) {
    // Bu dönemde daha önce okunan sayfalar — dahil paketi kümülatif uygula (mükerrer indirim önle)
    const now = new Date();
    const pStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const pEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevAgg = await prisma.counterReading.aggregate({
      where: { tenantId, deviceId, readingDate: { gte: pStart, lt: pEnd } },
      _sum: { deltaBlack: true, deltaColor: true },
    });
    ch = counterOverage(device as any, deltaBlack, deltaColor, tenant as any, prevAgg._sum.deltaBlack ?? 0, prevAgg._sum.deltaColor ?? 0);
    calculatedCost = ch.total;

    if (includeMonthlyRent) {
      monthlyRentAmount = Number(device.monthlyRent);
      calculatedCost += monthlyRentAmount;
    }
  }

  const reading = await prisma.counterReading.create({
    data: {
      tenantId,
      deviceId,
      ticketId: ticketId || null,
      counterBlack,
      counterColor,
      deltaBlack,
      deltaColor,
      calculatedCost,
      monthlyRent: monthlyRentAmount,
      photo: safePhotoOf(input.photo),
      source: input.source ?? 'ELLE',
    },
  });

  await prisma.device.update({
    where: { id: deviceId },
    data: { counterBlack, counterColor },
  });

  // NOT: Gelir kaydı BURADA yazılmaz. Okuma billed=false birikir; gelir dönem faturası
  // kesilince src/lib/invoicing.ts tarafından oluşturulur (mükerrer gelir önlenir).

  const breakdown = device.isRental && ch ? {
    deltaBlack: ch.billB,
    deltaColor: ch.billC,
    pricePerBlack: ch.overBlack,
    pricePerColor: ch.overColor,
    blackCost: ch.blackTotal,
    colorCost: ch.colorTotal,
    monthlyRent: monthlyRentAmount,
    total: calculatedCost,
  } : null;

  return { reading, breakdown, warning, deltaBlack, deltaColor, calculatedCost };
}

export interface SonOkuma {
  deviceId: string;
  counterBlack: number;
  counterColor: number;
  readingDate: Date;
  /** Okuma nereden geldi — portal ve bayi ekranı kanıt seviyesini bununla gösterir */
  source: string;
}

/**
 * Verilen cihazların SON sayaç okumaları — tek sorguda (N+1 yok).
 *
 * NEDEN Device.counterBlack YETMİYOR: fatura farkı her zaman SON OKUMAYA göre
 * hesaplanır (yukarıdaki createReading böyle çalışıyor). Device üzerindeki
 * sayaç alanı normalde okumayla birlikte güncellenir ama toplu içe aktarma
 * gibi yollarla ayrışabilir. Ayrıştığında "mevcut sayaç" diye Device alanını
 * göstermek, bayiye ve müşteriye faturayı belirleyen sayıdan BAŞKA bir sayı
 * göstermek olur. Bu fonksiyon her zaman faturayı belirleyen sayıyı verir.
 */
export async function sonOkumalar(tenantId: string, deviceIds: string[]): Promise<Map<string, SonOkuma>> {
  const harita = new Map<string, SonOkuma>();
  if (deviceIds.length === 0) return harita;

  // DISTINCT ON: her cihaz için en yeni satır (Postgres'e özgü, tek geçiş).
  const satirlar = await prisma.$queryRaw<SonOkuma[]>`
    SELECT DISTINCT ON ("deviceId")
      "deviceId", "counterBlack", "counterColor", "readingDate", "source"
    FROM "CounterReading"
    WHERE "tenantId" = ${tenantId} AND "deviceId" = ANY(${deviceIds})
    ORDER BY "deviceId", "readingDate" DESC
  `;
  for (const s of satirlar) harita.set(s.deviceId, s);
  return harita;
}
