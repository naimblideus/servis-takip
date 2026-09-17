/**
 * FİLO OPTİMİZASYONU — VERİTABANI KATMANI.
 *
 * Saf hesap src/lib/filo.ts'te; burası veriyi toplayıp oraya veriyor.
 *
 * HIZ AYNI İŞLEVDEN: aylık sayfa, toner tahmini ve periyodik bakımın
 * kullandığı lib/toner.ts dailyRate ile hesaplanıyor. Üç ekranın aynı cihaz
 * için farklı sayfa hızı söylemesi kabul edilemez.
 *
 * TEK FARK SIFIR. dailyRate, sayaç artışı sıfır olduğunda null döner ve bu
 * toner tahmini için DOĞRUDUR: sıfır hızda tükenme tahmini yapılamaz. Ama
 * bu ekranın en değerli satırı tam olarak sıfırdır — boşta duran makine.
 * O yüzden sıfır artış ayrıca tespit edilip 0 olarak veriliyor; "hiç veri
 * yok" ile "hiç basmıyor" bu ekranda asla aynı şey değil.
 *
 * AŞIM FİYATI faturalamanın kullandığı sıradan okunuyor (lib/invoicing.ts
 * overagePrices): cihazın aşım fiyatı > cihazın sayfa fiyatı > bayi
 * varsayılanı. Fiyat sıfır/tanımsızsa TUTAR ÜRETİLMEZ — "₺0 aşım" yazmak,
 * her ay fatura edilen bir bedeli yok göstermek olurdu.
 */
import { prisma } from '@/lib/prisma';
import { dailyRate, type TonerReadingPoint } from '@/lib/toner';
import { overagePrices } from '@/lib/invoicing';
import { filoDurumu, filoOzeti, filoSira, type FiloSonuc, type FiloOzeti } from '@/lib/filo';

/** Kullanım penceresi (ay). Kısa pencere mevsimsel dalgayı hıza yazar. */
export const PENCERE_AY = 3;
const GUN_AY = 30.44;

export interface FiloSatiri {
  deviceId: string;
  brand: string;
  model: string;
  serialNo: string;
  location: string | null;
  musteriId: string | null;
  musteri: string;
  kiralik: boolean;
  aylikKira: number;
  dahilSiyah: number;
  dahilRenkli: number;
  aylikSiyah: number | null;
  aylikRenkli: number | null;
  renkliCihaz: boolean;
  durum: FiloSonuc;
}

export interface FiloRaporu {
  ay: number;
  ozet: FiloOzeti;
  satirlar: FiloSatiri[];
}

/**
 * Sıfır artış tespiti.
 *
 * dailyRate'in null dönmesinin iki sebebi var: veri yetersiz ya da artış
 * pozitif değil. Burada ikisini ayırmak zorundayız — biri "bilmiyorum",
 * öteki "hiç basmamış".
 */
