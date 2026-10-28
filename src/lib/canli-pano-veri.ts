/**
 * CANLI OPERASYON PANOSU — VERİTABANI KATMANI.
 *
 * Saf hesap src/lib/canli-pano.ts'te; burası yalnız veriyi toplayıp oraya
 * veriyor. Ekran 15 saniyede bir soruyor ve 5.000 cihazlı bir bayide de
 * soruyor; bu yüzden üç kural var:
 *
 *   · N+1 YOK. Her bilgi tek sorgu: durum sayıları groupBy, cihaz sağlığı
 *     tek taramada FILTER'lı sayımlar, olaylar kaynak başına son 10 satır.
 *   · GEREKEN ALAN KADAR. Tutar alanı hiç seçilmiyor: ekran herkese açık
 *     bir odada duruyor (test bu dosyada para alanı aramayı denetler).
 *   · KURAL TEK YERDE. "Sayacı gelmeyen", "toner kritik", "uyarı veren" ve
 *     SLA sözü ana panelle, Ağ Tarayıcı ekranıyla ve SLA raporuyla aynı
 *     sabitlerden ve aynı yardımcılardan okunuyor.
 */
import { prisma } from '@/lib/prisma';
import { olaylariCikar, type SlaHedefi } from '@/lib/sla';
import { slaHedefleri, takvimKur } from '@/lib/sla-veri';
import { DURUM_TAZE_MS, SERVIS_UYARILARI, TONER_KRITIK, UYARI_TURU, type UyariKodu } from '@/lib/sayac-tarama';
import { effectiveModules } from '@/lib/modules';
import { magazaKiraciId } from '@/lib/magaza-baglanti';
import {
  ACIK_DURUMLAR, OLAY_SAYISI, SAYAC_GEC_GUN, SURUYOR,
  fisSayilari, gununBasi, kapanisSayilari, olayAkisi, slaKutusu, teknisyenSatirlari,
  type AcikDurum, type AcikIs, type FisSayilari, type PanoOlayi, type SlaFisGirdisi,
  type SlaKutusu, type TeknisyenSatiri,
} from '@/lib/canli-pano';

const GUN = 86_400_000;
/** Bir taramada bakılan en fazla açık fiş — sınırsız sorgu panoyu yavaşlatmasın. */
const EN_FAZLA_FIS = 3000;

/** Akışa giren cihaz uyarıları: servis isteyen ve toneri biten. Kâğıt/kapak gibi müşterinin çözdüğü durum gürültüdür. */
const AKIS_UYARILARI = (Object.keys(UYARI_TURU) as UyariKodu[]).filter((k) => UYARI_TURU[k] !== 'BILGI');

export interface CanliPanoVerisi {
  /** Verinin üretildiği an (sunucu saati) — ekrandaki "son güncelleme". */
  olusturuldu: string;
  bayi: string;
  zamanDilimi: string;
  fis: FisSayilari & {
    bugunAcilan: number;
    bugunKapanan: number;
    /** Kimseye atanmamış, işi sürmekte olan fiş. */
    atanmamis: number;
  };
  /** null = SLA hedefi tanımlı sözleşme yok; kutu çizilmez. */
  sla: SlaKutusu | null;
  teknisyenler: TeknisyenSatiri[];
  cihaz: {
    /** Ağ Tarayıcı'nın son 3 günde gördüğü cihaz. 0 ise uyarı/toner BİLİNMİYOR. */
    izlenen: number;
    uyari: number;
    servisUyari: number;
    tonerKritik: number;
    yoldaToner: number;
    sayacGelmeyen: number;
    kiralik: number;
  };
  talepler: {
    /** null = müşteri paneli bu bayide kullanılmıyor (kutu çizilmez). */
    portal: { adet: number; enEski: string | null } | null;
    /** null = WhatsApp kurulu değil (kutu çizilmez). */
    whatsapp: { adet: number; enEski: string | null } | null;
    /** null = mağaza yok. Sitedeki formdan gelen, yazılmamış talepler (son 14 gün, sabah listesiyle aynı). */
    site: { adet: number; enEski: string | null } | null;
  };
  /**
   * Mağaza işleri — null: bayinin mağazası yok (kutu çizilmez). Yalnız SAYI:
   * sipariş tutarı ekrana gelmez (oda herkese açık).
   */
  magaza: {
    /** Onay bekleyen yeni sipariş. */
    yeni: number;
    /** Onaylı, kargoya ya da dükkândan teslime hazırlanacak. */
    hazirlanacak: number;
    /** Teknisyen götürecek, henüz teslim edilmedi (Rota'daki "araca yüklenecek"le aynı kural). */
    aracaYuklenecek: number;
    /** Stok yetmediği için bekleyen sipariş. */
    stokBekleyen: number;
  } | null;
  olaylar: PanoOlayi[];
}

