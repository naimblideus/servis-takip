/**
 * KURULUM VE BAŞARI — veri katmanı. Kurallar saf dosyada (kurulum.ts).
 *
 * Bütün bayiler için TOPLU sorgu: her tablo bir kez, groupBy ile. Bayi başına
 * sorgu yok — 500 bayide bayi başına 15 sorgu 7.500 sorgu eder ve liste
 * açılmaz. Tek bayi ayrıntısı aynı hesabı tek kimlikle çalıştırır; böylece
 * listede görünen "3/5" ile ayrıntıdaki adımlar asla ayrışmaz.
 *
 * Kapsam: demo değil, silinmemiş bayiler. Hepsi salt okunur; yazan yalnız
 * takip (KurulumTakip) ve not (KurulumNotu) fonksiyonları.
 */
import { prisma } from '@/lib/prisma';
import {
  kurulumDurumu,
  saglikDurumu,
  bugunAranacak,
  ayBasi,
  KENDILIGINDEN_KAYNAKLAR,
  SAYAC_PENCERESI_GUN,
  KULLANIM_PENCERESI_GUN,
  type KurulumSonucu,
  type SaglikSonucu,
  type NotTuru,
} from '@/lib/kurulum';

const GUN = 86_400_000;
/** Liste üst sınırı: bundan fazla bayide sayfalama gerekir (bugün ~200). */
const EN_COK_BAYI = 3000;

export interface KurulumSatiri {
  tenantId: string;
  firma: string;
  il: string | null;
  yetkili: string | null;
  telefon: string | null;
  eposta: string | null;
  plan: string;
  acilis: Date;
  denemeBitis: Date | null;
  cihaz: number;
  musteri: number;
  kurulum: KurulumSonucu;
  saglik: SaglikSonucu;
  sorumluId: string | null;
  sorumluAd: string | null;
  sonrakiTemas: Date | null;
  sonNot: Date | null;
  sonHareket: Date | null;
  acikSorun: number;
  durduranSorun: number;
  bugunAranacak: boolean;
}

const TENANT_ALANLARI = {
  id: true,
  name: true,
  city: true,
  ownerName: true,
  phone: true,
  email: true,
  address: true,
  taxNumber: true,
  country: true,
  plan: true,
  createdAt: true,
  trialEndsAt: true,
  whatsappPhoneId: true,
  vadeHatirlatma: true,
  sayacHatirlatma: true,
  eFaturaSaglayici: true,
  bizimHesapFirmId: true,
} as const;

type TenantSecimi = {
  id: string;
  name: string;
  city: string | null;
  ownerName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  country: string;
  plan: string;
  createdAt: Date;
  trialEndsAt: Date | null;
  whatsappPhoneId: string | null;
  vadeHatirlatma: boolean;
  sayacHatirlatma: boolean;
  eFaturaSaglayici: string | null;
  bizimHesapFirmId: string | null;
};

const dolu = (s: string | null | undefined) => !!s && s.trim().length > 0;
const say = (r: { tenantId: string; _count: { _all: number } }[]) => new Map(r.map((x) => [x.tenantId, x._count._all]));
const artir = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

