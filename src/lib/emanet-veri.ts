/**
 * EMANET — veri katmanı (kurallar lib/emanet.ts'te, burada yalnız okuma/yazma).
 *
 *   · emanetOzeti: müşteri bazında raftakiler, değer (yalnız yönetici),
 *     uyarılar (fazla duruyor, sayım farkı) ve son 12 ayın kaybı.
 *   · musteriDefteri: bir müşterinin kalemleri, hareketleri ve cihazları.
 *   · emanetIslemi: bırak / iade / kayıp / sayım. Hepsi TEK işlemde ve
 *     müşteri başına danışma kilidi altında: aynı rafa aynı anda yazan iki
 *     teknisyen sıraya girer, bakiye eksiye düşemez, stok yetmezse hiçbir
 *     satır yazılmaz.
 *   · emanettenDus: bir toner değişimi raftaki yedekten mi takıldı; öyleyse
 *     −1 TAKILDI. verim-ogrenme.degisimKaydet içinden çağrılır — bütün
 *     değişimler (tarayıcı, fiş, elle) oradan geçer. tonerChangeId tekil:
 *     aynı değişim iki kez düşülemez (veritabanı tutar).
 *   · tutanakVerisi: bırakılan toner için teslim tutanağı.
 *
 * Herkese açık tutanak bağlantısının imzası uçlarda atılır (lib/doc-token);
 * veri katmanı bağlantı bilmez.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { tonerMu, kanalKarari } from '@/lib/verim-ogrenme';
import { modelAnahtari } from '@/lib/toner-verimi';
import { parcaMaliyeti } from '@/lib/stok-maliyet';
import {
  kalemAnahtari, kalemlereAyir, kalemOzeti, musteriToplami, partiler, cikanBirimMaliyet, bakiye,
  sayimFarklari, tuketimKarari, istegiAyikla, GOZLEM_GUN, ISLEM_TURU,
  type EmanetSatiri, type EmanetHatasi, type EmanetIslemi, type KalemOzeti, type TuketimSebebi,
} from '@/lib/emanet';

const GUN = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

type HamSatir = { tur: string; adet: number; tarih: Date; partId: string | null; parcaAdi: string; birimMaliyet: Prisma.Decimal | null };

/** Prisma satırını kural katmanının satırına çevirir (Decimal → sayı). */
function satir(s: HamSatir): EmanetSatiri {
  return {
    tur: s.tur, adet: s.adet, tarih: s.tarih, partId: s.partId, parcaAdi: s.parcaAdi,
    birimMaliyet: s.birimMaliyet === null ? null : Number(s.birimMaliyet),
  };
}

const SATIR = { tur: true, adet: true, tarih: true, partId: true, parcaAdi: true, birimMaliyet: true } as const;
const SIRA = [{ tarih: 'asc' as const }, { createdAt: 'asc' as const }];

/** Kartın bugünkü birim maliyeti: ortalama, yoksa son alış, yoksa bilinmiyor (null). */
const kartMaliyeti = (k: { avgCost: Prisma.Decimal | null; buyPrice: Prisma.Decimal }) =>
  parcaMaliyeti({ avgCost: k.avgCost === null ? null : Number(k.avgCost), buyPrice: Number(k.buyPrice) }).deger;

/**
 * Aynı müşterinin defterine yazan işlemler sıraya girer. Danışma kilidi
 * işlem bitince kendiliğinden bırakılır; ayrı bir "bakiye" satırı olmadığı
 * için kilitlenecek satır da yok — kilit müşteri anahtarının üstünde.
 */
