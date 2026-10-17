/**
 * PARÇA ÖMRÜ — VERİTABANI KATMANI.
 *
 * Saf kurallar src/lib/parca-omru.ts'te; burası veriyi toplayıp oraya verir.
 *
 * ── 5.000 CİHAZLI BAYİ ───────────────────────────────────────────────────
 * Cihaz başına sorgu YOK. Bayinin büyüklüğünden bağımsız olarak altı sorgu:
 *   1. kartında ömür yazılı parçalar,
 *   2. bu parçaların her cihazdaki EN SON takılışı (DISTINCT ON, tek geçiş),
 *   3. cihaz bilgisi + cihazın kendi bildirdiği parça kalemleri,
 *   4. her cihazın son okuması (şimdiki sayaç),
 *   5. her cihazın 90 günlük penceredeki İLK okuması (hız = ilk ile son
 *      arası; lib/toner dailyRate da yalnız uçlara bakar, aradaki yüz
 *      binlerce okumayı taşımaya gerek yok),
 *   6. takılma sayacı kayıtlı olmayan eski fişler için fiş tarihinin hemen
 *      öncesindeki ve sonrasındaki okuma (LATERAL, takılış başına iki indeks
 *      araması).
 * Tarihler sorguya ISO metin olarak gidip ::timestamp'e çevriliyor: Prisma
 * DateTime'ı UTC duvar saatiyle "timestamp without time zone" kolona yazıyor;
 * ISO metni de bu kolona aynı şekilde oturur, oturumun saat dilimi araya girmez.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  sonTakilislar, takilmaNoktasi, takilmaSayaciSec, gunlukSayfa, toplamSayac, cihazKalemleri,
  omurSatirlari, omurOzeti, stokIhtiyaci,
  HIZ_PENCERESI_GUN, ILK_SATIR, KRITIK_YUZDE, YAKINDA_YUZDE, UFUK_GUN, ESKI_OLCUM_GUN,
  type Takilis, type CozulmusTakilis, type CihazGirdisi, type OmurSatiri, type OmurOzeti, type StokKalemi,
} from '@/lib/parca-omru';

const GUN_MS = 86_400_000;

/**
 * Fişe eklenen parçanın takılma sayacı (kural: parca-omru takilmaSayaciSec).
 * Fişin okuması varsa o, yoksa cihazın son bilinen sayacı; hiçbiri yoksa null.
 */
export async function takilmaSayaciBul(tenantId: string, ticketId: string, deviceId: string): Promise<number | null> {
  const secim = { counterBlack: true, counterColor: true } as const;
  const [fisOkumasi, sonOkuma, kart] = await Promise.all([
    prisma.counterReading.findFirst({ where: { tenantId, ticketId, deviceId }, orderBy: { readingDate: 'desc' }, select: secim }),
    prisma.counterReading.findFirst({ where: { tenantId, deviceId }, orderBy: { readingDate: 'desc' }, select: secim }),
    prisma.device.findFirst({ where: { id: deviceId, tenantId }, select: secim }),
  ]);
  return takilmaSayaciSec({ fisOkumasi, sonOkuma, kart });
}

export interface ParcaOmruSonucu {
  ozet: OmurOzeti;
  /** Aciliyete göre; `tumu` verilmezse ilk ILK_SATIR satır. */
  satirlar: OmurSatiri[];
  /** Kesilmeden önceki satır sayısı. */
  toplamSatir: number;
  stok: { kalemler: StokKalemi[]; kartsiz: { ad: string; adet: number }[] };
  /** Kartında ömür yazılı parça sayısı — boş ekran "kartına ömür yazın" der. */
  omurluKart: number;
  /** Parça kalemi bildiren (ağ tarayıcısı bağlı) cihaz sayısı. */
  olcumluCihaz: number;
  esikler: { kritik: number; yakinda: number; ufuk: number; eskiOlcum: number; hizPenceresi: number };
}

