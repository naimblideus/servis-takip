import { prisma } from '@/lib/prisma';

/**
 * STOK MALİYETİ — aynı parçayı farklı yerlerden farklı fiyata alınca.
 *
 * ── SORUN ────────────────────────────────────────────────────────────────
 * Bayi aynı toneri üç ayrı tedarikçiden üç ayrı fiyata alıyor, hepsini aynı
 * rafa koyuyor. Sistemde ise alış fiyatı TEK BİR SAYI. O sayı ya boş
 * kalıyor ya son alışla eziliyor; ikisinde de elindeki stoğun gerçek
 * maliyetini vermiyor.
 *
 * Ölçüldü (2026-09-14): 688 parçanın 670'inde alış fiyatı sıfır ve 8.188
 * fiş kullanımı bu sıfırlarla maliyetleniyor. Kârlılığın maliyet tarafı
 * tamamen kör.
 *
 * ── ÇÖZÜM: HAREKETLİ AĞIRLIKLI ORTALAMA ──────────────────────────────────
 * Her alış ayrı kayıt. Ortalama her alışta yeniden hesaplanıyor:
 *
 *     yeni = (eskiStok × eskiOrtalama + adet × birimAlış) ÷ (eskiStok + adet)
 *
 * Kullanım ortalamayı DEĞİŞTİRMİYOR — 10 tanesi ₺100'e alınmış bir raftan
 * bir tane çıkınca kalanların maliyeti yine ₺100. Bu, TR muhasebesinin de
 * kullandığı yöntem ve bayiye anlatması kolay: "elimdekinin ortalaması".
 *
 * ── NEDEN FIFO DEĞİL ─────────────────────────────────────────────────────
 * FIFO hangi kartuşun hangi partiden çıktığını bilmeyi gerektiriyor. Raftaki
 * tonerler karışık duruyor ve teknisyen eline geleni alıyor; parti takibi
 * yapmayan bir sahada FIFO gerçeği değil, kâğıt üstünde bir sırayı ölçer.
 */

/** Ağırlıklı ortalamanın kendisi. Saf fonksiyon — testin asıl konusu. */
export function yeniOrtalama(args: {
  eskiStok: number;
  eskiOrtalama: number | null;
  adet: number;
  birimAlis: number;
}): number | null {
  const { adet, birimAlis } = args;
  if (!(adet > 0) || !(birimAlis >= 0)) return args.eskiOrtalama;

  // Negatif stok (fazla düşülmüş) ortalamayı ters çevirirdi; sıfır sayılıyor.
  const eskiStok = Math.max(0, args.eskiStok);
  // Eski ortalama bilinmiyorsa eski stoğun maliyeti de bilinmiyor demektir.
  // O stoğu sıfır maliyetli saymak ortalamayı yapay olarak düşürürdü; yeni
  // alış tek bilgi kaynağı olduğu için ortalama onun fiyatı oluyor.
  if (args.eskiOrtalama === null || !(args.eskiOrtalama > 0) || eskiStok === 0) {
    return yuvarla(birimAlis);
  }
  return yuvarla((eskiStok * args.eskiOrtalama + adet * birimAlis) / (eskiStok + adet));
}

const yuvarla = (n: number) => Math.round(n * 100) / 100;

/**
 * Bir parçanın maliyeti ve bunun NE KADAR bilindiği.
 *
 * "Bilinmiyor" ile "sıfır" aynı şey değil: sıfır maliyet, kârlılığı %100
 * gösterir ve bayi o rakama bakıp fiyat kararı verir.
 */
export type Maliyet = {
  deger: number | null;
  kaynak: 'ORTALAMA' | 'SON_ALIS' | null;
  aciklama: string;
};

export function parcaMaliyeti(part: {
  avgCost?: number | null;
  buyPrice?: number | null;
}): Maliyet {
  const ort = Number(part.avgCost ?? 0);
  if (ort > 0) return { deger: ort, kaynak: 'ORTALAMA', aciklama: 'Alışların ağırlıklı ortalaması' };
  const son = Number(part.buyPrice ?? 0);
  if (son > 0) return { deger: son, kaynak: 'SON_ALIS', aciklama: 'Son alış fiyatı — alış kaydı girilmemiş' };
  return { deger: null, kaynak: null, aciklama: 'Alış fiyatı girilmemiş — bu parça maliyete girmiyor' };
}

/**
 * Fişte kullanılan parçanın maliyeti.
 *
 * `unitCost` kullanım anında dondurulmuş değer; varsa HER ZAMAN o
 * kullanılıyor. Yoksa parçanın bugünkü maliyetine düşülüyor ve bunun bir
 * yaklaşım olduğu `tahmini` ile bildiriliyor — geçmiş kârlılık, bugünün
 * fiyatı değiştiği için sessizce değişmesin.
 */
export function kullanimMaliyeti(
  tp: { unitCost?: number | null; quantity: number },
  part: { avgCost?: number | null; buyPrice?: number | null },
): { tutar: number; tahmini: boolean; bilinmiyor: boolean } {
  const donmus = Number(tp.unitCost ?? 0);
  if (donmus > 0) return { tutar: donmus * tp.quantity, tahmini: false, bilinmiyor: false };
  const m = parcaMaliyeti(part);
  if (m.deger === null) return { tutar: 0, tahmini: false, bilinmiyor: true };
  return { tutar: m.deger * tp.quantity, tahmini: true, bilinmiyor: false };
}

