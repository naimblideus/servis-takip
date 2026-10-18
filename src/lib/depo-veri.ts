/**
 * ÇOK DEPO VE TEKNİSYEN ARACI — veritabanı katmanı.
 * Kurallar src/lib/depo.ts'te. Ana depo satır değildir: toplam − Σ DepoStok.
 *
 * ── YARIŞ ────────────────────────────────────────────────────────────────
 * Aktarım ve fişten düşüm aynı parça için kiracı+parça başına danışma
 * kilidi (pg_advisory_xact_lock) altında koşar: iki teknisyen aynı anda
 * son parçayı araçlarına almaya çalışırsa ikincisi sıradaki hâli görür.
 * Ek olarak her düşüm `adet >= n` şartıyla yazılır; kilit unutulsa bile
 * araç stoğu eksiye düşemez.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { anaDepoAdedi, ANA, type DepoAnahtari, type DepoHatasi, type DepoTuru } from '@/lib/depo';

type Tx = Prisma.TransactionClient;

const maliyet = (p: { avgCost: unknown; buyPrice: unknown }): number | null => {
  const a = Number(p.avgCost ?? 0);
  if (a > 0) return a;
  const b = Number(p.buyPrice ?? 0);
  return b > 0 ? b : null;
};

async function kilitle(tx: Tx, tenantId: string, partId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'depo:' + tenantId + ':' + partId}))`;
}

export interface DepoSatiri {
  id: string;
  ad: string;
  tur: DepoTuru | 'ANA';
  kullaniciId: string | null;
  kullaniciAdi: string | null;
  aktif: boolean;
  kalem: number;
  adet: number;
  /** Yalnız yöneticiye; teknisyende null. Maliyeti bilinmeyen kalem sayılmaz. */
  deger: number | null;
}

export interface DepoOzeti {
  ana: DepoSatiri & { eksikKalem: number };
  depolar: DepoSatiri[];
}

/** Bütün depoların özeti. `paraGoster` yalnız yöneticide true. */
export async function depoOzeti(tenantId: string, paraGoster: boolean): Promise<DepoOzeti> {
  const [parcalar, stoklar, depolar] = await Promise.all([
    prisma.part.findMany({ where: { tenantId }, select: { id: true, stockQty: true, avgCost: true, buyPrice: true } }),
    prisma.depoStok.findMany({ where: { tenantId, adet: { gt: 0 } }, select: { depoId: true, partId: true, adet: true } }),
    prisma.depo.findMany({ where: { tenantId }, orderBy: [{ tur: 'asc' }, { ad: 'asc' }], select: { id: true, ad: true, tur: true, kullaniciId: true, aktif: true } }),
  ]);
  const kullanicilar = await prisma.user.findMany({
    where: { tenantId, id: { in: depolar.map((d) => d.kullaniciId).filter((x): x is string => Boolean(x)) } },
    select: { id: true, name: true },
  });
  const adlar = new Map(kullanicilar.map((k) => [k.id, k.name]));
  const parcaMap = new Map(parcalar.map((p) => [p.id, p]));

  const digeri = new Map<string, number>();
  const depoTop = new Map<string, { kalem: number; adet: number; deger: number }>();
  for (const s of stoklar) {
    digeri.set(s.partId, (digeri.get(s.partId) ?? 0) + s.adet);
    const t = depoTop.get(s.depoId) ?? { kalem: 0, adet: 0, deger: 0 };
    t.kalem++; t.adet += s.adet;
    const m = parcaMap.get(s.partId);
    const bm = m ? maliyet(m) : null;
    if (bm) t.deger += bm * s.adet;
    depoTop.set(s.depoId, t);
  }

  let anaKalem = 0, anaAdet = 0, anaDeger = 0, eksikKalem = 0;
  for (const p of parcalar) {
    const a = anaDepoAdedi(p.stockQty, digeri.get(p.id) ?? 0);
    if (a.eksik > 0) eksikKalem++;
    if (a.adet > 0) {
      anaKalem++; anaAdet += a.adet;
      const bm = maliyet(p);
      if (bm) anaDeger += bm * a.adet;
    }
  }

  const yuvarla = (n: number) => Math.round(n * 100) / 100;
  return {
    ana: {
      id: ANA, ad: '', tur: 'ANA', kullaniciId: null, kullaniciAdi: null, aktif: true,
      kalem: anaKalem, adet: anaAdet, deger: paraGoster ? yuvarla(anaDeger) : null, eksikKalem,
    },
    depolar: depolar.map((d) => {
      const t = depoTop.get(d.id) ?? { kalem: 0, adet: 0, deger: 0 };
      return {
        id: d.id, ad: d.ad, tur: d.tur as DepoTuru, kullaniciId: d.kullaniciId,
        kullaniciAdi: d.kullaniciId ? adlar.get(d.kullaniciId) ?? null : null,
        aktif: d.aktif, kalem: t.kalem, adet: t.adet, deger: paraGoster ? yuvarla(t.deger) : null,
      };
    }),
  };
}