/** Verilen bayiler için bütün sayıları toplu çeker ve kuralları uygular. */
async function hesapla(tenants: TenantSecimi[], simdi: Date): Promise<KurulumSatiri[]> {
  if (!tenants.length) return [];
  const idler = tenants.map((t) => t.id);
  const w = { tenantId: { in: idler } };
  const sayacBasi = new Date(simdi.getTime() - SAYAC_PENCERESI_GUN * GUN);
  const kullanimBasi = new Date(simdi.getTime() - KULLANIM_PENCERESI_GUN * GUN);
  const buAy = ayBasi(simdi);

  const [
    cihazlar,
    fiyatli,
    kiralikOkuma,
    kaynaklar,
    faturalar,
    ekip,
    fisler,
    taramalar,
    araclar,
    sozlesmeler,
    portallar,
    musteriler,
    hareket,
    odeme,
    sorunlar,
    takipler,
    notlar,
  ] = await Promise.all([
    prisma.device.groupBy({ by: ['tenantId', 'isRental'], where: w, _count: { _all: true } }),
    // Fiyat: cihaza yazılmış kira ya da sayfa fiyatı. Bayinin varsayılan sayfa
    // fiyatı (0,40) sistemin koyduğu yer tutucu — bayinin girdiğinin kanıtı değil.
    prisma.device.groupBy({
      by: ['tenantId'],
      where: { ...w, isRental: true, OR: [{ monthlyRent: { gt: 0 } }, { pricePerBlack: { gt: 0 } }] },
      _count: { _all: true },
    }),
    // Son 35 günde okunan kiralık + son okuma anı (bu ay okundu mu buradan:
    // ay başı en çok 31 gün geride, 35 günlük pencerenin içinde).
    prisma.counterReading.groupBy({
      by: ['tenantId', 'deviceId'],
      where: { ...w, readingDate: { gte: sayacBasi }, device: { isRental: true } },
      _max: { readingDate: true },
    }),
    prisma.counterReading.groupBy({
      by: ['tenantId', 'source'],
      where: { ...w, readingDate: { gte: sayacBasi }, device: { isRental: true } },
      _count: { _all: true },
    }),
    prisma.customerInvoice.groupBy({
      by: ['tenantId'],
      where: { ...w, deletedAt: null },
      _count: { _all: true },
      _min: { invoiceDate: true },
      _max: { invoiceDate: true },
    }),
    prisma.user.groupBy({
      by: ['tenantId'],
      where: { ...w, isActive: true, role: { in: ['TECHNICIAN', 'FRONT_DESK'] } },
      _count: { _all: true },
    }),
    prisma.serviceTicket.groupBy({ by: ['tenantId'], where: { ...w, deletedAt: null, createdAt: { gte: kullanimBasi } }, _count: { _all: true } }),
    prisma.sayacTaramasi.groupBy({ by: ['tenantId'], where: { ...w, createdAt: { gte: kullanimBasi } }, _count: { _all: true } }),
    prisma.depo.groupBy({ by: ['tenantId'], where: { ...w, tur: 'ARAC', aktif: true }, _count: { _all: true } }),
    prisma.contract.groupBy({ by: ['tenantId'], where: { ...w, status: 'AKTIF' }, _count: { _all: true } }),
    prisma.customer.groupBy({ by: ['tenantId'], where: { ...w, portalEnabled: true }, _count: { _all: true } }),
    prisma.customer.groupBy({ by: ['tenantId'], where: w, _count: { _all: true } }),
    // Son hareket: bayinin kendi kullanıcısının kaydı. Süper admin ve sistem
    // (otomatik fatura, cihaz e-postası) sayılmaz — bayi uyuyorken sistem çalışır.
    prisma.auditLog.groupBy({
      by: ['tenantId'],
      where: { ...w, NOT: { actorType: { in: ['SUPER_ADMIN', 'SYSTEM'] } } },
      _max: { createdAt: true },
    }),
    prisma.tenantInvoice.groupBy({ by: ['tenantId'], where: { ...w, status: 'paid' }, _count: { _all: true } }),
    prisma.sorunBildirimi.groupBy({
      by: ['tenantId', 'tur'],
      where: { ...w, demo: false, durum: { in: ['YENI', 'INCELENIYOR'] } },
      _count: { _all: true },
    }),
    prisma.kurulumTakip.findMany({ where: w }),
    prisma.kurulumNotu.groupBy({ by: ['tenantId'], where: w, _max: { createdAt: true } }),
  ]);

  const cihaz = new Map<string, number>();
  const kiralik = new Map<string, number>();
  for (const c of cihazlar) {
    artir(cihaz, c.tenantId, c._count._all);
    if (c.isRental) artir(kiralik, c.tenantId, c._count._all);
  }
  const okunan = new Map<string, number>();
  const buAyOkunan = new Map<string, number>();
  for (const r of kiralikOkuma) {
    artir(okunan, r.tenantId);
    if (r._max.readingDate && r._max.readingDate >= buAy) artir(buAyOkunan, r.tenantId);
  }
  const okuma = new Map<string, number>();
  const kendiliginden = new Map<string, number>();
  const otomatik = new Set<string>(KENDILIGINDEN_KAYNAKLAR);
  for (const k of kaynaklar) {
    artir(okuma, k.tenantId, k._count._all);
    if (otomatik.has(k.source)) artir(kendiliginden, k.tenantId, k._count._all);
  }
  const fatura = new Map(faturalar.map((f) => [f.tenantId, f]));
  const acik = new Map<string, number>();
  const durduran = new Map<string, number>();
  for (const s of sorunlar) {
    artir(acik, s.tenantId, s._count._all);
    if (s.tur === 'DURDURUYOR') artir(durduran, s.tenantId, s._count._all);
  }
  const mF = say(fiyatli), mE = say(ekip), mFis = say(fisler), mT = say(taramalar), mA = say(araclar);
  const mS = say(sozlesmeler), mP = say(portallar), mM = say(musteriler), mOd = say(odeme);
  const mH = new Map(hareket.map((h) => [h.tenantId, h._max.createdAt]));
  const mTakip = new Map(takipler.map((t) => [t.tenantId, t]));
  const mNot = new Map(notlar.map((n) => [n.tenantId, n._max.createdAt]));

  return tenants.map((t) => {
    const k = kiralik.get(t.id) ?? 0;
    const f = fatura.get(t.id);
    const kurulum = kurulumDurumu(
      {
        firma: { vergiNo: dolu(t.taxNumber), adres: dolu(t.address), telefon: dolu(t.phone) },
        ulke: t.country,
        cihaz: cihaz.get(t.id) ?? 0,
        kiralik: k,
        fiyatliKiralik: mF.get(t.id) ?? 0,
        okunanKiralik: okunan.get(t.id) ?? 0,
        okuma: okuma.get(t.id) ?? 0,
        kendiliginden: kendiliginden.get(t.id) ?? 0,
        faturaSayisi: f?._count._all ?? 0,
        ilkFatura: f?._min.invoiceDate ?? null,
        ekip: mE.get(t.id) ?? 0,
        fis: mFis.get(t.id) ?? 0,
        tarama: mT.get(t.id) ?? 0,
        arac: mA.get(t.id) ?? 0,
        sozlesme: mS.get(t.id) ?? 0,
        // WhatsApp: bayi hatırlatmalardan birini açtı (rıza) ya da kendi numarasını bağladı.
        whatsapp: t.vadeHatirlatma || t.sayacHatirlatma || dolu(t.whatsappPhoneId),
        // e-Fatura: Bizim Hesap bağlantısı da belgeyi keser. 'TEST' gerçek değil.
        eFatura: dolu(t.bizimHesapFirmId) || (dolu(t.eFaturaSaglayici) && t.eFaturaSaglayici !== 'TEST')
          ? 'GERCEK'
          : t.eFaturaSaglayici === 'TEST' ? 'TEST' : 'YOK',
        portal: mP.get(t.id) ?? 0,
      },
      t.createdAt,
    );
    const sonHareket = mH.get(t.id) ?? null;
    const saglik = saglikDurumu(
      {
        acilis: t.createdAt,
        sonHareket,
        kiralik: k,
        buAyOkunanKiralik: buAyOkunan.get(t.id) ?? 0,
        faturaSayisi: f?._count._all ?? 0,
        sonFatura: f?._max.invoiceDate ?? null,
        denemede: t.plan === 'trial',
        denemeBitis: t.trialEndsAt,
        odedi: (mOd.get(t.id) ?? 0) > 0,
        acikSorun: acik.get(t.id) ?? 0,
        durduranSorun: durduran.get(t.id) ?? 0,
      },
      simdi,
    );
    const takip = mTakip.get(t.id);
    return {
      tenantId: t.id,
      firma: t.name,
      il: t.city,
      yetkili: t.ownerName,
      telefon: t.phone,
      eposta: t.email,
      plan: t.plan,
      acilis: t.createdAt,
      denemeBitis: t.trialEndsAt,
      cihaz: cihaz.get(t.id) ?? 0,
      musteri: mM.get(t.id) ?? 0,
      kurulum,
      saglik,
      sorumluId: takip?.sorumluId ?? null,
      sorumluAd: takip?.sorumluAd ?? null,
      sonrakiTemas: takip?.sonrakiTemas ?? null,
      sonNot: mNot.get(t.id) ?? null,
      sonHareket,
      acikSorun: acik.get(t.id) ?? 0,
      durduranSorun: durduran.get(t.id) ?? 0,
      bugunAranacak: bugunAranacak(takip?.sonrakiTemas ?? null, saglik.renk, simdi),
    };
  });
}