const cihazAdi = (d: { brand: string | null; model: string | null } | null | undefined) =>
  [d?.brand, d?.model].filter(Boolean).join(' ').trim();

/**
 * Bayinin canlı durumu.
 *
 * @param secenek.simdi              testin zamanı sabitleyebilmesi için
 * @param secenek.paylasimliWhatsapp platformun ortak WhatsApp numarası açık mı
 *                                   (uç, lib/whatsapp-inbound'dan okuyup verir)
 * @returns bayi yoksa null
 */
export async function canliPanoVerisi(
  tenantId: string,
  secenek: { simdi?: Date; paylasimliWhatsapp?: boolean } = {},
): Promise<CanliPanoVerisi | null> {
  const simdi = secenek.simdi ?? new Date();
  const bayi = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true, plan: true, modules: true, marketEnabled: true, whatsappPhoneId: true,
      workTimezone: true, workDays: true, workStartMin: true, workEndMin: true, workHolidays: true,
    },
  });
  if (!bayi) return null;

  const takvim = takvimKur(bayi);
  // Mağazanın kendi kimliği (servis kimliği değil); mağazası yoksa null.
  const magazaId = await magazaKiraciId(tenantId).catch(() => null);
  const gunBasi = gununBasi(simdi, takvim.zamanDilimi);
  const taze = new Date(simdi.getTime() - DURUM_TAZE_MS);
  const sayacEsik = new Date(simdi.getTime() - SAYAC_GEC_GUN * GUN);
  const acik = [...ACIK_DURUMLAR];
  const suruyor = [...SURUYOR];
  const whatsappKurulu = Boolean(bayi.whatsappPhoneId) || Boolean(secenek.paylasimliWhatsapp);
  const portalAcik = effectiveModules(bayi).has('PORTAL');

  const [
    durumlar, bugunAcilan, kapanislar, atanmamis, atananIsler, kisiler, hedefler,
    cihazSatiri, yoldaToner, portal, whatsapp,
    yeniFisler, gecisler, portalOlaylari, uyariOlaylari,
    magazaSatiri, siparisOlaylari, siteTalepleri,
  ] = await Promise.all([
    prisma.serviceTicket.groupBy({
      by: ['status'],
      where: { tenantId, deletedAt: null, status: { in: acik } },
      _count: { _all: true },
    }),
    prisma.serviceTicket.count({ where: { tenantId, deletedAt: null, createdAt: { gte: gunBasi, lte: simdi } } }),
    // KAPANAN = bugün "Teslim edildi"ye geçen ve hâlâ teslimde duran fiş.
    // Aşama geçmişinden: durum damgası aynı duruma tekrar basınca da
    // yenileniyor, geçmiş ise yalnız GERÇEK geçişi yazıyor. Türetilmiş
    // (GECMIS) satır aktarılmış eski fiştir, bugünün işi değildir.
    prisma.ticketStatusHistory.findMany({
      where: {
        tenantId, status: 'DELIVERED', kaynak: { not: 'GECMIS' },
        changedAt: { gte: gunBasi, lte: simdi },
        ticket: { deletedAt: null, status: 'DELIVERED' },
      },
      select: { ticketId: true, ticket: { select: { assignedUserId: true } } },
    }),
    prisma.serviceTicket.count({ where: { tenantId, deletedAt: null, assignedUserId: null, status: { in: suruyor } } }),
    prisma.serviceTicket.findMany({
      where: { tenantId, deletedAt: null, status: { in: acik }, assignedUserId: { not: null } },
      select: {
        id: true, ticketNumber: true, status: true, assignedUserId: true, statusUpdatedAt: true,
        varisAt: true, ayrilisAt: true,
        device: { select: { brand: true, model: true, customer: { select: { name: true } } } },
      },
      orderBy: { statusUpdatedAt: 'desc' },
      take: EN_FAZLA_FIS,
    }),
    // Teknisyenler + işi olan herkes: küçük bayide sahip de sahaya çıkıyor;
    // rolü yönetici diye panodan düşmesin.
    prisma.user.findMany({
      where: {
        tenantId, isActive: true,
        OR: [
          { role: 'TECHNICIAN' },
          { assignedTickets: { some: { deletedAt: null, status: { in: acik } } } },
        ],
      },
      select: { id: true, name: true },
    }),
    slaHedefleri(tenantId),
    // CİHAZ SAĞLIĞI — tek taramada altı sayı. Ölçütler ana paneldekiyle aynı:
    // ölçüm "taze" (son 3 gün) değilse cihaz "şu an" bir şey söylemiyor.
    prisma.$queryRaw<{
      izlenen: number; uyari: number; servis: number; toner: number; kiralik: number; sayacGelmeyen: number;
    }[]>`
      SELECT
        (COUNT(*) FILTER (WHERE d."olcumAt" >= ${taze}))::int AS "izlenen",
        (COUNT(*) FILTER (WHERE d."olcumAt" >= ${taze} AND cardinality(d."cihazUyarilari") > 0))::int AS "uyari",
        (COUNT(*) FILTER (WHERE d."olcumAt" >= ${taze} AND d."cihazUyarilari" && ${SERVIS_UYARILARI}::text[]))::int AS "servis",
        (COUNT(*) FILTER (WHERE d."olcumAt" >= ${taze}
          AND (d."olcumSiyah" <= ${TONER_KRITIK} OR d."olcumRenkli" <= ${TONER_KRITIK})))::int AS "toner",
        (COUNT(*) FILTER (WHERE d."isRental"))::int AS "kiralik",
        (COUNT(*) FILTER (WHERE d."isRental" AND NOT EXISTS (
          SELECT 1 FROM "CounterReading" r
          WHERE r."tenantId" = d."tenantId" AND r."deviceId" = d."id" AND r."readingDate" >= ${sayacEsik}
        )))::int AS "sayacGelmeyen"
      FROM "Device" d
      WHERE d."tenantId" = ${tenantId}
    `,
    prisma.tonerSevki.count({ where: { tenantId, durum: 'GONDERILDI' } }),
    prisma.portalRequest.aggregate({
      where: { tenantId, durum: 'BEKLIYOR' },
      _count: { _all: true }, _min: { createdAt: true },
    }),
    whatsappKurulu
      ? prisma.whatsAppMessage.aggregate({
          where: { tenantId, yon: 'GELEN', handled: false },
          _count: { _all: true }, _min: { receivedAt: true },
        })
      : Promise.resolve(null),
    prisma.serviceTicket.findMany({
      where: { tenantId, deletedAt: null, createdAt: { lte: simdi } },
      orderBy: { createdAt: 'desc' },
      take: OLAY_SAYISI,
      select: {
        id: true, ticketNumber: true, createdAt: true,
        device: { select: { brand: true, model: true, customer: { select: { name: true } } } },
      },
    }),
    // Durum değişiklikleri: ilk satır (önceki yok) fişin açılışıdır, o zaten
    // "yeni fiş" olarak geliyor; türetilmiş geçmiş gerçek bir an değildir.
    prisma.ticketStatusHistory.findMany({
      where: {
        tenantId, oncekiStatus: { not: null }, kaynak: { not: 'GECMIS' },
        changedAt: { lte: simdi }, ticket: { deletedAt: null },
      },
      orderBy: { changedAt: 'desc' },
      take: OLAY_SAYISI,
      select: {
        id: true, status: true, oncekiStatus: true, changedAt: true,
        ticket: { select: { ticketNumber: true, device: { select: { brand: true, model: true, customer: { select: { name: true } } } } } },
      },
    }),
    prisma.portalRequest.findMany({
      where: { tenantId, createdAt: { lte: simdi } },
      orderBy: { createdAt: 'desc' },
      take: OLAY_SAYISI,
      select: {
        id: true, tur: true, createdAt: true,
        customer: { select: { name: true } },
        device: { select: { brand: true, model: true } },
      },
    }),
    prisma.cihazOlayi.findMany({
      where: { tenantId, kod: { in: AKIS_UYARILARI }, basladi: { lte: simdi } },
      orderBy: { basladi: 'desc' },
      take: OLAY_SAYISI,
      select: {
        id: true, kod: true, basladi: true,
        device: { select: { brand: true, model: true, customer: { select: { name: true } } } },
      },
    }),
    // MAĞAZA — tek taramada dört sayı; mağaza tabloları yoksa (mağaza kurulmamış
    // ortam) kutu çizilmez. Yalnız durum ve teslim biçimi okunur.
    magazaId
      ? prisma.$queryRaw<{ yeni: number; hazirlanacak: number; aracaYuklenecek: number; stokBekleyen: number }[]>`
          SELECT
            (COUNT(*) FILTER (WHERE durum = 'YENI'))::int AS "yeni",
            (COUNT(*) FILTER (WHERE durum IN ('ONAYLANDI','HAZIRLANIYOR') AND teslimat <> 'TEKNISYEN'))::int AS "hazirlanacak",
            (COUNT(*) FILTER (WHERE teslimat = 'TEKNISYEN'
              AND durum IN ('YENI','ONAY_KUYRUKTA','ONAYLANDI','HAZIRLANIYOR','STOK_BEKLIYOR')))::int AS "aracaYuklenecek",
            (COUNT(*) FILTER (WHERE durum = 'STOK_BEKLIYOR'))::int AS "stokBekleyen"
          FROM shop."ShopOrder" WHERE "tenantId" = ${magazaId}
        `.catch(() => null)
      : Promise.resolve(null),
    magazaId
      ? prisma.$queryRaw<{ id: string; no: string; aliciAd: string; createdAt: Date }[]>`
          SELECT id, no, "aliciAd", "createdAt" FROM shop."ShopOrder"
          WHERE "tenantId" = ${magazaId} AND "createdAt" <= ${simdi}
          ORDER BY "createdAt" DESC LIMIT ${OLAY_SAYISI}
        `.catch(() => [] as { id: string; no: string; aliciAd: string; createdAt: Date }[])
      : Promise.resolve([] as { id: string; no: string; aliciAd: string; createdAt: Date }[]),
    magazaId
      ? prisma.$queryRaw<{ adet: number; enEski: Date | null }[]>`
          SELECT count(*)::int AS "adet", min("createdAt") AS "enEski" FROM shop."ShopTalep"
          WHERE "tenantId" = ${magazaId} AND durum = 'YENI' AND "createdAt" > ${new Date(simdi.getTime() - 14 * GUN)}
        `.catch(() => null)
      : Promise.resolve(null),
  ]);

  // ── SLA ────────────────────────────────────────────────────────────────
  // Yalnız sözü olan müşterilerin, işi hâlâ süren fişleri. "Hazır"da çözüm
  // zaten var; işleyen saat kalmamıştır.
  let sla: SlaKutusu | null = null;
  if (hedefler.size > 0) {
    const fisler = await prisma.serviceTicket.findMany({
      where: { tenantId, deletedAt: null, status: { in: suruyor }, customerId: { in: [...hedefler.keys()] } },
      select: {
        id: true, ticketNumber: true, customerId: true, createdAt: true, varisAt: true,
        device: { select: { brand: true, model: true, customer: { select: { name: true } } } },
        statusHistory: { select: { status: true, changedAt: true, kaynak: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: EN_FAZLA_FIS,
    });
    const girdiler: SlaFisGirdisi[] = fisler.map((f) => ({
      id: f.id,
      ticketNumber: f.ticketNumber,
      musteri: f.device?.customer?.name ?? '',
      cihaz: cihazAdi(f.device),
      olay: olaylariCikar(
        f.statusHistory.map((s) => ({ status: String(s.status), changedAt: s.changedAt, kaynak: s.kaynak })),
        f.createdAt,
        // SLA raporuyla aynı kural: "Vardım" basıldıysa müdahale anı odur (lib/sla.ts).
        f.varisAt,
      ),
      hedef: hedefler.get(f.customerId) as SlaHedefi,
    }));
    sla = slaKutusu(girdiler, takvim, simdi, hedefler.size);
  }

  // ── TEKNİSYENLER ───────────────────────────────────────────────────────
  // "Serviste" işin ne kadar sürdüğü, o duruma GİRİŞ anından: aşama
  // geçmişindeki son "Serviste" satırı. Durum damgası aynı duruma tekrar
  // basınca da yenilendiği için süreyi olduğundan kısa gösterebilirdi.
  const servisteIdler = atananIsler.filter((f) => f.status === 'IN_SERVICE').map((f) => f.id);
  const girisler = servisteIdler.length
    ? await prisma.ticketStatusHistory.findMany({
        where: { tenantId, ticketId: { in: servisteIdler }, status: 'IN_SERVICE' },
        orderBy: { changedAt: 'desc' },
        select: { ticketId: true, changedAt: true },
      })
    : [];
  const girisAni = new Map<string, Date>();
  for (const g of girisler) if (!girisAni.has(g.ticketId)) girisAni.set(g.ticketId, g.changedAt);

  const isler: AcikIs[] = atananIsler.map((f) => ({
    id: f.id,
    ticketNumber: f.ticketNumber,
    musteri: f.device?.customer?.name ?? '',
    cihaz: cihazAdi(f.device),
    status: f.status as AcikDurum,
    atananId: f.assignedUserId,
    durumBasi: girisAni.get(f.id) ?? f.statusUpdatedAt,
    varisAt: f.varisAt,
    ayrilisAt: f.ayrilisAt,
  }));
  const kapanan = kapanisSayilari(kapanislar.map((k) => ({ ticketId: k.ticketId, atananId: k.ticket.assignedUserId })));
  const teknisyenler = teknisyenSatirlari(
    kisiler.map((k) => ({ id: k.id, ad: k.name })), isler, kapanan.kisi, simdi,
  );

  // ── OLAYLAR ────────────────────────────────────────────────────────────
  const olaylar = olayAkisi([
    yeniFisler.map((f): PanoOlayi => ({
      id: f.id, tur: 'YENI_FIS', zaman: f.createdAt.toISOString(),
      ticketNumber: f.ticketNumber, musteri: f.device?.customer?.name ?? null, cihaz: cihazAdi(f.device) || null,
      kod: null, onceki: null,
    })),
    gecisler.map((g): PanoOlayi => ({
      id: g.id, tur: 'DURUM', zaman: g.changedAt.toISOString(),
      ticketNumber: g.ticket.ticketNumber, musteri: g.ticket.device?.customer?.name ?? null,
      cihaz: cihazAdi(g.ticket.device) || null,
      kod: String(g.status), onceki: g.oncekiStatus ? String(g.oncekiStatus) : null,
    })),
    portalOlaylari.map((p): PanoOlayi => ({
      id: p.id, tur: 'PORTAL', zaman: p.createdAt.toISOString(),
      ticketNumber: null, musteri: p.customer?.name ?? null, cihaz: cihazAdi(p.device) || null,
      kod: p.tur, onceki: null,
    })),
    uyariOlaylari.map((u): PanoOlayi => ({
      id: u.id, tur: 'UYARI', zaman: u.basladi.toISOString(),
      ticketNumber: null, musteri: u.device?.customer?.name ?? null, cihaz: cihazAdi(u.device) || null,
      kod: u.kod, onceki: null,
    })),
    siparisOlaylari.map((s): PanoOlayi => ({
      id: s.id, tur: 'SIPARIS', zaman: new Date(s.createdAt).toISOString(),
      ticketNumber: s.no, musteri: s.aliciAd || null, cihaz: null,
      kod: null, onceki: null,
    })),
  ]);
  const m = magazaSatiri?.[0];

  const c = cihazSatiri[0];
  const portalAdet = portal._count._all;
  return {
    olusturuldu: simdi.toISOString(),
    bayi: bayi.name,
    zamanDilimi: takvim.zamanDilimi,
    fis: {
      ...fisSayilari(durumlar.map((d) => ({ status: String(d.status), adet: d._count._all }))),
      bugunAcilan,
      bugunKapanan: kapanan.toplam,
      atanmamis,
    },
    sla,
    teknisyenler,
    cihaz: {
      izlenen: c?.izlenen ?? 0,
      uyari: c?.uyari ?? 0,
      servisUyari: c?.servis ?? 0,
      tonerKritik: c?.toner ?? 0,
      yoldaToner,
      sayacGelmeyen: c?.sayacGelmeyen ?? 0,
      kiralik: c?.kiralik ?? 0,
    },
    talepler: {
      // Paket dışı ama eskiden gelmiş bekleyen talep varsa yine gösterilir:
      // bekleyen müşteriyi gizlemek, kutuyu gizlemekten pahalıdır.
      portal: portalAcik || portalAdet > 0
        ? { adet: portalAdet, enEski: portal._min.createdAt?.toISOString() ?? null }
        : null,
      whatsapp: whatsapp
        ? { adet: whatsapp._count._all, enEski: whatsapp._min.receivedAt?.toISOString() ?? null }
        : null,
      site: magazaId && siteTalepleri?.[0]
        ? { adet: siteTalepleri[0].adet, enEski: siteTalepleri[0].enEski ? new Date(siteTalepleri[0].enEski).toISOString() : null }
        : null,
    },
    magaza: magazaId && m
      ? { yeni: m.yeni, hazirlanacak: m.hazirlanacak, aracaYuklenecek: m.aracaYuklenecek, stokBekleyen: m.stokBekleyen }
      : null,
    olaylar,
  };
}