export interface DepoKalemi {
  partId: string;
  ad: string;
  sku: string;
  grup: string | null;
  adet: number;
  /** Ana depoda: toplam stok (bilgi için). */
  toplam: number;
  birimMaliyet: number | null;
}

/** Bir deponun (ya da 'ana') kalemleri; adedi 0 olanlar yok. */
export async function depoKalemleri(tenantId: string, depo: DepoAnahtari, paraGoster: boolean): Promise<DepoKalemi[] | null> {
  if (depo !== ANA) {
    const d = await prisma.depo.findFirst({ where: { id: depo, tenantId }, select: { id: true } });
    if (!d) return null;
  }
  const [parcalar, stoklar] = await Promise.all([
    prisma.part.findMany({ where: { tenantId }, select: { id: true, name: true, sku: true, group: true, stockQty: true, avgCost: true, buyPrice: true } }),
    prisma.depoStok.findMany({ where: { tenantId, adet: { gt: 0 } }, select: { depoId: true, partId: true, adet: true } }),
  ]);
  const digeri = new Map<string, number>();
  const buDepo = new Map<string, number>();
  for (const s of stoklar) {
    digeri.set(s.partId, (digeri.get(s.partId) ?? 0) + s.adet);
    if (s.depoId === depo) buDepo.set(s.partId, s.adet);
  }
  const satirlar: DepoKalemi[] = [];
  for (const p of parcalar) {
    const adet = depo === ANA ? anaDepoAdedi(p.stockQty, digeri.get(p.id) ?? 0).adet : buDepo.get(p.id) ?? 0;
    if (adet <= 0) continue;
    satirlar.push({ partId: p.id, ad: p.name, sku: p.sku, grup: p.group, adet, toplam: p.stockQty, birimMaliyet: paraGoster ? maliyet(p) : null });
  }
  return satirlar.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
}

/** Bir kişinin aktif aracı. */
export async function kendiAraci(tenantId: string, kullaniciId: string): Promise<{ id: string; ad: string } | null> {
  return prisma.depo.findFirst({
    where: { tenantId, kullaniciId, tur: 'ARAC', aktif: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, ad: true },
  });
}

/** Kaynaktaki kullanılabilir adet (kilit altında çağrılmalı). */
async function kaynakAdedi(tx: Tx, tenantId: string, kaynak: DepoAnahtari, partId: string): Promise<number> {
  if (kaynak === ANA) {
    const p = await tx.part.findFirst({ where: { id: partId, tenantId }, select: { stockQty: true } });
    if (!p) return 0;
    const agg = await tx.depoStok.aggregate({ where: { tenantId, partId }, _sum: { adet: true } });
    return anaDepoAdedi(p.stockQty, agg._sum.adet ?? 0).adet;
  }
  const s = await tx.depoStok.findUnique({ where: { depoId_partId: { depoId: kaynak, partId } }, select: { adet: true } });
  return s?.adet ?? 0;
}

export type AktarimSonucu =
  | { ok: true; parcaAdi: string; kaynakKalan: number }
  | { ok: false; hata: DepoHatasi; deger?: Record<string, string | number> };

