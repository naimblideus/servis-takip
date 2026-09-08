// Sayaç okuma oluşturma — TEK KAYNAK.
// Hem tekil uç (/api/devices/[id]/readings) hem toplu uç (/api/readings/bulk) bunu çağırır.
// KRİTİK: bu mantık kopyalanmamalı — aşım/dahil-paket hesabı ikiye çatallanırsa fatura hatası olur.
import { prisma } from '@/lib/prisma';
import { counterOverage } from '@/lib/invoicing';
import { anomaliDegerlendir, type AnomaliSonucu } from '@/lib/sayac-anomali';

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
  /**
   * Düşüşün SEBEBİ. İki durum tamamen farklı sonuç doğurur ve eskiden
   * ayrılmıyordu — ikisi de "o ayın kullanımı = okunan değer" sayılıyordu:
   *
   * · CIHAZ_DEGISTI    → başka bir makine takıldı. Yeni makinenin sayacı ONUN
   *                      ömür boyu değeridir, bu ayın kullanımı DEĞİLDİR.
   *                      delta = 0; okunan değer bundan sonrası için başlangıç.
   * · SAYAC_SIFIRLANDI → aynı makine, sayaç sıfıra döndü. Okunan değer
   *                      sıfırlamadan sonraki gerçek kullanımdır. delta = değer.
   *
   * Belirtilmezse CIHAZ_DEGISTI varsayılır — güvenli taraf.
   */
  resetTur?: 'CIHAZ_DEGISTI' | 'SAYAC_SIFIRLANDI';
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

/** Sayaç fotoğrafı: küçültülmüş JPEG data URL; güvenli boyut sınırı */
export function safePhotoOf(photo: unknown): string | null {
  return typeof photo === 'string' && photo.startsWith('data:image/') && photo.length < 800000 ? photo : null;
}

/**
 * SAYAC FARKI - TEK KURAL.
 *
 * Modül düzeyinde ve dışa açık, çünkü bu mantığın İKİNCİ bir kopyası olamaz.
 * Nitekim olmuştu: okuma DÜZENLEME ucu (PATCH /api/devices/[id]/readings)
 * kendi kopyasını taşıyordu ve o kopya bu dosyada düzeltilen hatanın ESKİ
 * hâlindeydi - yalnız düşüş yönünü koruyor, sıfırlama TÜRÜNÜ hiç bilmiyordu.
 * Aynı beyan iki ekranda iki farklı tutar demektir; kiralamada bu, doğrudan
 * faturaya inen bir hatadır.
 *
 * @param yeni     Okunan sayaç.
 * @param onceki   Bir önceki okumanın sayacı (yoksa null = zincirin başı).
 * @param reset    Bayi "sıfırlandı / cihaz değişti" onayı verdi mi?
 * @param resetTur Sebebi. Belirtilmezse CIHAZ_DEGISTI varsayılır - güvenli
 *                 taraf: eksik faturalamak fahiş faturalamaktan iyidir. Eksik
 *                 kalan sayfa sonraki okumada zaten farka girer, fahiş fatura
 *                 ise müşteriyi kaybettirir.
 */
export function okumaFarki(
  yeni: number,
  onceki: number | null,
  reset?: boolean,
  resetTur?: 'CIHAZ_DEGISTI' | 'SAYAC_SIFIRLANDI',
): number {
  if (onceki === null) return 0;                       // zincirin başı
  const sayacSifirlandi = !!reset && resetTur === 'SAYAC_SIFIRLANDI';
  const cihazDegisti = !!reset && !sayacSifirlandi;    // tür verilmezse varsayılan bu
  if (cihazDegisti) return 0;                          // yön fark etmez
  if (sayacSifirlandi && yeni < onceki) return Math.max(0, yeni);
  return Math.max(0, yeni - onceki);
}

