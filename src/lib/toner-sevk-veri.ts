/**
 * TONER SEVKİ — veri katmanı.
 *
 *   · sevkBaglami: her cihaz ve kanal için ihtiyaç, önerilen toner, yolda
 *     olan sevk. Sarf Takibi ve tedarikçi siparişi aynı bağlamı kullanır.
 *   · sevkEt: sevk kaydı + stok düşüşü TEK işlemde. Aynı cihaz+kanala
 *     ikinci açık sevki veritabanı reddeder (kısmi tekil indeks); stok
 *     yetmezse sevk de yazılmaz.
 *   · sevkIptal: yanlış gönderim geri alınır, stok geri gelir.
 *
 * Değişim görülünce sevki "takıldı"ya çeviren bağ verim-ogrenme.ts
 * degisimKaydet içinde: bütün değişimler (tarayıcı, fiş, elle) oradan geçer.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { kanalKarari, tonerMu } from '@/lib/verim-ogrenme';
import { modelAnahtari } from '@/lib/toner-verimi';
import {
  ihtiyacSebebi, onerilenParca, enSik, sevkIstegiAyikla,
  type Kanal, type SevkHatasi, type IhtiyacSebebi, type OneriKaynagi,
} from '@/lib/toner-sevk';
import type { TonerCihazi } from '@/lib/toner-veri';

export interface KanalSevk {
  ihtiyac: IhtiyacSebebi | null;
  oneri: { id: string; ad: string; stok: number; kaynak: OneriKaynagi } | null;
  yolda: { id: string; tarih: string; parcaAd: string | null } | null;
}

const KANALLAR: Kanal[] = ['BLACK', 'COLOR'];

export async function sevkBaglami(tenantId: string, cihazlar: readonly TonerCihazi[]) {
  const ids = cihazlar.map((c) => c.id);
  const [acikSevkler, degisimler, parcalar, fisParcalari] = await Promise.all([
    ids.length
      ? prisma.tonerSevki.findMany({
          where: { tenantId, durum: 'GONDERILDI', deviceId: { in: ids } },
          select: { id: true, deviceId: true, channel: true, partId: true, gonderildiAt: true },
        })
      : [],
    // Hangi cihaza hangi toner takıldı (eskiden yeniye: sonuncusu kazanır).
    prisma.tonerChange.findMany({
      where: { tenantId, partId: { not: null } },
      orderBy: { changedAt: 'asc' },
      select: { deviceId: true, channel: true, partId: true, device: { select: { brand: true, model: true } } },
    }),
    prisma.part.findMany({
      where: { tenantId },
      select: { id: true, name: true, sku: true, oemCode: true, group: true, stockQty: true },
    }),
    ids.length
      ? prisma.ticketPart.findMany({
          where: { tenantId, ticket: { deviceId: { in: ids }, deletedAt: null } },
          orderBy: { createdAt: 'asc' },
          select: { partId: true, ticket: { select: { deviceId: true } }, part: { select: { name: true, group: true } } },
        })
      : [],
  ]);

  const parcaMap = new Map(parcalar.map((p) => [p.id, p]));
  const tonerParcalari = parcalar
    .filter((p) => tonerMu({ group: p.group, name: p.name }))
    .map((p) => ({ id: p.id, ad: p.name, kod: p.oemCode || p.sku || null, stok: p.stockQty }))
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

  const sonTakilan = new Map<string, string>();
  const modelTakilan = new Map<string, string[]>();
  for (const d of degisimler) {
    sonTakilan.set(`${d.deviceId}|${d.channel}`, d.partId!);
    const m = `${modelAnahtari(d.device.brand, d.device.model)}|${d.channel}`;
    (modelTakilan.get(m) ?? modelTakilan.set(m, []).get(m)!).push(d.partId!);
  }
  const fisByCihaz = new Map<string, { partId: string; name: string; group: string | null }[]>();
  for (const f of fisParcalari) {
    const a = f.ticket.deviceId;
    (fisByCihaz.get(a) ?? fisByCihaz.set(a, []).get(a)!).push({ partId: f.partId, name: f.part.name, group: f.part.group });
  }
  const yoldaMap = new Map(acikSevkler.map((s) => [`${s.deviceId}|${s.channel}`, s]));

  const kanallar = new Map<string, Partial<Record<Kanal, KanalSevk>>>();
  const ihtiyaclar: { deviceId: string; channel: Kanal; partId: string | null; yolda: boolean }[] = [];
  let hazir = 0;
  for (const c of cihazlar) {
    const kayit: Partial<Record<Kanal, KanalSevk>> = {};
    for (const kanal of KANALLAR) {
      const tahmin = kanal === 'BLACK' ? c.black : c.color;
      const yoldaSevk = yoldaMap.get(`${c.id}|${kanal}`);
      if (!tahmin && !yoldaSevk) continue;
      const ihtiyac = ihtiyacSebebi(tahmin);
      // Fişte kullanılan tonerin kanalı tahmin edilmez: ad ya da cihaz söylemiyorsa sayılmaz.
      const sonFis = [...(fisByCihaz.get(c.id) ?? [])].reverse().find((f) =>
        tonerMu({ group: f.group, name: f.name })
        && kanalKarari({ group: f.group, name: f.name }, { tonerYieldColor: c.tonerYieldColor, counterColor: c.counterColor }).kanal === kanal);
      const oneri = onerilenParca({
        sonTakilan: sonTakilan.get(`${c.id}|${kanal}`) ?? null,
        sonFis: sonFis?.partId ?? null,
        modelEnSik: enSik(modelTakilan.get(`${c.modelAnahtari}|${kanal}`) ?? []),
      });
      const p = oneri ? parcaMap.get(oneri.partId) : undefined;
      const yolda = yoldaSevk
        ? { id: yoldaSevk.id, tarih: yoldaSevk.gonderildiAt.toISOString(), parcaAd: yoldaSevk.partId ? parcaMap.get(yoldaSevk.partId)?.name ?? null : null }
        : null;
      kayit[kanal] = {
        ihtiyac,
        oneri: oneri && p ? { id: p.id, ad: p.name, stok: p.stockQty, kaynak: oneri.kaynak } : null,
        yolda,
      };
      if (ihtiyac) {
        ihtiyaclar.push({ deviceId: c.id, channel: kanal, partId: p?.id ?? null, yolda: Boolean(yolda) });
        if (!yolda && p && p.stockQty >= 1) hazir++;
      }
    }
    if (Object.keys(kayit).length) kanallar.set(c.id, kayit);
  }
  return { kanallar, tonerParcalari, ihtiyaclar, hazir };
}

export type SevkSonucu =
  | { ok: true; id: string; deviceId: string; channel: Kanal; stok: number | null }
  | { ok: false; deviceId: string | null; channel: Kanal | null; hata: SevkHatasi };

class SevkReddi extends Error { constructor(public kod: SevkHatasi) { super(kod); } }

const tekilIhlali = (e: unknown) =>
  (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
  || /TonerSevki_acik_tekil|23505|unique constraint/i.test(String((e as Error)?.message ?? ''));

/** Tek bir sevk: kayıt + stok düşüşü aynı işlemde. */
async function tekSevk(tenantId: string, gonderenId: string | null, ham: unknown): Promise<SevkSonucu> {
  const istek = sevkIstegiAyikla(ham);
  if (typeof istek === 'string') {
    const o = (ham ?? {}) as Record<string, unknown>;
    return { ok: false, deviceId: typeof o.deviceId === 'string' ? o.deviceId : null, channel: null, hata: istek };
  }
  const { deviceId, channel, partId, adet } = istek;
  const ret = (hata: SevkHatasi): SevkSonucu => ({ ok: false, deviceId, channel, hata });

  const cihaz = await prisma.device.findFirst({ where: { id: deviceId, tenantId }, select: { id: true } });
  if (!cihaz) return ret('CIHAZ_YOK');
  if (partId) {
    const parca = await prisma.part.findFirst({ where: { id: partId, tenantId }, select: { id: true } });
    if (!parca) return ret('PARCA_YOK');
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const sevk = await tx.tonerSevki.create({
        data: { tenantId, deviceId, channel, partId, adet, gonderenId },
        select: { id: true },
      });
      let stok: number | null = null;
      if (partId) {
        const d = await tx.part.updateMany({
          where: { id: partId, tenantId, stockQty: { gte: adet } },
          data: { stockQty: { decrement: adet } },
        });
        if (d.count !== 1) throw new SevkReddi('STOK_YETERSIZ');
        stok = (await tx.part.findUnique({ where: { id: partId }, select: { stockQty: true } }))?.stockQty ?? null;
      }
      return { ok: true as const, id: sevk.id, deviceId, channel, stok };
    });
  } catch (e) {
    if (e instanceof SevkReddi) return ret(e.kod);
    if (tekilIhlali(e)) return ret('ZATEN_YOLDA');
    throw e;
  }
}

