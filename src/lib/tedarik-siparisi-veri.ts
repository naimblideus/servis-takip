// TEDARİKÇİ SİPARİŞİ — veri katmanı. Yalnız OKUR; sipariş kaydı tutmaz.
// Mal gelince bayi Stok → Alış'tan girer: stok ve ortalama maliyet oradan
// güncellenir (tek yazma yolu orada).

import { prisma } from '@/lib/prisma';
import { siparisGruplari, siparisGerekli, type SiparisParcasi } from '@/lib/tedarik-siparisi';
import { tonerDurumu } from '@/lib/toner-veri';
import { sevkBaglami, sevkKullanimi } from '@/lib/toner-sevk-veri';
import { cihazTalebi } from '@/lib/toner-sevk';

const GUN = 86_400_000;

export async function siparisVerisi(tenantId: string) {
  const parcalar = await prisma.part.findMany({
    where: { tenantId },
    select: { id: true, name: true, sku: true, oemCode: true, group: true, stockQty: true, minStock: true },
  });
  // Cihazlardan doğan talep: toneri bitmek üzere olan, tonerini bildiğimiz
  // ve henüz gönderilmemiş cihazlar (Sarf Takibi ile aynı hesap).
  const durum = await tonerDurumu(tenantId);
  const talep = cihazTalebi((await sevkBaglami(tenantId, durum.takipli)).ihtiyaclar);

  // İki kolonu karşılaştıran koşul (stok ≤ asgari) Prisma'da yazılamıyor;
  // bayi başına birkaç yüz kalem, bellekte süzmek ucuz.
  const kritik = parcalar.filter((p) => siparisGerekli({ stok: p.stockQty, asgari: p.minStock, cihazTalebi: talep.get(p.id) ?? 0 }));
  const ids = kritik.map((p) => p.id);

  const [kullanim, alislar, sevkler] = ids.length ? await Promise.all([
    prisma.ticketPart.groupBy({
      by: ['partId'],
      where: { tenantId, partId: { in: ids }, createdAt: { gte: new Date(Date.now() - 90 * GUN) } },
      _sum: { quantity: true },
    }),
    // Her kalemin EN SON alışı: tedarikçi ve birim fiyat buradan.
    prisma.partPurchase.findMany({
      where: { tenantId, partId: { in: ids } },
      orderBy: [{ partId: 'asc' }, { purchasedAt: 'desc' }],
      distinct: ['partId'],
      select: { partId: true, supplier: true, unitCost: true },
    }),
    // Müşteriye sevk edilen toner de kullanımdır; sayılmazsa öneri eksik kalır.
    sevkKullanimi(tenantId, ids),
  ]) : [[], [], new Map<string, number>()];

  const kullanimi = new Map(kullanim.map((k) => [k.partId, (k._sum.quantity ?? 0) + (sevkler.get(k.partId) ?? 0)]));
  for (const [id, n] of sevkler) if (!kullanimi.has(id)) kullanimi.set(id, n);
  const sonAlis = new Map(alislar.map((a) => [a.partId, a]));

  const girdi: SiparisParcasi[] = kritik.map((p) => {
    const a = sonAlis.get(p.id);
    return {
      id: p.id, ad: p.name, sku: p.sku, oemKodu: p.oemCode, grup: p.group,
      stok: p.stockQty, asgari: p.minStock, kullanim90: kullanimi.get(p.id) ?? 0,
      cihazTalebi: talep.get(p.id) ?? 0,
      alisVar: !!a,
      sonTedarikci: a?.supplier?.trim() || null,
      sonFiyat: a ? Number(a.unitCost) : null,
    };
  });
  return { ...siparisGruplari(girdi), kritikSayisi: kritik.length };
}