const RENK_SIRASI = { KIRMIZI: 0, SARI: 1, YESIL: 2 } as const;

/**
 * Bütün demo olmayan, silinmemiş bayiler. Sıra: bugün aranacaklar → kırmızı
 * → sarı → kurulumu en geride olan → en eski açılış (en uzun bekleyen önce).
 */
export async function kurulumListesi(o: { simdi?: Date } = {}): Promise<KurulumSatiri[]> {
  const simdi = o.simdi ?? new Date();
  const tenants = await prisma.tenant.findMany({
    where: { demo: false, deletedAt: null },
    select: TENANT_ALANLARI,
    orderBy: { createdAt: 'asc' },
    take: EN_COK_BAYI,
  });
  const satirlar = await hesapla(tenants, simdi);
  return satirlar.sort(
    (a, b) =>
      Number(b.bugunAranacak) - Number(a.bugunAranacak) ||
      RENK_SIRASI[a.saglik.renk] - RENK_SIRASI[b.saglik.renk] ||
      a.kurulum.zorunluTamam - b.kurulum.zorunluTamam ||
      a.acilis.getTime() - b.acilis.getTime(),
  );
}

/** Tek bayi (liste ile aynı hesap). Demo ya da silinmişse null. */
export async function kurulumSatiri(tenantId: string, simdi = new Date()): Promise<KurulumSatiri | null> {
  const t = await prisma.tenant.findFirst({ where: { id: tenantId, demo: false, deletedAt: null }, select: TENANT_ALANLARI });
  if (!t) return null;
  const [s] = await hesapla([t], simdi);
  return s ?? null;
}