// ── ALIŞ KAYDI ───────────────────────────────────────────────────────────

export type AlisGirdisi = {
  tenantId: string;
  partId: string;
  adet: number;
  birimAlis: number;
  tedarikci?: string | null;
  faturaNo?: string | null;
  tarih?: Date;
  not?: string | null;
};

export type AlisSonucu = {
  id: string;
  yeniStok: number;
  eskiOrtalama: number | null;
  yeniOrtalama: number | null;
  /** Ortalama bu alışla ne kadar değişti (yüzde). İlk alışta null. */
  degisimYuzde: number | null;
};

/**
 * Alışı kaydeder, stoğu artırır ve ortalama maliyeti günceller.
 *
 * ÜÇÜ AYNI İŞLEMDE: stok arttığı hâlde ortalama güncellenmezse maliyet
 * kalıcı olarak yanlış kalır ve bunu kimse fark etmez — rakam makul
 * görünmeye devam eder.
 */
export async function alisKaydet(girdi: AlisGirdisi): Promise<AlisSonucu> {
  const { tenantId, partId, adet, birimAlis } = girdi;
  if (!(adet > 0)) throw new Error('Adet en az 1 olmalı');
  if (!(birimAlis >= 0)) throw new Error('Birim alış fiyatı negatif olamaz');

  return prisma.$transaction(async (tx) => {
    const part = await tx.part.findFirst({
      where: { id: partId, tenantId },
      select: { id: true, stockQty: true, avgCost: true },
    });
    if (!part) throw new Error('Parça bulunamadı');

    const eskiOrtalama = part.avgCost === null ? null : Number(part.avgCost);
    const yeni = yeniOrtalama({ eskiStok: part.stockQty, eskiOrtalama, adet, birimAlis });

    const kayit = await tx.partPurchase.create({
      data: {
        tenantId, partId, quantity: adet, unitCost: birimAlis,
        supplier: girdi.tedarikci ?? null,
        invoiceNo: girdi.faturaNo ?? null,
        purchasedAt: girdi.tarih ?? new Date(),
        note: girdi.not ?? null,
        avgAfter: yeni,
      },
      select: { id: true },
    });

    const guncel = await tx.part.update({
      where: { id: partId },
      data: {
        stockQty: { increment: adet },
        avgCost: yeni,
        // buyPrice artık "SON alış fiyatı": eski ekranlar onu okumaya
        // devam ediyor ve son fiyat da gerçekten işe yarayan bir bilgi.
        buyPrice: birimAlis,
      },
      select: { stockQty: true },
    });

    return {
      id: kayit.id,
      yeniStok: guncel.stockQty,
      eskiOrtalama,
      yeniOrtalama: yeni,
      degisimYuzde: eskiOrtalama && eskiOrtalama > 0 && yeni
        ? (yeni - eskiOrtalama) / eskiOrtalama
        : null,
    };
  });
}

/**
 * TEDARİKÇİ KARŞILAŞTIRMASI — aynı parçayı kimden kaça alıyoruz.
 *
 * Bayinin "bu toneri hep buradan alıyorum" dediği yerin gerçekten ucuz olup
 * olmadığı ancak yan yana konunca görünüyor. Tek alışı olan tedarikçi de
 * listede: gizlemek, pahalı olanı saklamak olurdu.
 */
export type TedarikciSatiri = {
  tedarikci: string;
  alisSayisi: number;
  toplamAdet: number;
  ortalamaFiyat: number;
  enUcuz: number;
  enPahali: number;
  sonAlis: string;
};

export async function tedarikciKarsilastirmasi(
  tenantId: string,
  partId: string,
): Promise<TedarikciSatiri[]> {
  const alislar = await prisma.partPurchase.findMany({
    where: { tenantId, partId },
    orderBy: { purchasedAt: 'desc' },
    select: { supplier: true, quantity: true, unitCost: true, purchasedAt: true },
  });

  const grup = new Map<string, { adet: number; tutar: number; fiyatlar: number[]; son: Date }>();
  for (const a of alislar) {
    const ad = (a.supplier || '').trim() || 'Belirtilmemiş';
    const g = grup.get(ad) ?? grup.set(ad, { adet: 0, tutar: 0, fiyatlar: [], son: a.purchasedAt }).get(ad)!;
    const fiyat = Number(a.unitCost);
    g.adet += a.quantity;
    g.tutar += fiyat * a.quantity;
    g.fiyatlar.push(fiyat);
    if (a.purchasedAt > g.son) g.son = a.purchasedAt;
  }

  return [...grup.entries()]
    .map(([tedarikci, g]) => ({
      tedarikci,
      alisSayisi: g.fiyatlar.length,
      toplamAdet: g.adet,
      // Adet ağırlıklı: 100 adetlik ucuz alış, 1 adetlik pahalı alışla
      // aynı ağırlıkta sayılmamalı.
      ortalamaFiyat: yuvarla(g.tutar / g.adet),
      enUcuz: Math.min(...g.fiyatlar),
      enPahali: Math.max(...g.fiyatlar),
      sonAlis: g.son.toISOString(),
    }))
    .sort((a, b) => a.ortalamaFiyat - b.ortalamaFiyat);
}