async function kilitle(tx: Prisma.TransactionClient, tenantId: string, customerId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`emanet:${tenantId}:${customerId}`}, 0))`;
}

const tekilIhlali = (e: unknown) =>
  (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
  || /EmanetHareketi_tonerChangeId_key|23505|unique constraint/i.test(String((e as Error)?.message ?? ''));

const kod = (p: { oemCode?: string | null; sku?: string | null } | undefined) => p?.oemCode || p?.sku || null;

const cihazAdi = (d: { brand: string; model: string; serialNo?: string | null; location?: string | null }) =>
  [`${d.brand} ${d.model}`.trim(), d.serialNo ? `SN ${d.serialNo}` : null, d.location || null].filter(Boolean).join(' · ');

// ── ÖZET ─────────────────────────────────────────────────────────────────

export interface KalemCikti {
  anahtar: string;
  partId: string | null;
  ad: string;
  kod: string | null;
  bakiye: number;
  /** Yönetici değilse null: teknisyen adet görür, ₺ görmez. */
  deger: number | null;
  degerEksik: boolean;
  enEskiGun: number | null;
  tuketim90: number;
  fazla: boolean;
  sonHareket: string | null;
  sonSayimFarki: { tarih: string; fark: number } | null;
}

export interface MusteriOzetCikti {
  id: string;
  ad: string;
  telefon: string | null;
  bakiye: number;
  deger: number | null;
  degerEksik: boolean;
  enEskiGun: number | null;
  tuketim90: number;
  fazla: boolean;
  sonHareket: string | null;
  kalemler: KalemCikti[];
}

export interface FazlaUyarisi { musteriId: string; musteri: string; anahtar: string; ad: string; bakiye: number; enEskiGun: number; tuketim90: number; deger: number | null }
export interface SayimUyarisi { musteriId: string; musteri: string; anahtar: string; ad: string; fark: number; tarih: string; deger: number | null }

export interface EmanetOzeti {
  yonetici: boolean;
  toplam: { adet: number; musteri: number; deger: number | null; degerEksik: boolean };
  uyarilar: { fazla: FazlaUyarisi[]; sayimFarki: SayimUyarisi[] };
  /** Son 12 ay: kayıp yazılan ve sayımda eksik çıkan. Değerler yalnız yöneticiye. */
  kayip: { kayipAdet: number; kayipDeger: number | null; eksikAdet: number; eksikDeger: number | null };
  musteriler: MusteriOzetCikti[];
}

type Kart = { name: string; oemCode: string | null; sku: string };

function kalemCikti(k: KalemOzeti, yonetici: boolean, kart: Kart | undefined): KalemCikti {
  return {
    anahtar: k.anahtar,
    partId: k.partId,
    // Kart yeniden adlandıysa bugünkü ad; kart silindiyse defterdeki ad.
    ad: kart?.name ?? k.ad,
    kod: kod(kart),
    bakiye: k.bakiye,
    deger: yonetici ? k.deger : null,
    degerEksik: k.degerEksik,
    enEskiGun: k.enEskiGun,
    tuketim90: k.tuketim90,
    fazla: k.fazla,
    sonHareket: k.sonHareket?.toISOString() ?? null,
    sonSayimFarki: k.sonSayimFarki ? { tarih: k.sonSayimFarki.tarih.toISOString(), fark: k.sonSayimFarki.fark } : null,
  };
}

/** Ekranda gösterilen kalemler: rafta olan ya da son 90 günde hareket gören. */
const gorunurMu = (k: KalemOzeti, sinir90: number) => k.bakiye !== 0 || (k.sonHareket !== null && k.sonHareket.getTime() >= sinir90);
const kalemSirasi = (a: KalemOzeti, b: KalemOzeti) => b.bakiye - a.bakiye || a.ad.localeCompare(b.ad, 'tr');

/**
 * Müşterilerde duran toner — ekranın tepesindeki tek sayı ve altındaki liste.
 *
 * Listeye giren müşteri: rafında toner olan ya da son 90 günde hareketi olan
 * (bakiyesi sıfırlanmış ama yeni iade alınmış müşteri görünmeye devam etsin).
 * Önce kalem başına Σ adet (ucuz toplam) alınır; satırlar yalnız bu
 * müşteriler için okunur — yıllarca birikmiş defterin tamamı okunmaz.
 */
export async function emanetOzeti(tenantId: string, o: { yonetici: boolean; simdi?: Date }): Promise<EmanetOzeti> {
  const simdi = o.simdi ?? new Date();
  const sinir90 = simdi.getTime() - GOZLEM_GUN * GUN;
  const yilOnce = new Date(simdi.getTime() - 365 * GUN);

  const [gruplar, kayipSatirlari] = await Promise.all([
    prisma.emanetHareketi.groupBy({
      by: ['customerId', 'partId', 'parcaAdi'],
      where: { tenantId },
      _sum: { adet: true },
      _max: { tarih: true },
    }),
    prisma.emanetHareketi.findMany({
      where: { tenantId, tur: { in: ['KAYIP', 'SAYIM'] }, tarih: { gte: yilOnce } },
      select: { tur: true, adet: true, birimMaliyet: true },
    }),
  ]);

  const kalemToplami = new Map<string, number>();
  const sonTarih = new Map<string, number>();
  for (const g of gruplar) {
    const k = `${g.customerId}|${kalemAnahtari({ partId: g.partId, parcaAdi: g.parcaAdi })}`;
    kalemToplami.set(k, (kalemToplami.get(k) ?? 0) + (g._sum.adet ?? 0));
    const t = g._max.tarih?.getTime() ?? 0;
    if (t > (sonTarih.get(g.customerId) ?? 0)) sonTarih.set(g.customerId, t);
  }
  const aktif = new Set<string>();
  for (const [k, n] of kalemToplami) if (n !== 0) aktif.add(k.slice(0, k.indexOf('|')));
  for (const [c, t] of sonTarih) if (t >= sinir90) aktif.add(c);
  const ids = [...aktif];

  const satirlar = ids.length
    ? await prisma.emanetHareketi.findMany({ where: { tenantId, customerId: { in: ids } }, select: { customerId: true, ...SATIR }, orderBy: SIRA })
    : [];
  const musteriler = ids.length
    ? await prisma.customer.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, name: true, phone: true } })
    : [];
  const partIds = [...new Set(satirlar.map((s) => s.partId).filter((x): x is string => !!x))];
  const kartlar = new Map<string, Kart>((partIds.length
    ? await prisma.part.findMany({ where: { tenantId, id: { in: partIds } }, select: { id: true, name: true, oemCode: true, sku: true } })
    : []).map((p) => [p.id, p]));

  const musteriSatirlari = new Map<string, EmanetSatiri[]>();
  for (const s of satirlar) {
    const l = musteriSatirlari.get(s.customerId);
    if (l) l.push(satir(s)); else musteriSatirlari.set(s.customerId, [satir(s)]);
  }

  const cikti: MusteriOzetCikti[] = [];
  const uyarilar: EmanetOzeti['uyarilar'] = { fazla: [], sayimFarki: [] };
  let toplamAdet = 0, toplamDeger = 0, degerEksik = false, rafliMusteri = 0;
  for (const m of musteriler) {
    const kalemler = [...kalemlereAyir(musteriSatirlari.get(m.id) ?? []).values()].map((l) => kalemOzeti(l, simdi));
    const t = musteriToplami(kalemler);
    for (const k of kalemler) {
      // Eksi bakiye defterin bir yerde yanlış olduğu demek; raftaki toner
      // sayısından DÜŞÜLMEZ (rafta eksi toner olmaz).
      if (k.bakiye > 0) { toplamAdet += k.bakiye; toplamDeger += k.deger; degerEksik ||= k.degerEksik; }
      const ad = (k.partId && kartlar.get(k.partId)?.name) || k.ad;
      if (k.fazla) {
        uyarilar.fazla.push({
          musteriId: m.id, musteri: m.name, anahtar: k.anahtar, ad, bakiye: k.bakiye,
          enEskiGun: k.enEskiGun ?? 0, tuketim90: k.tuketim90, deger: o.yonetici ? k.deger : null,
        });
      }
      if (k.sonSayimFarki && k.sonSayimFarki.fark !== 0) {
        const bm = k.sonSayimFarki.birimMaliyet;
        uyarilar.sayimFarki.push({
          musteriId: m.id, musteri: m.name, anahtar: k.anahtar, ad, fark: k.sonSayimFarki.fark,
          tarih: k.sonSayimFarki.tarih.toISOString(),
          deger: o.yonetici && bm !== null ? r2(Math.abs(k.sonSayimFarki.fark) * bm) : null,
        });
      }
    }
    if (t.bakiye > 0) rafliMusteri++;
    cikti.push({
      id: m.id, ad: m.name, telefon: m.phone ?? null,
      bakiye: t.bakiye, deger: o.yonetici ? t.deger : null, degerEksik: t.degerEksik,
      enEskiGun: t.enEskiGun, tuketim90: t.tuketim90, fazla: t.fazla,
      sonHareket: sonTarih.has(m.id) ? new Date(sonTarih.get(m.id)!).toISOString() : null,
      kalemler: kalemler.filter((k) => gorunurMu(k, sinir90)).sort(kalemSirasi)
        .map((k) => kalemCikti(k, o.yonetici, k.partId ? kartlar.get(k.partId) : undefined)),
    });
  }
  cikti.sort((a, b) => b.bakiye - a.bakiye || a.ad.localeCompare(b.ad, 'tr'));
  uyarilar.fazla.sort((a, b) => b.bakiye - a.bakiye || b.enEskiGun - a.enEskiGun);
  uyarilar.sayimFarki.sort((a, b) => a.fark - b.fark || b.tarih.localeCompare(a.tarih));

  // Kayıp raporu: değer satırın kendi maliyetinden (yazıldığı andaki FIFO).
  let kayipAdet = 0, kayipDeger = 0, eksikAdet = 0, eksikDeger = 0;
  for (const s of kayipSatirlari) {
    const bm = s.birimMaliyet === null ? 0 : Number(s.birimMaliyet);
    if (s.tur === 'KAYIP') { kayipAdet -= s.adet; kayipDeger -= s.adet * bm; }
    else if (s.adet < 0) { eksikAdet -= s.adet; eksikDeger -= s.adet * bm; }
  }
  return {
    yonetici: o.yonetici,
    toplam: { adet: toplamAdet, musteri: rafliMusteri, deger: o.yonetici ? r2(toplamDeger) : null, degerEksik },
    uyarilar,
    kayip: {
      kayipAdet, kayipDeger: o.yonetici ? r2(kayipDeger) : null,
      eksikAdet, eksikDeger: o.yonetici ? r2(eksikDeger) : null,
    },
    musteriler: cikti,
  };
}

// ── MÜŞTERİ DEFTERİ ──────────────────────────────────────────────────────

export interface HareketCikti {
  id: string;
  tur: string;
  adet: number;
  bosAdet: number;
  ad: string;
  tarih: string;
  kullanici: string | null;
  cihaz: string | null;
  /** TAKILDI satırında değişimi kim gördü: TARAYICI | FIS | ELLE (TonerChange.source). */
  kaynak: string | null;
  not: string | null;
  /** Yalnız yönetici. */
  birimMaliyet: number | null;
  /** Bırakışın İLK satırında doğru: tutanak bu satırın kimliğiyle açılır (aynı ziyaretin bütün kalemleri). */
  tutanak: boolean;
}

export interface MusteriDefteri {
  musteri: { id: string; ad: string; telefon: string | null };
  yonetici: boolean;
  toplam: { bakiye: number; deger: number | null; degerEksik: boolean; enEskiGun: number | null; tuketim90: number; fazla: boolean };
  kalemler: KalemCikti[];
  hareketler: HareketCikti[];
  hareketSayisi: number;
  cihazlar: { id: string; ad: string }[];
  /** Bu müşterinin makinelerine uyduğu bilinen parçalar: form bunları üste alır. */
  uygunParcalar: string[];
  /** Son sayım (fark çıkmasa da denetim kaydında durur). */
  sonSayim: { tarih: string; tam: boolean } | null;
}

export async function musteriDefteri(tenantId: string, customerId: string, o: { yonetici: boolean; simdi?: Date; enCok?: number }): Promise<MusteriDefteri | null> {
  const simdi = o.simdi ?? new Date();
  const musteri = await prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true, name: true, phone: true } });
  if (!musteri) return null;

  const [satirlar, cihazlar, fisParcalari, sonSayim] = await Promise.all([
    prisma.emanetHareketi.findMany({
      where: { tenantId, customerId },
      select: { id: true, bosAdet: true, deviceId: true, tonerChangeId: true, kullaniciId: true, not: true, ...SATIR },
      orderBy: SIRA,
    }),
    prisma.device.findMany({ where: { tenantId, customerId }, select: { id: true, brand: true, model: true, serialNo: true, location: true }, orderBy: [{ brand: 'asc' }, { model: 'asc' }] }),
    prisma.ticketPart.findMany({ where: { tenantId, ticket: { customerId, deletedAt: null } }, select: { partId: true }, distinct: ['partId'] }),
    prisma.auditLog.findFirst({
      where: { tenantId, entityType: 'Customer', entityId: customerId, action: 'EMANET_SAYIM' },
      orderBy: { createdAt: 'desc' }, select: { createdAt: true, newValue: true },
    }).catch(() => null),
  ]);

  // Uyan parçalar: bu müşterinin modellerine (bayinin herhangi bir
  // müşterisinde) takılmış, bu müşterinin fişinde kullanılmış ya da bu
  // müşteriye daha önce bırakılmış olanlar.
  const modeller = new Set(cihazlar.map((c) => modelAnahtari(c.brand, c.model)));
  const takilanlar = modeller.size
    ? await prisma.tonerChange.findMany({
        where: { tenantId, partId: { not: null } },
        select: { partId: true, device: { select: { brand: true, model: true } } },
        orderBy: { changedAt: 'desc' },
        take: 5000,
      })
    : [];
  const uygun = new Set<string>();
  for (const t of takilanlar) if (t.partId && modeller.has(modelAnahtari(t.device.brand, t.device.model))) uygun.add(t.partId);
  for (const f of fisParcalari) uygun.add(f.partId);
  for (const s of satirlar) if (s.partId && s.tur === 'BIRAKILDI') uygun.add(s.partId);

  const partIds = [...new Set(satirlar.map((s) => s.partId).filter((x): x is string => !!x))];
  const kullaniciIds = [...new Set(satirlar.map((s) => s.kullaniciId).filter((x): x is string => !!x))];
  const degisimIds = satirlar.map((s) => s.tonerChangeId).filter((x): x is string => !!x);
  const cihazIds = [...new Set(satirlar.map((s) => s.deviceId).filter((x): x is string => !!x))];
  const [kartlar, kullanicilar, degisimler, defterCihazlari] = await Promise.all([
    partIds.length ? prisma.part.findMany({ where: { tenantId, id: { in: partIds } }, select: { id: true, name: true, oemCode: true, sku: true } }) : [],
    kullaniciIds.length ? prisma.user.findMany({ where: { tenantId, id: { in: kullaniciIds } }, select: { id: true, name: true } }) : [],
    degisimIds.length ? prisma.tonerChange.findMany({ where: { tenantId, id: { in: degisimIds } }, select: { id: true, source: true } }) : [],
    // Defterdeki cihaz başka müşteriye taşınmış olabilir: adı yine okunsun.
    cihazIds.length ? prisma.device.findMany({ where: { tenantId, id: { in: cihazIds } }, select: { id: true, brand: true, model: true, serialNo: true, location: true } }) : [],
  ]);
  const kartMap = new Map<string, Kart>(kartlar.map((p) => [p.id, p]));
  const kullaniciMap = new Map(kullanicilar.map((u) => [u.id, u.name]));
  const kaynakMap = new Map(degisimler.map((d) => [d.id, d.source]));
  const cihazMap = new Map(defterCihazlari.map((d) => [d.id, cihazAdi(d)]));

  const ozetler = [...kalemlereAyir(satirlar.map(satir)).values()].map((l) => kalemOzeti(l, simdi));
  const t = musteriToplami(ozetler);
  const sinir90 = simdi.getTime() - GOZLEM_GUN * GUN;

  // Bir bırakış = aynı an + aynı kişi (emanetIslemi bütün kalemlere aynı anı yazar).
  const ilkSatir = new Set<string>();
  const gorulen = new Set<string>();
  for (const s of satirlar) {
    if (s.tur !== 'BIRAKILDI') continue;
    const z = `${s.tarih.getTime()}|${s.kullaniciId ?? ''}`;
    if (!gorulen.has(z)) { gorulen.add(z); ilkSatir.add(s.id); }
  }
  const hareketler: HareketCikti[] = satirlar.slice(-(o.enCok ?? 150)).reverse().map((s) => ({
    id: s.id, tur: s.tur, adet: s.adet, bosAdet: s.bosAdet,
    ad: (s.partId && kartMap.get(s.partId)?.name) || s.parcaAdi,
    tarih: s.tarih.toISOString(),
    kullanici: s.kullaniciId ? kullaniciMap.get(s.kullaniciId) ?? null : null,
    cihaz: s.deviceId ? cihazMap.get(s.deviceId) ?? null : null,
    kaynak: s.tonerChangeId ? kaynakMap.get(s.tonerChangeId) ?? null : null,
    not: s.not,
    birimMaliyet: o.yonetici && s.birimMaliyet !== null ? Number(s.birimMaliyet) : null,
    tutanak: ilkSatir.has(s.id),
  }));

  let sonSayimCikti: MusteriDefteri['sonSayim'] = null;
  if (sonSayim) {
    let tam = false;
    try { tam = Boolean((JSON.parse(sonSayim.newValue ?? '{}') as { tam?: boolean }).tam); } catch { /* kırpılmış kayıt */ }
    sonSayimCikti = { tarih: sonSayim.createdAt.toISOString(), tam };
  }

  return {
    musteri: { id: musteri.id, ad: musteri.name, telefon: musteri.phone ?? null },
    yonetici: o.yonetici,
    toplam: { bakiye: t.bakiye, deger: o.yonetici ? t.deger : null, degerEksik: t.degerEksik, enEskiGun: t.enEskiGun, tuketim90: t.tuketim90, fazla: t.fazla },
    kalemler: ozetler.filter((k) => gorunurMu(k, sinir90)).sort(kalemSirasi)
      .map((k) => kalemCikti(k, o.yonetici, k.partId ? kartMap.get(k.partId) : undefined)),
    hareketler,
    hareketSayisi: satirlar.length,
    cihazlar: cihazlar.map((c) => ({ id: c.id, ad: cihazAdi(c) })),
    uygunParcalar: [...uygun],
    sonSayim: sonSayimCikti,
  };
}

/** Form seçenekleri: müşteriler ve stok kartları (hizmet kalemleri hariç). Fiyat YOK. */
export async function formSecenekleri(tenantId: string) {
  const [musteriler, parcalar] = await Promise.all([
    prisma.customer.findMany({ where: { tenantId }, select: { id: true, name: true, phone: true }, orderBy: { name: 'asc' } }),
    prisma.part.findMany({
      where: { tenantId, OR: [{ group: null }, { group: { notIn: ['LABOUR', 'REPAIR'] } }] },
      select: { id: true, name: true, sku: true, oemCode: true, stockQty: true, group: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return {
    musteriler: musteriler.map((m) => ({ id: m.id, ad: m.name, telefon: m.phone ?? null })),
    parcalar: parcalar.map((p) => ({ id: p.id, ad: p.name, kod: kod(p), stok: p.stockQty, grup: p.group, toner: tonerMu(p) })),
  };
}

// ── İŞLEM ────────────────────────────────────────────────────────────────

export interface SayimSonucSatiri { anahtar: string; ad: string; defterde: number; sayilan: number; fark: number }

export type IslemSonucu =
  | {
      ok: true;
      islem: EmanetIslemi;
      hareketler: string[];
      /** İşlemin dokunduğu toner sayısı (sayımda farkların mutlak toplamı). */
      adet: number;
      /** birak: tutanak bu kimlikle açılır (ilk kalem). */
      tutanakId: string | null;
      /** birak/iade: işlemden sonra depodaki adet. */
      stok: Record<string, number>;
      /** sayim: kalem kalem defter, sayılan, fark. */
      sayim: SayimSonucSatiri[] | null;
    }
  | { ok: false; hata: EmanetHatasi; deger?: Record<string, string | number> };

class EmanetReddi extends Error {
  constructor(public kod: EmanetHatasi, public deger?: Record<string, string | number>) { super(kod); }
}

/**
 * Bırak / iade al / kayıp yaz / sayım — elle yapılan dört iş.
 *
 *   · BIRAK: stok düşer (yetmezse EMANET_STOK_YETERSIZ, eksiye düşürülmez),
 *     defter +adet. Birim maliyet bırakıldığı andaki ortalama (yoksa son
 *     alış, o da yoksa bilinmiyor). Bütün kalemler AYNI ANI taşır: bir
 *     bırakış = bir tutanak.
 *   · IADE: defter −adet, stok geri artar. Rafta olandan fazlası alınamaz.
 *   · KAYIP: defter −adet; değeri FIFO maliyetiyle satırda durur (rapor).
 *   · SAYIM: fark = sayılan − defter; fark ≠ 0 ise SAYIM satırı. Eksik de
 *     fazla da görünür kalır.
 */
export async function emanetIslemi(tenantId: string, kullaniciId: string | null, ham: unknown, simdi = new Date()): Promise<IslemSonucu> {
  const istek = istegiAyikla(ham);
  if (typeof istek === 'string') return { ok: false, hata: istek };
  const { islem, customerId, kalemler, bosAdet, deviceId, not } = istek;

  const musteri = await prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } });
  if (!musteri) return { ok: false, hata: 'EMANET_MUSTERI_YOK' };
  if (deviceId) {
    const cihaz = await prisma.device.findFirst({ where: { id: deviceId, tenantId, customerId }, select: { id: true } });
    if (!cihaz) return { ok: false, hata: 'EMANET_CIHAZ_YOK' };
  }
  const partIds = [...new Set(kalemler.map((k) => k.partId).filter((x): x is string => !!x))];
  const kartlar = new Map((partIds.length
    ? await prisma.part.findMany({ where: { tenantId, id: { in: partIds } }, select: { id: true, name: true, avgCost: true, buyPrice: true } })
    : []).map((p) => [p.id, p]));
  if (partIds.some((id) => !kartlar.has(id))) return { ok: false, hata: 'EMANET_PARCA_YOK' };

  try {
    const sonuc = await prisma.$transaction(async (tx) => {
      await kilitle(tx, tenantId, customerId);
      const mevcut = await tx.emanetHareketi.findMany({ where: { tenantId, customerId }, select: SATIR, orderBy: SIRA });
      const defter = kalemlereAyir(mevcut.map(satir));
      const tur = ISLEM_TURU[islem];
      /** Kalemin adı: bugünkü kart adı; kart silindiyse defterdeki son ad. */
      const adOf = (k: { partId: string | null; parcaAdi: string | null }) => {
        const l = defter.get(kalemAnahtari(k)) ?? [];
        return (k.partId && kartlar.get(k.partId)?.name) || l[l.length - 1]?.parcaAdi || k.parcaAdi || '';
      };
      const yazilan: string[] = [];
      const stok: Record<string, number> = {};
      let toplam = 0;
      const stokOku = async (id: string) => (await tx.part.findUnique({ where: { id }, select: { stockQty: true } }))?.stockQty ?? 0;

      if (islem === 'birak') {
        for (const [i, k] of kalemler.entries()) {
          const kart = kartlar.get(k.partId as string)!;
          // Koşullu düşüş: aynı anda başka bir iş (fiş, sevk) aynı kartı
          // düşürse bile stok eksiye inmez — yetmiyorsa bütün bırakış geri alınır.
          const d = await tx.part.updateMany({ where: { id: kart.id, tenantId, stockQty: { gte: k.adet } }, data: { stockQty: { decrement: k.adet } } });
          if (d.count !== 1) throw new EmanetReddi('EMANET_STOK_YETERSIZ', { p1: kart.name, p2: await stokOku(kart.id) });
          stok[kart.id] = await stokOku(kart.id);
          const h = await tx.emanetHareketi.create({
            data: {
              tenantId, customerId, partId: kart.id, parcaAdi: kart.name, tur, adet: k.adet,
              // Boş kartuş ziyaretin bilgisi: ilk satıra yazılır, tutanak toplar.
              bosAdet: i === 0 ? bosAdet : 0,
              birimMaliyet: kartMaliyeti(kart),
              deviceId, kullaniciId, not, tarih: simdi,
            },
            select: { id: true },
          });
          yazilan.push(h.id);
          toplam += k.adet;
        }
        return { yazilan, stok, toplam, sayim: null };
      }

      if (islem === 'iade' || islem === 'kayip') {
        for (const k of kalemler) {
          const satirlari = defter.get(kalemAnahtari(k)) ?? [];
          const rafta = bakiye(satirlari);
          if (k.adet > rafta) throw new EmanetReddi('EMANET_BAKIYE_ASIMI', { p1: adOf(k), p2: Math.max(0, rafta) });
          const h = await tx.emanetHareketi.create({
            data: {
              tenantId, customerId, partId: k.partId, parcaAdi: adOf(k), tur, adet: -k.adet,
              birimMaliyet: cikanBirimMaliyet(partiler(satirlari), k.adet),
              kullaniciId, not, tarih: simdi,
            },
            select: { id: true },
          });
          yazilan.push(h.id);
          toplam += k.adet;
          // İade gelen toner depoya döner. Kartı silinmişse dönecek yer yok: yalnız defter düşer.
          if (islem === 'iade' && k.partId) {
            const a = await tx.part.updateMany({ where: { id: k.partId, tenantId }, data: { stockQty: { increment: k.adet } } });
            if (a.count === 1) stok[k.partId] = await stokOku(k.partId);
          }
        }
        return { yazilan, stok, toplam, sayim: null };
      }

      // SAYIM — fark = sayılan − defter (kural: lib/emanet sayimFarklari).
      const farklar = sayimFarklari(
        kalemler.map((k) => ({ anahtar: kalemAnahtari(k), sayilan: k.adet })),
        new Map([...defter].map(([a, l]) => [a, bakiye(l)])),
      );
      const sayim: SayimSonucSatiri[] = [];
      for (const [i, f] of farklar.entries()) {
        const k = kalemler[i];
        const satirlari = defter.get(f.anahtar) ?? [];
        sayim.push({ anahtar: f.anahtar, ad: adOf(k), defterde: f.defterde, sayilan: f.sayilan, fark: f.fark });
        if (f.fark === 0) continue;
        // Defterde hiç olmayan kalem yalnız stok kartıyla eklenebilir (adı belli olsun).
        if (!satirlari.length && !k.partId) throw new EmanetReddi('EMANET_PARCA_YOK');
        const kart = k.partId ? kartlar.get(k.partId) : undefined;
        // Eksik: raftan çıkan FIFO maliyeti. Fazla: bu kalemin bilinen son
        // maliyeti, o da yoksa kartın bugünkü maliyeti.
        const sonBilinen = [...satirlari].reverse().find((s) => s.birimMaliyet !== null)?.birimMaliyet ?? null;
        const birimMaliyet = f.fark < 0
          ? cikanBirimMaliyet(partiler(satirlari), -f.fark)
          : sonBilinen ?? (kart ? kartMaliyeti(kart) : null);
        const h = await tx.emanetHareketi.create({
          data: { tenantId, customerId, partId: k.partId, parcaAdi: adOf(k), tur, adet: f.fark, birimMaliyet, kullaniciId, not, tarih: simdi },
          select: { id: true },
        });
        yazilan.push(h.id);
        toplam += Math.abs(f.fark);
      }
      return { yazilan, stok, toplam, sayim };
    }, { timeout: 20_000, maxWait: 10_000 });

    return {
      ok: true, islem, hareketler: sonuc.yazilan, adet: sonuc.toplam,
      tutanakId: islem === 'birak' ? sonuc.yazilan[0] ?? null : null,
      stok: sonuc.stok, sayim: sonuc.sayim,
    };
  } catch (e) {
    if (e instanceof EmanetReddi) return { ok: false, hata: e.kod, deger: e.deger };
    throw e;
  }
}

// ── OTOMATİK TÜKETİM ─────────────────────────────────────────────────────

export type AtlamaSebebi = 'DEGISIM_YOK' | 'GOC' | 'EMANET_YOK' | 'ZATEN' | 'SEVK' | TuketimSebebi;
export type TuketimSonucu =
  | { durum: 'DUSULDU'; hareketId: string; partId: string }
  | { durum: 'ATLANDI'; sebep: AtlamaSebebi };

const atla = (sebep: AtlamaSebebi): TuketimSonucu => ({ durum: 'ATLANDI', sebep });

/**
 * Toner değişimi müşterinin rafındaki yedekten mi takıldı? Öyleyse −1.
 *
 * DÜŞÜLMEZ:
 *   · geçmiş aktarımı (GOC): o değişimler bugünkü raftan eski;
 *   · değişim açık bir toner sevkine bağlandıysa: bayi o toneri yolladı,
 *     takılan odur (verim-ogrenme sevki kapatırken tonerChangeId yazar);
 *   · aynı değişim zaten düşüldüyse (tekil indeks de tutar);
 *   · uygun parça yoksa ya da birden çok aday varsa (kural: lib/emanet
 *     tuketimKarari) — sayım yakalar.
 *
 * Değişimin ANINDA rafta olmayan toner (değişimden sonra bırakılmış) aday
 * değildir. Yazma kilit altında yeniden doğrulanır: aynı anda gelen iki
 * değişim son toneri iki kez düşemez.
 *
 * Fişten gelen değişim de düşer: teknisyen raftaki yedeği takıp fişe yazar.
 * (Bilinen sınır: fiş parçası depodan da düşüyor — fişte "raftan" seçeneği
 * yok. Teknisyen toneri depodan getirdiyse sayımda +1 fazla görünür; hata
 * zararsız yönde: müşteriye haksız "kayıp" denmez.)
 */
export async function emanettenDus(tonerChangeId: string): Promise<TuketimSonucu> {
  const d = await prisma.tonerChange.findUnique({
    where: { id: tonerChangeId },
    select: {
      id: true, tenantId: true, deviceId: true, channel: true, partId: true, changedAt: true, source: true,
      device: { select: { customerId: true, brand: true, model: true, tonerYieldColor: true, counterColor: true } },
    },
  });
  if (!d) return atla('DEGISIM_YOK');
  if (d.source === 'GOC') return atla('GOC');
  const { tenantId } = d;
  const customerId = d.device.customerId;

  // En sık durum: müşteride emanet yok. Tek indeksli sorguyla çıkılır.
  const satirlar = await prisma.emanetHareketi.findMany({
    where: { tenantId, customerId },
    select: { deviceId: true, ...SATIR },
    orderBy: SIRA,
  });
  if (!satirlar.length) return atla('EMANET_YOK');

  const [zaten, sevk] = await Promise.all([
    prisma.emanetHareketi.findUnique({ where: { tonerChangeId: d.id }, select: { id: true } }),
    prisma.tonerSevki.findFirst({ where: { tenantId, tonerChangeId: d.id }, select: { id: true } }),
  ]);
  if (zaten) return atla('ZATEN');
  if (sevk) return atla('SEVK');

  // Adaylar: değişim anında da şimdi de rafta olan, stok kartı bilinen kalemler.
  const bakiyeMap = new Map<string, number>();
  for (const [anahtar, l] of kalemlereAyir(satirlar.map(satir))) {
    const partId = l[0].partId;
    if (!partId || anahtar !== partId) continue;
    const simdiki = bakiye(l), oAn = bakiye(l, d.changedAt);
    if (simdiki > 0 && oAn > 0) bakiyeMap.set(partId, Math.min(simdiki, oAn));
  }
  const kartlar = bakiyeMap.size
    ? await prisma.part.findMany({ where: { tenantId, id: { in: [...bakiyeMap.keys()] } }, select: { id: true, name: true, group: true } })
    : [];
  // Drum ya da kâğıt bir toner değişimiyle düşmez.
  const tonerler = kartlar.filter((p) => tonerMu(p));
  if (!tonerler.length) return atla(d.partId ? 'PARCA_RAFTA_YOK' : 'ADAY_YOK');

  const uyan = d.partId ? new Set<string>() : await uyanParcalar(d, tonerler, satirlar);
  const karar = tuketimKarari({
    degisimParcasi: d.partId,
    adaylar: tonerler.map((p) => ({ partId: p.id, bakiye: bakiyeMap.get(p.id) ?? 0, uyar: uyan.has(p.id) })),
  });
  if ('sebep' in karar) return atla(karar.sebep);
  const kart = tonerler.find((p) => p.id === karar.partId)!;

  try {
    return await prisma.$transaction(async (tx) => {
      await kilitle(tx, tenantId, customerId);
      const guncel = (await tx.emanetHareketi.findMany({
        where: { tenantId, customerId, partId: kart.id }, select: SATIR, orderBy: SIRA,
      })).map(satir);
      // Kilidi beklerken başka bir değişim son toneri almış olabilir.
      if (bakiye(guncel) < 1) return atla('PARCA_RAFTA_YOK');
      if (await tx.emanetHareketi.findUnique({ where: { tonerChangeId: d.id }, select: { id: true } })) return atla('ZATEN');
      const h = await tx.emanetHareketi.create({
        data: {
          tenantId, customerId, partId: kart.id, parcaAdi: kart.name, tur: 'TAKILDI', adet: -1,
          birimMaliyet: cikanBirimMaliyet(partiler(guncel), 1),
          deviceId: d.deviceId, tonerChangeId: d.id, tarih: d.changedAt,
        },
        select: { id: true },
      });
      return { durum: 'DUSULDU' as const, hareketId: h.id, partId: kart.id };
    }, { timeout: 20_000, maxWait: 10_000 });
  } catch (e) {
    if (tekilIhlali(e)) return atla('ZATEN');
    throw e;
  }
}

/**
 * Değişimin parçası bilinmiyorsa rafta duran tonerlerden HANGİLERİNİN bu
 * makineye uyduğu biliniyor? Kanıt (biri yeter):
 *   · aynı cihaza ya da aynı modele, AYNI KANALDA daha önce takılmış;
 *   · bu cihazın servis fişinde kullanılmış ve adı bu kanalı söylüyor;
 *   · bu müşteriye bu cihaz (ya da aynı modeldeki bir cihazı) için
 *     bırakılmış ve adı bu kanalı söylüyor.
 * Kanal tahmin edilmez (verim-ogrenme.kanalKarari): renkli makinede adı
 * rengi söylemeyen toner kanıt sayılmaz.
 */
async function uyanParcalar(
  d: { id: string; tenantId: string; deviceId: string; channel: string; device: { brand: string; model: string; tonerYieldColor: number | null; counterColor: number | null } },
  tonerler: readonly { id: string; name: string; group: string | null }[],
  satirlar: readonly { tur: string; partId: string | null; deviceId: string | null }[],
): Promise<Set<string>> {
  const ids = tonerler.map((p) => p.id);
  const model = modelAnahtari(d.device.brand, d.device.model);
  const kart = new Map(tonerler.map((p) => [p.id, p]));
  const kanaliUyar = (partId: string) => {
    const p = kart.get(partId);
    return p !== undefined && kanalKarari(p, d.device).kanal === d.channel;
  };
  const birakis = satirlar.filter((s): s is { tur: string; partId: string; deviceId: string } =>
    s.tur === 'BIRAKILDI' && !!s.partId && !!s.deviceId && ids.includes(s.partId));
  const birakisCihazlari = [...new Set(birakis.map((s) => s.deviceId))];
  const [takilanlar, fisler, cihazlar] = await Promise.all([
    prisma.tonerChange.findMany({
      where: { tenantId: d.tenantId, partId: { in: ids }, channel: d.channel, id: { not: d.id } },
      select: { partId: true, deviceId: true, device: { select: { brand: true, model: true } } },
      orderBy: { changedAt: 'desc' },
      take: 2000,
    }),
    prisma.ticketPart.findMany({
      where: { tenantId: d.tenantId, partId: { in: ids }, ticket: { deviceId: d.deviceId, deletedAt: null } },
      select: { partId: true },
    }),
    birakisCihazlari.length
      ? prisma.device.findMany({ where: { tenantId: d.tenantId, id: { in: birakisCihazlari } }, select: { id: true, brand: true, model: true } })
      : [],
  ]);
  const uyan = new Set<string>();
  for (const t of takilanlar) {
    if (t.partId && (t.deviceId === d.deviceId || modelAnahtari(t.device.brand, t.device.model) === model)) uyan.add(t.partId);
  }
  for (const f of fisler) if (kanaliUyar(f.partId)) uyan.add(f.partId);
  const cihazModeli = new Map(cihazlar.map((c) => [c.id, modelAnahtari(c.brand, c.model)]));
  for (const s of birakis) {
    if ((s.deviceId === d.deviceId || cihazModeli.get(s.deviceId) === model) && kanaliUyar(s.partId)) uyan.add(s.partId);
  }
  return uyan;
}

// ── TESLİM TUTANAĞI ──────────────────────────────────────────────────────

export interface EmanetTutanakVerisi {
  no: string;
  tarih: Date;
  bayi: { ad: string; logo: string | null; telefon: string | null; adres: string | null; dil: string | null };
  musteri: { ad: string; unvan: string | null; adres: string | null; telefon: string | null; yetkili: string | null };
  teslimEden: string | null;
  cihaz: string | null;
  kalemler: { ad: string; kod: string | null; adet: number }[];
  bosAdet: number;
  not: string | null;
}

/**
 * Bir bırakışın tutanağı. Herhangi bir kaleminin kimliğiyle açılır, aynı
 * ziyaretin (aynı an + aynı kişi) bütün kalemlerini toplar. `tenantId`
 * verilmezse (imzalı herkese açık bağlantı) bayi satırdan okunur.
 * Fiyat ve maliyet BASILMAZ: belge müşteriye verilir.
 */
export async function tutanakVerisi(id: string, tenantId?: string): Promise<EmanetTutanakVerisi | null> {
  const s = await prisma.emanetHareketi.findFirst({
    where: { id, tur: 'BIRAKILDI', ...(tenantId ? { tenantId } : {}) },
    select: {
      tenantId: true, customerId: true, tarih: true, kullaniciId: true,
      tenant: { select: { name: true, logo: true, phone: true, address: true, locale: true } },
      customer: { select: { name: true, legalName: true, address: true, phone: true, contactPerson: true } },
    },
  });
  if (!s) return null;
  const grup = await prisma.emanetHareketi.findMany({
    where: { tenantId: s.tenantId, customerId: s.customerId, tur: 'BIRAKILDI', tarih: s.tarih, kullaniciId: s.kullaniciId },
    select: { id: true, partId: true, parcaAdi: true, adet: true, bosAdet: true, deviceId: true, not: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const partIds = [...new Set(grup.map((g) => g.partId).filter((x): x is string => !!x))];
  const deviceId = grup.find((g) => g.deviceId)?.deviceId ?? null;
  const [kartlar, kullanici, cihaz] = await Promise.all([
    partIds.length ? prisma.part.findMany({ where: { tenantId: s.tenantId, id: { in: partIds } }, select: { id: true, oemCode: true, sku: true } }) : [],
    s.kullaniciId ? prisma.user.findFirst({ where: { id: s.kullaniciId, tenantId: s.tenantId }, select: { name: true } }) : null,
    deviceId ? prisma.device.findFirst({ where: { id: deviceId, tenantId: s.tenantId }, select: { brand: true, model: true, serialNo: true, location: true } }) : null,
  ]);
  const kartMap = new Map(kartlar.map((k) => [k.id, k]));
  return {
    // Belge numarası ilk kalemden: aynı ziyaretin her kalemi aynı numarayı verir.
    no: `ET-${(grup[0]?.id ?? id).slice(-6).toUpperCase()}`,
    tarih: s.tarih,
    bayi: { ad: s.tenant.name, logo: s.tenant.logo, telefon: s.tenant.phone, adres: s.tenant.address, dil: s.tenant.locale },
    musteri: { ad: s.customer.name, unvan: s.customer.legalName, adres: s.customer.address, telefon: s.customer.phone, yetkili: s.customer.contactPerson },
    teslimEden: kullanici?.name ?? null,
    cihaz: cihaz ? cihazAdi(cihaz) : null,
    kalemler: grup.map((g) => ({ ad: g.parcaAdi, kod: g.partId ? kod(kartMap.get(g.partId)) : null, adet: g.adet })),
    bosAdet: grup.reduce((t, g) => t + g.bosAdet, 0),
    not: grup.find((g) => g.not)?.not ?? null,
  };
}

/** Müşteri kartı için kısa özet: raftaki toplam ve kalemler. */
export async function musteriEmanetKisa(tenantId: string, customerId: string, o: { yonetici: boolean; simdi?: Date }) {
  const satirlar = await prisma.emanetHareketi.findMany({ where: { tenantId, customerId }, select: SATIR, orderBy: SIRA });
  const kalemler = [...kalemlereAyir(satirlar.map(satir)).values()]
    .map((l) => kalemOzeti(l, o.simdi ?? new Date()))
    .filter((k) => k.bakiye > 0)
    .sort(kalemSirasi);
  const partIds = kalemler.map((k) => k.partId).filter((x): x is string => !!x);
  const adlar = new Map((partIds.length
    ? await prisma.part.findMany({ where: { tenantId, id: { in: partIds } }, select: { id: true, name: true } })
    : []).map((p) => [p.id, p.name]));
  const t = musteriToplami(kalemler);
  return {
    bakiye: t.bakiye, deger: o.yonetici ? t.deger : null, degerEksik: t.degerEksik, fazla: t.fazla, enEskiGun: t.enEskiGun,
    kalemler: kalemler.map((k) => ({ ad: (k.partId && adlar.get(k.partId)) || k.ad, bakiye: k.bakiye })),
    hareketVar: satirlar.length > 0,
  };
}