/**
 * Depolar arası aktarım. Toplam stok DEĞİŞMEZ; yalnız yeri değişir.
 * Ana depoya giden/gelen tarafta satır yazılmaz (ana = toplam − Σ).
 */
export async function aktar(
  tenantId: string,
  g: { kaynak: DepoAnahtari; hedef: DepoAnahtari; partId: string; adet: number },
): Promise<AktarimSonucu> {
  return prisma.$transaction(async (tx) => {
    const parca = await tx.part.findFirst({ where: { id: g.partId, tenantId }, select: { id: true, name: true } });
    if (!parca) return { ok: false, hata: 'DEPO_PARCA_YOK' } as const;
    for (const d of [g.kaynak, g.hedef]) {
      if (d === ANA) continue;
      const var_ = await tx.depo.findFirst({ where: { id: d, tenantId, aktif: true }, select: { id: true } });
      if (!var_) return { ok: false, hata: 'DEPO_YOK' } as const;
    }
    await kilitle(tx, tenantId, g.partId);
    const eldeki = await kaynakAdedi(tx, tenantId, g.kaynak, g.partId);
    if (eldeki < g.adet) return { ok: false, hata: 'DEPO_YETERSIZ', deger: { p1: parca.name, p2: eldeki } } as const;

    if (g.kaynak !== ANA) {
      const d = await tx.depoStok.updateMany({ where: { depoId: g.kaynak, partId: g.partId, adet: { gte: g.adet } }, data: { adet: { decrement: g.adet } } });
      if (d.count !== 1) return { ok: false, hata: 'DEPO_YETERSIZ', deger: { p1: parca.name, p2: eldeki } } as const;
    }
    if (g.hedef !== ANA) {
      await tx.depoStok.upsert({
        where: { depoId_partId: { depoId: g.hedef, partId: g.partId } },
        create: { tenantId, depoId: g.hedef, partId: g.partId, adet: g.adet },
        update: { adet: { increment: g.adet } },
      });
    }
    return { ok: true, parcaAdi: parca.name, kaynakKalan: eldeki - g.adet } as const;
  });
}

/**
 * Servis fişine parça eklenirken: aday kişilerden (fişin teknisyeni, sonra
 * ekleyen) ilkinin aracında yeterince varsa ARAÇTAN düşer ve depo kimliğini
 * döner; yoksa null (parça ana depodan gider). Toplam stok (Part.stockQty)
 * çağıran tarafında ayrıca düşülür.
 */
export async function fistenDus(
  tx: Tx, tenantId: string, partId: string, adet: number, adaylar: (string | null | undefined)[],
): Promise<string | null> {
  const kisiler = [...new Set(adaylar.filter((x): x is string => Boolean(x)))];
  if (!kisiler.length) return null;
  const araclar = await tx.depo.findMany({
    where: { tenantId, tur: 'ARAC', aktif: true, kullaniciId: { in: kisiler } },
    select: { id: true, kullaniciId: true },
  });
  if (!araclar.length) return null;
  await kilitle(tx, tenantId, partId);
  for (const kisi of kisiler) {
    for (const arac of araclar.filter((a) => a.kullaniciId === kisi)) {
      const d = await tx.depoStok.updateMany({ where: { depoId: arac.id, partId, adet: { gte: adet } }, data: { adet: { decrement: adet } } });
      if (d.count === 1) return arac.id;
    }
  }
  return null;
}

/** Fişten parça çıkarılınca düştüğü depoya geri koyar (depo silinmişse ana depoya). */
export async function fiseIade(tx: Tx, tenantId: string, depoId: string | null, partId: string, adet: number): Promise<void> {
  if (!depoId) return;
  const depo = await tx.depo.findFirst({ where: { id: depoId, tenantId }, select: { id: true } });
  if (!depo) return;
  await tx.depoStok.upsert({
    where: { depoId_partId: { depoId, partId } },
    create: { tenantId, depoId, partId, adet },
    update: { adet: { increment: adet } },
  });
}
