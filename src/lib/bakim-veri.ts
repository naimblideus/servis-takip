/**
 * PERİYODİK BAKIM — VERİTABANI KATMANI.
 *
 * Saf hesap src/lib/bakim.ts'te; burası veriyi toplayıp oraya veriyor.
 * Günlük sayfa hızı lib/toner.ts'teki dailyRate ile hesaplanıyor — toner
 * tahmini de aynı işlevi kullanıyor, böylece iki ekran aynı cihaz için
 * farklı tarih söylemiyor.
 */
import { prisma } from '@/lib/prisma';
import { dailyRate } from '@/lib/toner';
import { bakimDurumu, bakimOzeti, bakimSira, type BakimSonucu, type BakimOzeti } from '@/lib/bakim';

/** Hız hesabı için kaç günlük okuma penceresine bakılır. */
export const HIZ_PENCERESI_GUN = 120;

export interface BakimSatiri {
  deviceId: string;
  brand: string;
  model: string;
  serialNo: string;
  location: string | null;
  musteriId: string | null;
  musteri: string;
  musteriTelefon: string | null;
  /** Geçerli politika — cihazda yoksa bayinin varsayılanı. */
  sayfaAraligi: number | null;
  ayAraligi: number | null;
  /** Politika cihazdan mı bayi varsayılanından mı geldi (ekran bunu söyler). */
  politikaKaynak: 'CIHAZ' | 'VARSAYILAN' | 'YOK';
  sonBakimTarihi: string | null;
  sonBakimSayaci: number | null;
  guncelSayac: number | null;
  gunlukHiz: number | null;
  durum: BakimSonucu;
}

export interface BakimSonuc {
  ozet: BakimOzeti;
  satirlar: BakimSatiri[];
  varsayilanSayfa: number | null;
  varsayilanAy: number | null;
}

/**
 * Bayinin bakım planı.
 *
 * Yalnız KİRALIK cihazlar değil, bayinin baktığı bütün cihazlar listelenir:
 * bakım sorumluluğu sözleşmeden gelir ve satılmış bir makinenin bakımı da
 * sözleşmeli olabilir.
 */