function sifirArtis(points: TonerReadingPoint[], channel: 'black' | 'color'): boolean {
  if (!points || points.length < 2) return false;
  const sirali = [...points].sort(
    (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime(),
  );
  const ilk = sirali[0], son = sirali[sirali.length - 1];
  const gun = (new Date(son.readingDate).getTime() - new Date(ilk.readingDate).getTime()) / 86_400_000;
  if (gun < 0.5) return false;
  const deger = (p: TonerReadingPoint) => (channel === 'black' ? p.counterBlack : p.counterColor);
  return deger(son) - deger(ilk) === 0;
}

/** Aylık sayfa: hız varsa oradan, sıfır artış varsa 0, yoksa null. */
function aylikSayfa(points: TonerReadingPoint[], channel: 'black' | 'color'): number | null {
  const hiz = dailyRate(points, channel);
  if (hiz !== null) return Math.round(hiz * GUN_AY);
  return sifirArtis(points, channel) ? 0 : null;
}

export async function filoRaporu(
  tenantId: string,
  ay: number = PENCERE_AY,
  bugun: Date = new Date(),
): Promise<FiloRaporu> {
  const pencere = Math.min(12, Math.max(1, Math.round(ay)));
  const bas = new Date(bugun.getTime() - pencere * GUN_AY * 86_400_000);

  const bayi = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { pricePerBlack: true, pricePerColor: true },
  });

  const cihazlar = await prisma.device.findMany({
    where: { tenantId },
    select: {
      id: true, brand: true, model: true, serialNo: true, location: true,
      isRental: true, monthlyRent: true,
      includedBlack: true, includedColor: true,
      pricePerBlack: true, pricePerColor: true,
      overagePriceBlack: true, overagePriceColor: true,
      customer: { select: { id: true, name: true } },
    },
    take: 5000,
  });
  if (!cihazlar.length) return { ay: pencere, ozet: filoOzeti([]), satirlar: [] };

  const okumalar = await prisma.counterReading.findMany({
    where: { tenantId, deviceId: { in: cihazlar.map((c) => c.id) }, readingDate: { gte: bas } },
    select: { deviceId: true, readingDate: true, counterBlack: true, counterColor: true },
    orderBy: { readingDate: 'asc' },
  });
  const cihazOkuma = new Map<string, TonerReadingPoint[]>();
  for (const o of okumalar) {
    if (!cihazOkuma.has(o.deviceId)) cihazOkuma.set(o.deviceId, []);
    cihazOkuma.get(o.deviceId)!.push(o);
  }

  const satirlar: FiloSatiri[] = cihazlar.map((c) => {
    const noktalar = cihazOkuma.get(c.id) ?? [];
    const aylikSiyah = aylikSayfa(noktalar, 'black');
    const aylikRenkli = aylikSayfa(noktalar, 'color');
    const son = noktalar.length ? noktalar[noktalar.length - 1] : null;

    const fiyat = overagePrices(c as never, (bayi ?? { pricePerBlack: 0, pricePerColor: 0 }) as never);
    // Fiyat sıfır/tanımsızsa tutar üretilmez: "₺0 aşım" yazmak, her ay
    // faturalanan bir bedeli yok göstermek olurdu.
    const asimFiyatSiyah = fiyat.black > 0 ? fiyat.black : null;
    const asimFiyatRenkli = fiyat.color > 0 ? fiyat.color : null;

    return {
      deviceId: c.id,
      brand: c.brand, model: c.model, serialNo: c.serialNo, location: c.location,
      musteriId: c.customer?.id ?? null,
      musteri: c.customer?.name ?? '—',
      kiralik: c.isRental,
      aylikKira: Number(c.monthlyRent ?? 0),
      dahilSiyah: c.includedBlack ?? 0,
      dahilRenkli: c.includedColor ?? 0,
      aylikSiyah, aylikRenkli,
      // Kümülatif renkli sayacı sıfırdan büyükse cihaz renkli basabiliyor.
      // Sıfırsa "renkli basmıyor" değil BİLİNMİYOR sayılır: makine siyah-beyaz
      // da olabilir, hiç renkli basılmamış da olabilir. O yüzden hüküm yok.
      renkliCihaz: !!son && son.counterColor > 0,
      durum: filoDurumu({
        kiralik: c.isRental,
        aylikKira: Number(c.monthlyRent ?? 0),
        dahilSiyah: c.includedBlack ?? 0,
        dahilRenkli: c.includedColor ?? 0,
        aylikSiyah, aylikRenkli,
        renkliCihaz: !!son && son.counterColor > 0,
        asimFiyatSiyah, asimFiyatRenkli,
      }),
    };
  });

  satirlar.sort((a, b) => {
    const s = filoSira(a.durum) - filoSira(b.durum);
    if (s !== 0) return s;
    // Aynı durumda: parası büyük olan üstte (aşımda tutar, boştada kira).
    const para = (x: FiloSatiri) => (x.durum.asimTutar ?? 0) + (x.durum.durum === 'HIC_BASMIYOR' ? x.aylikKira : 0);
    return para(b) - para(a);
  });

  return { ay: pencere, ozet: filoOzeti(satirlar.map((s) => s.durum)), satirlar };
}