export async function createReading(
  input: CreateReadingInput,
  /** Toplu çağrıda tenant'ı bir kez çekip geçir (N+1 önle) */
  preloadedTenant?: any,
) {
  const { tenantId, deviceId, counterBlack, counterColor, ticketId, includeMonthlyRent, reset, resetTur } = input;

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

  // Son okumalar. Bir satır yeter gibi görünür (delta için öyle) ama anomali
  // kararı cihazın KENDİ hızına bakıyor ve o hız birkaç aralıktan çıkıyor.
  // Aynı sorguda 6 satır çekmek, ayrı bir geçmiş sorgusu açmaktan ucuz.
  const gecmis = await prisma.counterReading.findMany({
    where: { tenantId, deviceId },
    orderBy: { readingDate: 'desc' },
    take: 6,
    select: { readingDate: true, counterBlack: true, counterColor: true },
  });
  const prev = gecmis[0] ?? null;

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

  // ── DÜŞÜŞTE DELTA ─────────────────────────────────────────────────────
  // Eskiden `reset` onayı verildiğinde delta = OKUNAN DEĞER oluyordu. Bu yalnız
  // "sayaç sıfırlandı" için doğru. "Cihaz değişti"de felaket üretiyordu:
  // müşteride 620.000'de arızalanan makinenin yerine depodan 480.000 sayfalık
  // ikinci el takılınca, o makinenin ÖMÜR BOYU sayacı o ayın kullanımı sayılıp
  // faturalanıyordu — ₺0,42'den ₺201.600 yanlış fatura.
  //
  // Artık sebep ayrıştırılıyor. Tür belirtilmemişse CIHAZ_DEGISTI varsayılır:
  // eksik faturalamak, fahiş faturalamaktan iyidir; eksik kalan sayfa bir
  // sonraki okumada zaten farka giriyor, fahiş fatura ise müşteriyi kaybettirir.
  /**
   * ── CİHAZ DEĞİŞİMİ ARTIK HER İKİ YÖNDE DE KORUYOR ───────────────────
   * İlk düzeltmede koşul yalnız DÜŞÜŞE bakıyordu (`yeni < onceki`). Oysa
   * sahada ters yön DAHA SIK: bayi müşterideki 10.000 sayfalık makineyi
   * alıp depodan 480.000 sayfalık ikinci el takıyor — sayaç DÜŞMÜYOR,
   * ARTIYOR. O hâlde eski koşul hiç devreye girmiyor ve aradaki 470.000
   * sayfa o ayın kullanımı sayılıp faturalanıyordu.
   * (Uçtan uca testte ölçüldü: fark 470.000, tutar ₺235.000.)
   *
   * Doğrusu yönden bağımsız: takılan makinenin geçmişi, müşterinin bu ay
   * bastığı sayfa DEĞİLDİR. Bu dönemin farkı sıfırdır; yeni sayaç
   * başlangıç olur ve bir sonraki okuma farkı doğru hesaplar.
   */
  const deltaBlack = okumaFarki(counterBlack, prevB, reset, resetTur);
  const deltaColor = okumaFarki(counterColor, prevC, reset, resetTur);

  // ── ANOMALİ: "bu artış bu makineye ait olamaz" ──────────────────────
  // Eskiden tek sabit eşik vardı (delta > 200.000). İki yönde de kördü:
  // ayda 3.000 basan makinenin 150.000'e fırlaması eşiğin ALTINDA kalıyor,
  // gerçekten ayda 250.000 basan matbaa makinesi ise HER AY uyarı üretip
  // bayiyi uyarılara bakmaz hâle getiriyordu. Artık ölçüt makinenin kendi
  // geçmişi. Sıfırlama/cihaz değişiminde bakılmıyor: bayi zaten beyan etti.
  let anomali: AnomaliSonucu | null = null;
  if (!reset) {
    const gecenGun = prev ? (Date.now() - new Date(prev.readingDate).getTime()) / 86400000 : 1;
    anomali = anomaliDegerlendir(deltaBlack + deltaColor, gecenGun, gecmis);
  }
  // Şüphe faturayı DURDURMAZ — okuma normal yazılır, karar bayinindir.
  // Sistemin sessizce para tutması, yanlış faturadan daha kötü bir sürprizdir.
  const warning = anomali?.supheli ? anomali.aciklama : null;

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

  return { reading, breakdown, warning, anomali, deltaBlack, deltaColor, calculatedCost };
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