export async function bakimPlani(tenantId: string, bugun: Date = new Date()): Promise<BakimSonuc> {
  const bayi = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { pmDefaultPages: true, pmDefaultMonths: true },
  });

  const cihazlar = await prisma.device.findMany({
    where: { tenantId },
    select: {
      id: true, brand: true, model: true, serialNo: true, location: true,
      pmIntervalPages: true, pmIntervalMonths: true, lastPmAt: true, lastPmCounter: true,
      customer: { select: { id: true, name: true, phone: true } },
    },
    take: 5000,
  });
  if (!cihazlar.length) {
    return {
      ozet: bakimOzeti([]), satirlar: [],
      varsayilanSayfa: bayi?.pmDefaultPages ?? null,
      varsayilanAy: bayi?.pmDefaultMonths ?? null,
    };
  }

  // Hız penceresindeki okumalar — tek sorgu, cihaz başına ayrı sorgu yok.
  const pencereBas = new Date(bugun.getTime() - HIZ_PENCERESI_GUN * 86_400_000);
  const okumalar = await prisma.counterReading.findMany({
    where: { tenantId, deviceId: { in: cihazlar.map((c) => c.id) }, readingDate: { gte: pencereBas } },
    select: { deviceId: true, readingDate: true, counterBlack: true, counterColor: true },
    orderBy: { readingDate: 'asc' },
  });
  const cihazOkuma = new Map<string, { readingDate: Date; counterBlack: number; counterColor: number }[]>();
  for (const o of okumalar) {
    if (!cihazOkuma.has(o.deviceId)) cihazOkuma.set(o.deviceId, []);
    cihazOkuma.get(o.deviceId)!.push(o);
  }

  // Güncel sayaç: pencerede okuma yoksa cihazın EN SON okumasına düşülür.
  // Pencereyi kaçırmış bir cihazın sayacını "yok" saymak, bakımı bilinmiyor
  // gösterir ve o cihaz plandan düşerdi.
  const sonOkuma = new Map<string, { counterBlack: number; counterColor: number }>();
  const eksikler = cihazlar.filter((c) => !cihazOkuma.get(c.id)?.length).map((c) => c.id);
  if (eksikler.length) {
    const son = await prisma.counterReading.findMany({
      where: { tenantId, deviceId: { in: eksikler } },
      select: { deviceId: true, counterBlack: true, counterColor: true, readingDate: true },
      orderBy: { readingDate: 'desc' },
    });
    for (const o of son) if (!sonOkuma.has(o.deviceId)) sonOkuma.set(o.deviceId, o);
  }

  const satirlar: BakimSatiri[] = cihazlar.map((c) => {
    const noktalar = cihazOkuma.get(c.id) ?? [];
    const sonNokta = noktalar.length ? noktalar[noktalar.length - 1] : sonOkuma.get(c.id) ?? null;
    const guncelSayac = sonNokta ? sonNokta.counterBlack + sonNokta.counterColor : null;

    // TOPLAM sayfa hızı: bakım kiti siyah/renkli ayırmaz, toplam baskıyla aşınır.
    const toplamNoktalar = noktalar.map((n) => ({
      readingDate: n.readingDate,
      counterBlack: n.counterBlack + n.counterColor,
      counterColor: 0,
    }));
    const gunlukHiz = dailyRate(toplamNoktalar, 'black');

    const cihazPolitika = c.pmIntervalPages !== null || c.pmIntervalMonths !== null;
    const sayfaAraligi = cihazPolitika ? c.pmIntervalPages : (bayi?.pmDefaultPages ?? null);
    const ayAraligi = cihazPolitika ? c.pmIntervalMonths : (bayi?.pmDefaultMonths ?? null);
    const politikaKaynak: BakimSatiri['politikaKaynak'] =
      cihazPolitika ? 'CIHAZ' : (sayfaAraligi || ayAraligi ? 'VARSAYILAN' : 'YOK');

    return {
      deviceId: c.id,
      brand: c.brand, model: c.model, serialNo: c.serialNo, location: c.location,
      musteriId: c.customer?.id ?? null,
      musteri: c.customer?.name ?? '—',
      musteriTelefon: c.customer?.phone ?? null,
      sayfaAraligi, ayAraligi, politikaKaynak,
      sonBakimTarihi: c.lastPmAt ? c.lastPmAt.toISOString() : null,
      sonBakimSayaci: c.lastPmCounter,
      guncelSayac,
      gunlukHiz,
      durum: bakimDurumu(
        { sayfaAraligi, ayAraligi },
        {
          sonBakimTarihi: c.lastPmAt,
          sonBakimSayaci: c.lastPmCounter,
          guncelSayac,
          gunlukHiz,
          bugun,
        },
      ),
    };
  });

  satirlar.sort((a, b) => bakimSira(a.durum) - bakimSira(b.durum));

  return {
    ozet: bakimOzeti(satirlar.map((s) => s.durum)),
    satirlar,
    varsayilanSayfa: bayi?.pmDefaultPages ?? null,
    varsayilanAy: bayi?.pmDefaultMonths ?? null,
  };
}

/**
 * "Bakım yapıldı" damgası.
 *
 * Sayaç GİRİLMEZSE cihazın en son okumasından alınır — teknisyen bakımı
 * yaptıktan sonra ayrıca sayaç yazmak zorunda kalmasın. Okuma da yoksa
 * sayaç null kalır: uydurulmuş bir başlangıç, sonraki bütün bakım
 * tahminlerini kaydırır.
 */
export async function bakimYapildi(
  tenantId: string, deviceId: string, tarih: Date, sayac?: number | null,
): Promise<{ lastPmAt: Date; lastPmCounter: number | null } | null> {
  const cihaz = await prisma.device.findFirst({ where: { id: deviceId, tenantId }, select: { id: true } });
  if (!cihaz) return null;

  let deger = typeof sayac === 'number' && Number.isFinite(sayac) && sayac >= 0 ? Math.round(sayac) : null;
  if (deger === null) {
    const son = await prisma.counterReading.findFirst({
      where: { tenantId, deviceId },
      select: { counterBlack: true, counterColor: true },
      orderBy: { readingDate: 'desc' },
    });
    deger = son ? son.counterBlack + son.counterColor : null;
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: { lastPmAt: tarih, lastPmCounter: deger },
  });
  return { lastPmAt: tarih, lastPmCounter: deger };
}