/**
 * Bir ya da birden çok sevk. Her biri BAĞIMSIZ: biri reddedilirse (stok
 * bitti, zaten yolda) diğerleri yine gönderilir ve sonuç satır satır döner.
 */
export async function sevkEt(tenantId: string, gonderenId: string | null, istekler: readonly unknown[]): Promise<SevkSonucu[]> {
  const sonuc: SevkSonucu[] = [];
  // Sırayla: aynı tonerden birden çok cihaza gönderilirken stok tek tek düşsün.
  for (const i of istekler.slice(0, 200)) sonuc.push(await tekSevk(tenantId, gonderenId, i));
  return sonuc;
}

export type IptalSonucu = { durum: 'TAMAM'; stok: number | null } | { durum: 'YOK' } | { durum: 'KAPANMIS' };

/** Yolda olan sevki geri alır; stok geri gelir. Takılmış sevk iptal edilmez. */
export async function sevkIptal(tenantId: string, id: string): Promise<IptalSonucu> {
  const sevk = await prisma.tonerSevki.findFirst({ where: { id, tenantId }, select: { id: true, durum: true, partId: true, adet: true } });
  if (!sevk) return { durum: 'YOK' };
  return prisma.$transaction(async (tx) => {
    const al = await tx.tonerSevki.updateMany({
      where: { id, tenantId, durum: 'GONDERILDI' },
      data: { durum: 'IPTAL', iptalAt: new Date() },
    });
    if (al.count !== 1) return { durum: 'KAPANMIS' as const };
    let stok: number | null = null;
    if (sevk.partId) {
      const p = await tx.part.updateMany({ where: { id: sevk.partId, tenantId }, data: { stockQty: { increment: sevk.adet } } });
      if (p.count === 1) stok = (await tx.part.findUnique({ where: { id: sevk.partId }, select: { stockQty: true } }))?.stockQty ?? null;
    }
    return { durum: 'TAMAM' as const, stok };
  });
}

/** Son 90 günde sevk edilen adet, parça başına (tedarikçi siparişinin kullanım sayısına girer). */
export async function sevkKullanimi(tenantId: string, partIds: readonly string[], gun = 90): Promise<Map<string, number>> {
  if (!partIds.length) return new Map();
  const g = await prisma.tonerSevki.groupBy({
    by: ['partId'],
    where: { tenantId, partId: { in: [...partIds] }, durum: { not: 'IPTAL' }, gonderildiAt: { gte: new Date(Date.now() - gun * 86_400_000) } },
    _sum: { adet: true },
  });
  return new Map(g.filter((x) => x.partId).map((x) => [x.partId as string, x._sum.adet ?? 0]));
}