export interface KurulumAyrintisi {
  satir: KurulumSatiri;
  notlar: { id: string; yazanAd: string; tur: string; metin: string; createdAt: Date }[];
  ekip: { id: string; ad: string }[];
}

/** Ayrıntı ekranı: satır + notlar (en yeni önce, son 200) + sorumlu seçilebilecek süper adminler. */
export async function kurulumAyrintisi(tenantId: string, simdi = new Date()): Promise<KurulumAyrintisi | null> {
  const satir = await kurulumSatiri(tenantId, simdi);
  if (!satir) return null;
  const [notlar, ekip] = await Promise.all([
    prisma.kurulumNotu.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, yazanAd: true, tur: true, metin: true, createdAt: true },
    }),
    prisma.superAdmin.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return { satir, notlar, ekip: ekip.map((e) => ({ id: e.id, ad: e.name })) };
}

// ── YAZMA ───────────────────────────────────────────────────────────────

export type YazmaSonucu<T> = { ok: true; deger: T } | { ok: false; hata: 'BAYI_YOK' | 'SORUMLU_YOK' };

/**
 * Takip (sorumlu + sonraki temas). Sorumlu adı o anki süper admin adından
 * kopyalanır: kişi sonradan silinse de listede kimin baktığı okunur.
 */
export async function takipGuncelle(
  tenantId: string,
  g: { sorumluId?: string | null; sonrakiTemas?: Date | null },
): Promise<YazmaSonucu<{ once: { sorumluId: string | null; sonrakiTemas: Date | null }; sonra: { sorumluId: string | null; sorumluAd: string | null; sonrakiTemas: Date | null } }>> {
  const bayi = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { id: true } });
  if (!bayi) return { ok: false, hata: 'BAYI_YOK' };
  const data: { sorumluId?: string | null; sorumluAd?: string | null; sonrakiTemas?: Date | null } = {};
  if (g.sorumluId !== undefined) {
    if (g.sorumluId === null) {
      data.sorumluId = null;
      data.sorumluAd = null;
    } else {
      const sa = await prisma.superAdmin.findUnique({ where: { id: g.sorumluId }, select: { id: true, name: true } });
      if (!sa) return { ok: false, hata: 'SORUMLU_YOK' };
      data.sorumluId = sa.id;
      data.sorumluAd = sa.name;
    }
  }
  if (g.sonrakiTemas !== undefined) data.sonrakiTemas = g.sonrakiTemas;
  const once = await prisma.kurulumTakip.findUnique({ where: { tenantId } });
  const sonra = await prisma.kurulumTakip.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
  return {
    ok: true,
    deger: {
      once: { sorumluId: once?.sorumluId ?? null, sonrakiTemas: once?.sonrakiTemas ?? null },
      sonra: { sorumluId: sonra.sorumluId, sorumluAd: sonra.sorumluAd, sonrakiTemas: sonra.sonrakiTemas },
    },
  };
}

/** Yeni not (girdi `notGirdisi` ile doğrulanmış olmalı). Yazan adı oturumdan gelir, istemciden değil. */
export async function notEkle(
  tenantId: string,
  g: { yazanId: string | null; yazanAd: string; tur: NotTuru; metin: string },
): Promise<YazmaSonucu<{ id: string; createdAt: Date }>> {
  const bayi = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { id: true } });
  if (!bayi) return { ok: false, hata: 'BAYI_YOK' };
  const n = await prisma.kurulumNotu.create({
    data: { tenantId, yazanId: g.yazanId, yazanAd: g.yazanAd, tur: g.tur, metin: g.metin },
    select: { id: true, createdAt: true },
  });
  return { ok: true, deger: n };
}
