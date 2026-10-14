/**
 * BUGÜN KİMİ ARAMALI — deneme hesaplarının aktivasyon hunisi.
 *
 * Hesap açmak satış değil. Bayi, kendi verisiyle Kaçan Gelir'de bir rakam
 * görünce satın alıyor; oraya giden adımlar: giriş → cihaz → sayaç →
 * ekip/iş. Toplantıdan 130+ hesap açılınca "kimi, neden aramalı" sorusu
 * tahminle cevaplanamaz: bu dosya her hesabın nerede durduğunu GERÇEK
 * kayıtlardan sayar ve bugünkü aramanın sebebini tek koda indirir.
 *
 * Kaynaklar (hepsi salt okunur): Tenant (deneme bitişi, kayıt notu),
 * User (giriş = ilk-giriş sihirbazını görmüş; rol), Customer/Device/
 * CounterReading/ServiceTicket sayıları, AuditLog (son hareket), TenantInvoice
 * (ödeme). "Kaçan Gelir rakamı" doğrudan hesaplanmaz (ağır); sayaç okuması
 * olan hesapta o ekranın bayinin kendi rakamını gösterebildiği varsayılır —
 * ekranda bu yüzden "rakam çıkabilir" denir, "rakam X" denmez.
 */
import { prisma } from '@/lib/prisma';
import { KAYIT_NOTU } from '@/lib/kayit';
import { adimBul, nedenBul, etkinlikAdi, type NedenKodu } from '@/lib/aktivasyon-kural';

export type { NedenKodu };

const GUN = 86_400_000;

export interface AktivasyonSatiri {
  tenantId: string;
  firma: string;
  yetkili: string | null;
  telefon: string | null;
  il: string | null;
  /** Kayıt notundaki etkinlik adı (toplantıdan geldiyse). */
  etkinlik: string | null;
  acilis: Date;
  denemeBitis: Date | null;
  /** 0 hesap açtı · 1 giriş · 2 cihaz · 3 sayaç · 4 ekip/iş · 5 ödedi */
  adim: number;
  sayilar: { musteri: number; cihaz: number; okuma: number; kullanici: number; teknisyen: number; fis: number };
  sonHareket: Date | null;
  neden: NedenKodu;
  /** Küçük olan önce aranır. */
  oncelik: number;
}

const say = (r: { tenantId: string; _count: { _all: number } }[]) => new Map(r.map((x) => [x.tenantId, x._count._all]));

/**
 * Deneme hesapları (ve istenirse ödeyenler), öncelik sırasıyla.
 * Kapsam: demo değil, silinmemiş; son 90 günde açılmış ya da hâlâ denemede.
 */
export async function aktivasyonListesi(o: { sadeceToplanti?: boolean; odeyenlerDahil?: boolean; simdi?: Date } = {}): Promise<AktivasyonSatiri[]> {
  const simdi = o.simdi ?? new Date();
  const tenants = await prisma.tenant.findMany({
    where: {
      demo: false,
      deletedAt: null,
      OR: [{ plan: 'trial' }, { createdAt: { gte: new Date(simdi.getTime() - 90 * GUN) } }],
      ...(o.sadeceToplanti ? { adminNotes: { startsWith: KAYIT_NOTU, contains: ' · ' } } : {}),
    },
    select: { id: true, name: true, ownerName: true, phone: true, city: true, adminNotes: true, createdAt: true, trialEndsAt: true, plan: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  if (!tenants.length) return [];
  const idler = tenants.map((t) => t.id);
  const w = { tenantId: { in: idler } };

  const [musteri, cihaz, okuma, fis, kullanicilar, girisler, hareket, odeme] = await Promise.all([
    prisma.customer.groupBy({ by: ['tenantId'], where: w, _count: { _all: true } }),
    prisma.device.groupBy({ by: ['tenantId'], where: w, _count: { _all: true } }),
    prisma.counterReading.groupBy({ by: ['tenantId'], where: w, _count: { _all: true } }),
    prisma.serviceTicket.groupBy({ by: ['tenantId'], where: w, _count: { _all: true } }),
    prisma.user.groupBy({ by: ['tenantId', 'role'], where: { ...w, isActive: true }, _count: { _all: true } }),
    // Giriş: ilk-giriş sihirbazını gören (tamamlayan ya da atlayan) bir kullanıcı.
    prisma.user.groupBy({ by: ['tenantId'], where: { ...w, onboardedAt: { not: null } }, _count: { _all: true } }),
    // Son hareket: bayinin kendi kullanıcısının yaptığı son kayıt (süper admin/sistem sayılmaz).
    prisma.auditLog.groupBy({ by: ['tenantId'], where: { ...w, NOT: { actorType: { in: ['SUPER_ADMIN', 'SYSTEM'] } } }, _max: { createdAt: true } }),
    prisma.tenantInvoice.groupBy({ by: ['tenantId'], where: { ...w, status: 'paid' }, _count: { _all: true } }),
  ]);

  const mM = say(musteri), mC = say(cihaz), mO = say(okuma), mF = say(fis), mG = say(girisler), mP = say(odeme);
  const mH = new Map(hareket.map((x) => [x.tenantId, x._max.createdAt]));
  const kul = new Map<string, { toplam: number; teknisyen: number }>();
  for (const k of kullanicilar) {
    const v = kul.get(k.tenantId) ?? { toplam: 0, teknisyen: 0 };
    v.toplam += k._count._all;
    if (k.role === 'TECHNICIAN') v.teknisyen += k._count._all;
    kul.set(k.tenantId, v);
  }

  const satirlar: AktivasyonSatiri[] = tenants.map((t) => {
    const sayilar = {
      musteri: mM.get(t.id) ?? 0,
      cihaz: mC.get(t.id) ?? 0,
      okuma: mO.get(t.id) ?? 0,
      kullanici: kul.get(t.id)?.toplam ?? 0,
      teknisyen: kul.get(t.id)?.teknisyen ?? 0,
      fis: mF.get(t.id) ?? 0,
    };
    const sonHareket = mH.get(t.id) ?? null;
    const odedi = (mP.get(t.id) ?? 0) > 0;
    const adim = adimBul({ girdi: (mG.get(t.id) ?? 0) > 0 || !!sonHareket, ...sayilar, odedi });
    const { neden, oncelik } = nedenBul({ adim, acilis: t.createdAt, denemeBitis: t.trialEndsAt, sonHareket }, simdi);
    return {
      tenantId: t.id,
      firma: t.name,
      yetkili: t.ownerName,
      telefon: t.phone,
      il: t.city,
      etkinlik: etkinlikAdi(t.adminNotes, KAYIT_NOTU),
      acilis: t.createdAt,
      denemeBitis: t.trialEndsAt,
      adim,
      sayilar,
      sonHareket,
      neden,
      oncelik,
    };
  });

  return satirlar
    .filter((s) => o.odeyenlerDahil || s.adim < 5)
    .filter((s) => !o.sadeceToplanti || !!s.etkinlik)
    .sort((a, b) => a.oncelik - b.oncelik || b.adim - a.adim || a.acilis.getTime() - b.acilis.getTime());
}
