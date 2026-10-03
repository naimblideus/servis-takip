/**
 * TONER ÜRÜNÜ KARNESİ — veri katmanı. Saf hesap verim-karnesi.ts'te
 * (urunGozlemleri / urunSatirlari): aynı makinede hangi toner ürünü sayfa
 * başı daha ucuza geliyor. Fiyat: stok kartının ortalama maliyeti, yoksa
 * alış fiyatı — teklif motoruyla aynı kural.
 */
import { prisma } from '@/lib/prisma';
import { modelAnahtari } from '@/lib/toner-verimi';
import { urunGozlemleri, urunSatirlari, type UrunSatiri, type UrunParcasi } from '@/lib/verim-karnesi';

export async function tonerUrunKarnesi(tenantId: string): Promise<Record<string, UrunSatiri[]>> {
  const kayitlar = await prisma.tonerChange.findMany({
    where: { tenantId },
    select: {
      deviceId: true, channel: true, changedAt: true, partId: true, observedYield: true,
      device: { select: { brand: true, model: true } },
    },
  });
  const gozlemler = urunGozlemleri(kayitlar.map((k) => ({
    deviceId: k.deviceId, channel: k.channel, changedAt: k.changedAt, partId: k.partId,
    observedYield: k.observedYield, model: modelAnahtari(k.device.brand, k.device.model),
  })));
  const partIds = [...new Set([...gozlemler.keys()].map((a) => a.slice(a.lastIndexOf('|') + 1)))];
  const parcalar = partIds.length
    ? await prisma.part.findMany({
        where: { tenantId, id: { in: partIds } },
        select: { id: true, name: true, sku: true, oemCode: true, avgCost: true, buyPrice: true },
      })
    : [];
  const parcaMap = new Map<string, UrunParcasi>(parcalar.map((p) => {
    const fiyat = Number(p.avgCost ?? 0) || Number(p.buyPrice ?? 0);
    return [p.id, { ad: p.name, kod: p.oemCode || p.sku || null, fiyat: fiyat > 0 ? fiyat : null }];
  }));
  return Object.fromEntries(urunSatirlari(gozlemler, parcaMap));
}