interface HamTakilis {
  id: string; partId: string; adet: number; takilmaSayaci: number | null; parcaTarihi: Date;
  fisId: string; fisNo: string; fisTarihi: Date; deviceId: string; marka: string; model: string;
}
interface HamCihaz {
  id: string; brand: string; model: string; serialNo: string; publicCode: string; location: string | null;
  counterBlack: number | null; counterColor: number | null; olcumAt: Date | null; olcumParca: number | null;
  olcumSarf: unknown; musteriId: string | null; musteriAd: string | null;
}
interface HamOkuma { deviceId: string; readingDate: Date; counterBlack: number; counterColor: number }
interface HamYakin { i: number; onceTarih: Date | null; onceSiyah: number | null; onceRenkli: number | null; sonraTarih: Date | null; sonraSiyah: number | null; sonraRenkli: number | null }

/**
 * Bayinin parça ömrü listesi. `deviceId` verilirse yalnız o cihaz (cihaz
 * sayfasındaki kart); aynı modelin takılışları yine okunur, çünkü cihazın
 * bildirdiği drumun kartı başka makineden öğrenilebilir.
 */
export async function parcaOmruVerisi(
  tenantId: string,
  secenek: { deviceId?: string; tumu?: boolean; bugun?: Date } = {},
): Promise<ParcaOmruSonucu> {
  const bugun = secenek.bugun ?? new Date();
  const deviceId = secenek.deviceId;

  // 1) Ömürlü kartlar.
  const kartlar = await prisma.part.findMany({
    where: { tenantId, omurSayfa: { gt: 0 } },
    select: { id: true, name: true, group: true, omurSayfa: true, stockQty: true },
  });
  const kartHaritasi = new Map(kartlar.map((k) => [k.id, k]));

  // Cihaz sayfası: hedef cihazın modeli (model düzeyinde kart eşleşmesi için).
  let hedef: { brand: string; model: string } | null = null;
  if (deviceId) {
    hedef = await prisma.device.findFirst({ where: { id: deviceId, tenantId }, select: { brand: true, model: true } });
    if (!hedef) return bos(kartlar.length, 0);
  }

  // 2) Her cihazda her ömürlü kartın en son takılışı. Çöpteki ve iptal
  // edilen fişin parçası takılmış sayılmaz.
  const kartIdleri = kartlar.map((k) => k.id);
  const takilisSuzgeci = hedef
    ? Prisma.sql`AND (t."deviceId" = ${deviceId} OR (lower(d."brand") = lower(${hedef.brand}) AND lower(d."model") = lower(${hedef.model})))`
    : Prisma.empty;
  const hamTakilislar = kartIdleri.length
    ? await prisma.$queryRaw<HamTakilis[]>`
        SELECT DISTINCT ON (t."deviceId", tp."partId")
          tp."id", tp."partId", tp."quantity" AS "adet", tp."takilmaSayaci", tp."createdAt" AS "parcaTarihi",
          t."id" AS "fisId", t."ticketNumber" AS "fisNo", t."createdAt" AS "fisTarihi", t."deviceId",
          d."brand" AS "marka", d."model"
        FROM "TicketPart" tp
        JOIN "ServiceTicket" t ON t."id" = tp."ticketId"
        JOIN "Device" d ON d."id" = t."deviceId"
        WHERE tp."tenantId" = ${tenantId} AND t."tenantId" = ${tenantId} AND d."tenantId" = ${tenantId}
          AND tp."partId" = ANY(${kartIdleri}::text[])
          AND t."deletedAt" IS NULL AND t."status" <> 'CANCELLED'
          ${takilisSuzgeci}
        ORDER BY t."deviceId", tp."partId", t."createdAt" DESC, tp."createdAt" DESC, tp."id" DESC`
    : [];
  const takilislar: Takilis[] = [];
  for (const h of hamTakilislar) {
    const kart = kartHaritasi.get(h.partId);
    if (!kart?.omurSayfa) continue;
    takilislar.push({
      id: h.id, deviceId: h.deviceId, partId: h.partId, parcaAdi: kart.name, grup: kart.group,
      omurSayfa: kart.omurSayfa, adet: h.adet, takilmaSayaci: h.takilmaSayaci,
      fisId: h.fisId, fisNo: h.fisNo, fisTarihi: new Date(h.fisTarihi), parcaTarihi: new Date(h.parcaTarihi),
      marka: h.marka, model: h.model,
    });
  }
  const zincir = sonTakilislar(takilislar);

  // 3) Cihazlar: ömürlü parçası takılı olanlar + kendisi parça bildirenler.
  const takiliCihazlar = [...new Set(zincir.map((z) => z.deviceId))];
  const hamCihazlar = await prisma.$queryRaw<HamCihaz[]>`
    SELECT d."id", d."brand", d."model", d."serialNo", d."publicCode", d."location",
           d."counterBlack", d."counterColor", d."olcumAt", d."olcumParca", d."olcumSarf",
           c."id" AS "musteriId", c."name" AS "musteriAd"
    FROM "Device" d
    LEFT JOIN "Customer" c ON c."id" = d."customerId"
    WHERE d."tenantId" = ${tenantId}
      AND (d."olcumParca" IS NOT NULL OR d."id" = ANY(${takiliCihazlar}::text[]))
      ${deviceId ? Prisma.sql`AND d."id" = ${deviceId}` : Prisma.empty}`;
  const ids = hamCihazlar.map((c) => c.id);

  // 4–5) Şimdiki sayaç ve hız penceresinin ilk okuması.
  const pencereBas = new Date(bugun.getTime() - HIZ_PENCERESI_GUN * GUN_MS).toISOString();
  const [sonlar, ilkler] = ids.length
    ? await Promise.all([
        prisma.$queryRaw<HamOkuma[]>`
          SELECT DISTINCT ON ("deviceId") "deviceId", "readingDate", "counterBlack", "counterColor"
          FROM "CounterReading"
          WHERE "tenantId" = ${tenantId} AND "deviceId" = ANY(${ids}::text[])
          ORDER BY "deviceId", "readingDate" DESC`,
        prisma.$queryRaw<HamOkuma[]>`
          SELECT DISTINCT ON ("deviceId") "deviceId", "readingDate", "counterBlack", "counterColor"
          FROM "CounterReading"
          WHERE "tenantId" = ${tenantId} AND "deviceId" = ANY(${ids}::text[]) AND "readingDate" >= ${pencereBas}::timestamp
          ORDER BY "deviceId", "readingDate" ASC`,
      ])
    : [[] as HamOkuma[], [] as HamOkuma[]];
  const sonOkuma = new Map(sonlar.map((o) => [o.deviceId, o]));
  const ilkOkuma = new Map(ilkler.map((o) => [o.deviceId, o]));

  const cihazlar = new Map<string, CihazGirdisi>();
  let olcumluCihaz = 0;
  for (const c of hamCihazlar) {
    const son = sonOkuma.get(c.id) ?? null;
    const ilk = ilkOkuma.get(c.id) ?? null;
    const kalemler = cihazKalemleri(c.olcumSarf, c.olcumParca);
    if (kalemler.length) olcumluCihaz++;
    cihazlar.set(c.id, {
      deviceId: c.id, marka: c.brand, model: c.model, seri: c.serialNo, publicCode: c.publicCode, konum: c.location,
      musteriId: c.musteriId, musteri: c.musteriAd,
      // Son okuma faturayı belirleyen sayıdır (lib/sayac-tarama karsilastirmaSayaci); okuması hiç yoksa kart.
      guncelSayac: son ? toplamSayac(son) : toplamSayac(c),
      sayacTarihi: son ? new Date(son.readingDate).toISOString() : null,
      gunlukSayfa: son ? gunlukSayfa([...(ilk ? [ilk] : []), son], bugun) : null,
      olcumAt: c.olcumAt ? new Date(c.olcumAt) : null,
      kalemler,
    });
  }

  // 6) Takılma sayacı kayıtlı olmayan eski fişler: en yakın okumadan yaklaşık.
  const cozulecek = zincir.filter((z) => cihazlar.has(z.deviceId) && !(typeof z.takilmaSayaci === 'number' && z.takilmaSayaci > 0));
  const yakinlar = new Map<string, HamOkuma[]>();
  if (cozulecek.length) {
    const yakin = await prisma.$queryRaw<HamYakin[]>`
      SELECT x.i::int AS "i",
             o."readingDate" AS "onceTarih", o."counterBlack" AS "onceSiyah", o."counterColor" AS "onceRenkli",
             s."readingDate" AS "sonraTarih", s."counterBlack" AS "sonraSiyah", s."counterColor" AS "sonraRenkli"
      FROM unnest(${cozulecek.map((z) => z.deviceId)}::text[], ${cozulecek.map((z) => z.fisTarihi.toISOString())}::text[])
           WITH ORDINALITY AS x(cihaz, tarih, i)
      LEFT JOIN LATERAL (
        SELECT r."readingDate", r."counterBlack", r."counterColor" FROM "CounterReading" r
        WHERE r."tenantId" = ${tenantId} AND r."deviceId" = x.cihaz AND r."readingDate" <= x.tarih::timestamp
        ORDER BY r."readingDate" DESC LIMIT 1
      ) o ON true
      LEFT JOIN LATERAL (
        SELECT r."readingDate", r."counterBlack", r."counterColor" FROM "CounterReading" r
        WHERE r."tenantId" = ${tenantId} AND r."deviceId" = x.cihaz AND r."readingDate" > x.tarih::timestamp
        ORDER BY r."readingDate" ASC LIMIT 1
      ) s ON true`;
    for (const y of yakin) {
      const z = cozulecek[y.i - 1];
      if (!z) continue;
      const adaylar: HamOkuma[] = [];
      if (y.onceTarih) adaylar.push({ deviceId: z.deviceId, readingDate: y.onceTarih, counterBlack: y.onceSiyah ?? 0, counterColor: y.onceRenkli ?? 0 });
      if (y.sonraTarih) adaylar.push({ deviceId: z.deviceId, readingDate: y.sonraTarih, counterBlack: y.sonraSiyah ?? 0, counterColor: y.sonraRenkli ?? 0 });
      yakinlar.set(z.id, adaylar);
    }
  }
  const cozulmus: CozulmusTakilis[] = zincir.map((z) => ({
    ...z,
    takilma: takilmaNoktasi(z.takilmaSayaci, z.fisTarihi, yakinlar.get(z.id) ?? []),
  }));

  const satirlar = omurSatirlari({ cihazlar, takilislar: cozulmus, bugun });
  const stoklar = new Map(kartlar.map((k) => [k.id, k.stockQty]));
  return {
    ozet: omurOzeti(satirlar),
    satirlar: secenek.tumu || deviceId ? satirlar : satirlar.slice(0, ILK_SATIR),
    toplamSatir: satirlar.length,
    stok: stokIhtiyaci(satirlar, stoklar),
    omurluKart: kartlar.length,
    olcumluCihaz,
    esikler: ESIKLER,
  };
}

const ESIKLER = { kritik: KRITIK_YUZDE, yakinda: YAKINDA_YUZDE, ufuk: UFUK_GUN, eskiOlcum: ESKI_OLCUM_GUN, hizPenceresi: HIZ_PENCERESI_GUN };

function bos(omurluKart: number, olcumluCihaz: number): ParcaOmruSonucu {
  return {
    ozet: omurOzeti([]), satirlar: [], toplamSatir: 0, stok: { kalemler: [], kartsiz: [] },
    omurluKart, olcumluCihaz, esikler: ESIKLER,
  };
}

/**
 * Tedarikçi siparişi için: önümüzdeki 30 günde ömrü dolacak parçaların kart
 * başına adedi. Sipariş ekranı stoğu bu talebe göre de değerlendirir —
 * "Sipariş et" düğmesi kalemin listede OLMADIĞI bir ekrana götürmesin.
 */
export async function parcaOmruTalebi(tenantId: string): Promise<Map<string, number>> {
  const v = await parcaOmruVerisi(tenantId, { tumu: true });
  return new Map(v.stok.kalemler.map((k) => [k.partId, k.gereken]));
}
