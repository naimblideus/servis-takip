/**
 * SAYAÇ TARAMASI — veri katmanı.
 *
 * Karar kuralları lib/sayac-tarama.ts'te (saf). Burada yalnız: anahtarla
 * bayiyi bulmak, bayinin cihazlarını çekmek, sonucu saklamak ve onaylanan
 * okumaları TEK yazma yolundan (lib/readings.ts createReading) geçirmek.
 * Sayaç tarayıcıdan geldi diye ayrı bir yazma yolu açılmıyor: gerileme
 * reddi, anomali uyarısı ve kademeli ücret hesabı aynen işliyor.
 */
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type FaultCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createReading, ReadingError } from '@/lib/readings';
import { degisimKaydet } from '@/lib/verim-ogrenme';
import { generateTicketNumber } from '@/lib/ticket-number';
import { kaydetAsama } from '@/lib/ticket-asama';
import { sozluk, doldur } from '@/lib/i18n/sozluk';
import {
  cihazSonucu, tekrarlariAyikla, taramaOzeti, ilerlemeDurumu, tonerDegistiMi,
  dikkatSirasi, TONER_KRITIK, DURUM_TAZE_MS, SESSIZ_MS, TARAYICI_SURUMU,
  olayFarki, fisAcacakOlaylar, UYARI_KATEGORISI, PARCA_KRITIK,
  type CihazSonucu, type TaramaGovdesi, type TaramaOzeti, type UyariKodu, type SarfKalemi,
} from '@/lib/sayac-tarama';

export const KAYNAK_TARAMA = 'AG_TARAMA' as const;

/** Anahtarın özeti — veritabanında anahtarın KENDİSİ değil bu durur. */
export function anahtarOzeti(anahtar: string): string {
  return createHash('sha256').update(anahtar, 'utf8').digest('hex');
}

export function anahtarUret(): { anahtar: string; ozet: string } {
  const anahtar = `nst_${randomBytes(24).toString('base64url')}`;
  return { anahtar, ozet: anahtarOzeti(anahtar) };
}

const ANAHTAR_DESENI = /^nst_[A-Za-z0-9_-]{20,64}$/;

/** Tarayıcının anahtarından bayi. Biçimsiz anahtar veritabanına sorulmaz. */
export async function anahtarlaBayi(anahtar: string | null | undefined) {
  if (!anahtar || !ANAHTAR_DESENI.test(anahtar)) return null;
  return prisma.tenant.findUnique({
    where: { tarayiciAnahtarHash: anahtarOzeti(anahtar) },
    select: { id: true, isActive: true, isSuspended: true, deletedAt: true, tarayiciOtomatikYaz: true },
  });
}

async function sistemCihazlari(tenantId: string) {
  return prisma.device.findMany({
    where: { tenantId },
    select: { id: true, serialNo: true, reportedSerial: true, counterBlack: true, counterColor: true },
  });
}

type BayiKaydi = NonNullable<Awaited<ReturnType<typeof prisma.tenant.findUnique>>>;

/** Yazılabilir sonucu okuma olarak kaydeder; okuma katmanı reddederse HATA. */
async function yaz(tenantId: string, s: CihazSonucu, tenant: BayiKaydi): Promise<CihazSonucu> {
  if (s.durum !== 'YAZILABILIR' || !s.deviceId || s.siyah === null || s.renkli === null) return s;
  try {
    await createReading(
      { tenantId, deviceId: s.deviceId, counterBlack: s.siyah, counterColor: s.renkli, source: KAYNAK_TARAMA },
      tenant,
    );
    return { ...s, durum: 'YAZILDI' };
  } catch (e) {
    if (e instanceof ReadingError) return { ...s, durum: 'HATA', hataKodu: e.code };
    throw e;
  }
}

/** Değişim ancak bu kadar yakın iki ölçüm arasında görülürse kaydedilir. */
const DEGISIM_PENCERESI_MS = 7 * 86_400_000;

/**
 * CİHAZDAN ÖLÇÜLEN DURUM. Sayaç onay beklese bile toner yüzdesi ve uyarılar
 * hemen cihaz kartına yazılır: bunlar fatura değil, durum bilgisi.
 *
 * Toner değişimi: önceki ölçüm bitmeye yakın, yeni ölçüm dolu ise
 * (lib/sayac-tarama tonerDegistiMi) siyah toner değişimi kaydedilir; verim
 * böylece kimse elle girmeden öğrenilir. İki ölçüm arası uzunsa (tarayıcı
 * haftalarca çalışmamış) değişimin hangi sayaçta olduğu belirsizdir ve
 * kaydedilmez. Arada fişle ya da elle değişim girilmişse yine kaydedilmez.
 * Renkli kanal kaydedilmiyor: "renkli" en düşük renk; bir rengin değişmesi
 * öbürlerinin de değiştiği anlamına gelmez.
 */
async function durumuYaz(tenantId: string, sonuclar: CihazSonucu[]): Promise<CihazSonucu[]> {
  const tekil = sonuclar.filter((s) => s.deviceId && s.durum !== 'BIRDEN_FAZLA');
  if (!tekil.length) return sonuclar;
  const ids = tekil.map((s) => s.deviceId as string);
  const [onceki, acikOlaylar, bayi] = await Promise.all([
    prisma.device.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, olcumAt: true, olcumSiyah: true, cihazUyarilari: true, uyariAt: true, counterBlack: true },
    }).then((l) => new Map(l.map((d) => [d.id, d]))),
    prisma.cihazOlayi.findMany({
      where: { tenantId, deviceId: { in: ids }, bitti: null },
      select: { id: true, deviceId: true, kod: true, gorulme: true, ticketId: true },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { tarayiciOtomatikFis: true, locale: true } }),
  ]);
  const simdi = new Date();
  const ek = new Map<CihazSonucu, Partial<CihazSonucu>>();
  for (const s of tekil) {
    const d = onceki.get(s.deviceId as string);
    if (!d) continue;
    const olcum = s.olcum ?? { siyah: null, renkli: null };
    // Eski betik ya da durum tablosunu vermeyen cihaz: uyarılar "bilinmiyor".
    // Kart ve açık olaylar olduğu gibi kalır; yoksa her eski tarama bütün
    // uyarıları "düzeldi" diye kapatırdı.
    const durumVar = s.durumOkundu !== false && s.durumOkundu !== undefined;
    const uyarilar = durumVar ? (s.uyarilar ?? []) : null;
    await prisma.device.update({
      where: { id: d.id },
      data: {
        olcumAt: simdi,
        olcumSiyah: olcum.siyah,
        olcumRenkli: olcum.renkli,
        olcumParca: s.parca ?? null,
        olcumSarf: s.kalemler?.length ? (s.kalemler as unknown as object) : Prisma.DbNull,
        ...(uyarilar ? {
          cihazUyarilari: uyarilar,
          // Uyarı sürüyorsa ilk görüldüğü an korunur ("3 gündür sıkışık").
          uyariAt: uyarilar.length ? (d.cihazUyarilari.length && d.uyariAt ? d.uyariAt : simdi) : null,
        } : {}),
      },
    });

    if (uyarilar) {
      const acik = acikOlaylar.filter((o) => o.deviceId === d.id);
      const fark = olayFarki(acik.map((o) => o.kod), uyarilar);
      if (fark.biten.length) {
        await prisma.cihazOlayi.updateMany({ where: { tenantId, deviceId: d.id, bitti: null, kod: { in: fark.biten } }, data: { bitti: simdi } });
      }
      if (fark.suren.length) {
        await prisma.cihazOlayi.updateMany({ where: { tenantId, deviceId: d.id, bitti: null, kod: { in: fark.suren } }, data: { gorulme: { increment: 1 } } });
      }
      if (fark.yeni.length) {
        await prisma.cihazOlayi.createMany({ data: fark.yeni.map((kod) => ({ tenantId, deviceId: d.id, kod, basladi: simdi })) });
      }
      if (bayi?.tarayiciOtomatikFis) {
        const guncel = acik.filter((o) => fark.suren.includes(o.kod)).map((o) => ({ ...o, gorulme: o.gorulme + 1 }));
        const fis = await otomatikFis(tenantId, d.id, fisAcacakOlaylar(guncel), bayi.locale);
        if (fis) ek.set(s, { ...(ek.get(s) ?? {}), fisAcildi: fis });
      }
    }

    if (!d.olcumAt || simdi.getTime() - d.olcumAt.getTime() > DEGISIM_PENCERESI_MS) continue;
    if (!tonerDegistiMi(d.olcumSiyah, olcum.siyah)) continue;
    const sayac = s.siyah ?? d.counterBlack;
    if (sayac === null) continue;
    const girilmis = await prisma.tonerChange.findFirst({
      where: { tenantId, deviceId: d.id, channel: 'BLACK', changedAt: { gte: d.olcumAt } },
      select: { id: true },
    });
    if (girilmis) continue;
    await degisimKaydet({
      tenantId, deviceId: d.id, channel: 'BLACK', counterValue: sayac, changedAt: simdi,
      source: 'TARAYICI', note: `%${d.olcumSiyah} → %${olcum.siyah}`,
    });
    ek.set(s, { ...(ek.get(s) ?? {}), tonerDegisti: true });
  }
  return ek.size ? sonuclar.map((s) => (ek.has(s) ? { ...s, ...ek.get(s) } : s)) : sonuclar;
}

/**
 * Servis uyarısından fiş. Cihazda açık fiş varsa YENİSİ AÇILMAZ, uyarı o
 * fişe bağlanır: aynı arıza için ikinci fiş teknisyeni iki kez yollar.
 * Cihaz satırı kilitlenir; aynı anda gelen iki tarama iki fiş açamaz.
 * Fiş bir kullanıcı adına açılmak zorunda (createdByUserId): bayinin
 * yöneticisi; kaynak "SISTEM" olarak işlenir. Fiş numarası tek yerden.
 */
async function otomatikFis(
  tenantId: string,
  deviceId: string,
  olaylar: { id: string; kod: string }[],
  dil: string | null,
): Promise<string | null> {
  if (!olaylar.length) return null;
  const kodlar = olaylar.map((o) => o.kod as UyariKodu);
  const yonetici = await prisma.user.findFirst({
    where: { tenantId, isActive: true, role: { in: ['ADMIN', 'FRONT_DESK'] } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (!yonetici) return null;
  const numara = await generateTicketNumber(tenantId);
  // Fiş bayinin iç kaydı: bayinin dilinde yazılır.
  const sz = sozluk(dil);
  const sonuc = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Device" WHERE id = ${deviceId} AND "tenantId" = ${tenantId} FOR UPDATE`;
    const cihaz = await tx.device.findFirst({ where: { id: deviceId, tenantId }, select: { customerId: true } });
    if (!cihaz) return null;
    const acik = await tx.serviceTicket.findFirst({
      where: { tenantId, deviceId, deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (acik) {
      await tx.cihazOlayi.updateMany({ where: { id: { in: olaylar.map((o) => o.id) } }, data: { ticketId: acik.id } });
      return { yeni: false as const, id: acik.id, no: null };
    }
    const adlar = kodlar.map((k) => sz.tarayici.uyari[k] ?? k).join(', ');
    const fis = await tx.serviceTicket.create({
      data: {
        tenantId, deviceId, customerId: cihaz.customerId,
        ticketNumber: numara, status: 'NEW',
        issueText: doldur(sz.tarayici.fisSorun, { uyarilar: adlar }),
        faultCategory: (kodlar.map((k) => UYARI_KATEGORISI[k]).find(Boolean) as FaultCategory | undefined) ?? null,
        notes: sz.tarayici.otomatikFisNotu,
        createdByUserId: yonetici.id,
      },
      select: { id: true, ticketNumber: true },
    });
    await tx.cihazOlayi.updateMany({ where: { id: { in: olaylar.map((o) => o.id) } }, data: { ticketId: fis.id } });
    return { yeni: true as const, id: fis.id, no: fis.ticketNumber };
  }).catch((e) => {
    // Numara çakışması gibi nadir durumlar: olay açık kalır, bir sonraki tarama yeniden dener.
    console.error('[tarayici] otomatik fiş açılamadı:', e instanceof Error ? e.message : e);
    return null;
  });
  if (!sonuc?.yeni) return null;
  await kaydetAsama({ tenantId, ticketId: sonuc.id, status: 'NEW', kaynak: 'SISTEM', notu: sz.tarayici.otomatikFisNotu });
  return sonuc.no;
}

/**
 * Tarayıcının getirdiğini kaydeder. Bayi otomatik yazmayı açtıysa uygun
 * okumalar hemen yazılır; açmadıysa tarama onay bekler.
 */
export async function taramaKaydet(
  tenantId: string,
  govde: TaramaGovdesi,
  otomatik: boolean,
): Promise<{ id: string; ozet: TaramaOzeti; sonuclar: CihazSonucu[] }> {
  const cihazlar = await sistemCihazlari(tenantId);
  let sonuclar = tekrarlariAyikla(govde.cihazlar.map((c) => cihazSonucu(c, cihazlar)));
  let onaylandiAt: Date | null = null;

  if (otomatik && sonuclar.some((s) => s.durum === 'YAZILABILIR')) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant) {
      // Sırayla: her okuma cihazın kendi geçmişine ve ayın önceki
      // okumalarına bakıyor; paralel yazım aynı ayın dahil paketini iki
      // kez düşebilirdi.
      const yeni: CihazSonucu[] = [];
      for (const s of sonuclar) yeni.push(await yaz(tenantId, s, tenant));
      sonuclar = yeni;
      onaylandiAt = new Date();
    }
  }
  sonuclar = await durumuYaz(tenantId, sonuclar);

  const ozet = taramaOzeti(sonuclar);
  const kayit = await prisma.sayacTaramasi.create({
    data: {
      tenantId,
      bilgisayar: govde.bilgisayar,
      surum: govde.surum,
      taranan: govde.taranan,
      bulunan: ozet.bulunan,
      eslesen: ozet.eslesen,
      yazilabilir: ozet.yazilabilir,
      yazilan: ozet.yazilan,
      sonuc: sonuclar as unknown as object,
      onaylandiAt,
    },
    select: { id: true },
  });
  return { id: kayit.id, ozet, sonuclar };
}

export type OnayCevabi =
  | { durum: 'YOK' }
  | { durum: 'ZATEN' }
  | { durum: 'TAMAM'; ozet: TaramaOzeti };

/**
 * Bayinin onayıyla taramanın uygun okumalarını yazar.
 *
 * İki koruma:
 *   · SAHİPLENME. İki onay aynı anda gelirse (çift tıklama, iki sekme)
 *     yalnız biri yazar; diğeri "zaten onaylandı" alır. Yoksa aynı sayaç
 *     iki okuma olurdu.
 *   · GÜNCEL SAYAÇ. Tarama ile onay arasında teknisyen elle okuma girmiş
 *     olabilir. Karar taramadaki "son okuma"ya göre değil, sistemdeki
 *     ŞİMDİKİ sayaca göre yeniden verilir.
 */
export async function taramaOnayla(tenantId: string, id: string): Promise<OnayCevabi> {
  const kayit = await prisma.sayacTaramasi.findFirst({
    where: { id, tenantId },
    select: { id: true, sonuc: true },
  });
  if (!kayit) return { durum: 'YOK' };

  const al = await prisma.sayacTaramasi.updateMany({
    where: { id, tenantId, onaylandiAt: null },
    data: { onaylandiAt: new Date() },
  });
  if (al.count !== 1) return { durum: 'ZATEN' };

  const eski = (Array.isArray(kayit.sonuc) ? kayit.sonuc : []) as unknown as CihazSonucu[];
  const ids = eski.filter((s) => s.durum === 'YAZILABILIR' && s.deviceId).map((s) => s.deviceId as string);
  const guncel = new Map(
    (ids.length
      ? await prisma.device.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, counterBlack: true, counterColor: true } })
      : []
    ).map((d) => [d.id, d]),
  );
  const tenant = ids.length ? await prisma.tenant.findUnique({ where: { id: tenantId } }) : null;

  const yeni: CihazSonucu[] = [];
  for (const s of eski) {
    if (s.durum !== 'YAZILABILIR' || !s.deviceId || s.siyah === null || s.renkli === null) { yeni.push(s); continue; }
    const g = guncel.get(s.deviceId);
    // Tarama ile onay arasında cihaz silinmiş.
    if (!g || !tenant) { yeni.push({ ...s, durum: 'ESLESMEDI', deviceId: null }); continue; }
    const d = ilerlemeDurumu(s.siyah, s.renkli, g.counterBlack, g.counterColor);
    if (d !== 'YAZILABILIR') { yeni.push({ ...s, durum: d, sonSiyah: g.counterBlack, sonRenkli: g.counterColor }); continue; }
    yeni.push(await yaz(tenantId, { ...s, sonSiyah: g.counterBlack, sonRenkli: g.counterColor }, tenant));
  }

  const ozet = taramaOzeti(yeni);
  await prisma.sayacTaramasi.update({
    where: { id },
    data: { sonuc: yeni as unknown as object, yazilabilir: ozet.yazilabilir, yazilan: ozet.yazilan },
  });
  return { durum: 'TAMAM', ozet };
}

/** Panelin gösterdiği son taramalar ve eşleşen cihazların etiketi. */
export async function sonTaramalar(tenantId: string, adet = 10) {
  const taramalar = await prisma.sayacTaramasi.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: adet,
    select: {
      id: true, createdAt: true, bilgisayar: true, taranan: true, bulunan: true,
      eslesen: true, yazilabilir: true, yazilan: true, sonuc: true, onaylandiAt: true,
    },
  });
  const ids = new Set<string>();
  for (const t of taramalar) {
    for (const s of (Array.isArray(t.sonuc) ? t.sonuc : []) as unknown as CihazSonucu[]) if (s.deviceId) ids.add(s.deviceId);
  }
  const cihazlar = ids.size
    ? await prisma.device.findMany({
        where: { tenantId, id: { in: [...ids] } },
        select: { id: true, brand: true, model: true, serialNo: true, customer: { select: { name: true } } },
      })
    : [];
  return {
    taramalar,
    cihazlar: Object.fromEntries(cihazlar.map((c) => [c.id, { etiket: `${c.brand} ${c.model}`, seri: c.serialNo, musteri: c.customer?.name ?? null }])),
  };
}

/**
 * Dikkat isteyen cihazlar: güncel ölçümde kendi uyarısı olan ya da toneri
 * bitmek üzere olan. Açık servis fişi varsa yanında gelir; ekran ikinci
 * bir fiş açtırmak yerine onu gösterir.
 */
export async function cihazDurumlari(tenantId: string, simdi = new Date()) {
  const taze = new Date(simdi.getTime() - DURUM_TAZE_MS);
  const [izlenen, cihazlar] = await Promise.all([
    prisma.device.count({ where: { tenantId, olcumAt: { gte: taze } } }),
    prisma.device.findMany({
      where: {
        tenantId,
        olcumAt: { gte: taze },
        OR: [
          { cihazUyarilari: { isEmpty: false } },
          { olcumSiyah: { lte: TONER_KRITIK } },
          { olcumRenkli: { lte: TONER_KRITIK } },
          { olcumParca: { lte: PARCA_KRITIK } },
        ],
      },
      select: {
        id: true, brand: true, model: true, serialNo: true, publicCode: true, location: true,
        olcumAt: true, olcumSiyah: true, olcumRenkli: true, cihazUyarilari: true, uyariAt: true,
        olcumParca: true, olcumSarf: true,
        customer: { select: { id: true, name: true } },
        serviceTickets: {
          where: { deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, ticketNumber: true },
        },
      },
      take: 500,
    }),
  ]);
  const liste = cihazlar.map((d) => ({
    id: d.id,
    etiket: `${d.brand} ${d.model}`,
    seri: d.serialNo,
    kod: d.publicCode,
    konum: d.location,
    musteri: d.customer ? { id: d.customer.id, ad: d.customer.name } : null,
    olcumAt: d.olcumAt,
    olcumSiyah: d.olcumSiyah,
    olcumRenkli: d.olcumRenkli,
    olcumParca: d.olcumParca,
    // Ekranda en düşük parçanın ADI da yazsın ("Drum %6").
    parcaAd: d.olcumParca !== null && Array.isArray(d.olcumSarf)
      ? ((d.olcumSarf as unknown as SarfKalemi[]).find((k) => k.tur === 'PARCA' && k.yuzde === d.olcumParca)?.ad ?? null)
      : null,
    uyarilar: d.cihazUyarilari as UyariKodu[],
    uyariAt: d.uyariAt,
    acikFis: d.serviceTickets[0] ?? null,
  }));
  liste.sort((a, b) => dikkatSirasi(a) - dikkatSirasi(b)
    || (a.uyariAt?.getTime() ?? Infinity) - (b.uyariAt?.getTime() ?? Infinity));
  return { izlenen, cihazlar: liste };
}

/**
 * Tarama gönderen bilgisayarlar ve son çalışmaları. Tarayıcı her gün
 * çalışacak şekilde kurulur; günlerce susan bilgisayar (kapatılmış, ağdan
 * çıkmış, görev silinmiş) sayaçların sessizce durması demektir — bayi bunu
 * fatura günü değil, ilk sessiz günde görmeli.
 */
export async function tarayanBilgisayarlar(tenantId: string, simdi = new Date()) {
  const taramalar = await prisma.sayacTaramasi.findMany({
    where: { tenantId, createdAt: { gte: new Date(simdi.getTime() - 90 * 86_400_000) } },
    orderBy: { createdAt: 'desc' },
    take: 3000,
    select: { bilgisayar: true, createdAt: true, bulunan: true, surum: true },
  });
  const hafta = simdi.getTime() - 7 * 86_400_000;
  type Grup = { bilgisayar: string | null; sonTarama: Date; sonBulunan: number; haftalik: number; surum: number | null };
  const gruplar = new Map<string, Grup>();
  for (const t of taramalar) {
    const anahtar = t.bilgisayar ?? '';
    const g = gruplar.get(anahtar);
    if (!g) gruplar.set(anahtar, { bilgisayar: t.bilgisayar, sonTarama: t.createdAt, sonBulunan: t.bulunan, haftalik: t.createdAt.getTime() >= hafta ? 1 : 0, surum: t.surum });
    else if (t.createdAt.getTime() >= hafta) g.haftalik++;
  }
  return [...gruplar.values()].map((g) => ({
    ...g,
    sessiz: simdi.getTime() - g.sonTarama.getTime() > SESSIZ_MS,
    // Sürümü bilinmeyen (ilk sürüm sürüm yollamıyordu sanılmasın: yolluyordu) ya da eski betik.
    eski: (g.surum ?? 0) < TARAYICI_SURUMU,
  }));
}

export async function tarayiciAyari(tenantId: string) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tarayiciAnahtarHash: true, tarayiciOtomatikYaz: true, tarayiciOtomatikFis: true },
  });
  return {
    anahtarVar: Boolean(t?.tarayiciAnahtarHash),
    otomatik: Boolean(t?.tarayiciOtomatikYaz),
    otomatikFis: Boolean(t?.tarayiciOtomatikFis),
  };
}

export async function otomatikFisAyarla(tenantId: string, deger: boolean): Promise<void> {
  await prisma.tenant.update({ where: { id: tenantId }, data: { tarayiciOtomatikFis: deger } });
}

/**
 * Cihazın uyarı geçmişi: son `gun` günde hangi uyarı kaç kez başladı, en son
 * ne zaman. "Bu makine ayda altı kez sıkışıyor" teşhisin yarısıdır.
 */
export async function uyariGecmisi(tenantId: string, deviceId: string, gun = 90, simdi = new Date()) {
  const olaylar = await prisma.cihazOlayi.findMany({
    where: { tenantId, deviceId, basladi: { gte: new Date(simdi.getTime() - gun * 86_400_000) } },
    orderBy: { basladi: 'desc' },
    take: 500,
    select: { kod: true, basladi: true, bitti: true, ticketId: true },
  });
  const ozet = new Map<string, { kod: string; adet: number; son: Date; acik: boolean }>();
  for (const o of olaylar) {
    const x = ozet.get(o.kod);
    if (!x) ozet.set(o.kod, { kod: o.kod, adet: 1, son: o.basladi, acik: o.bitti === null });
    else { x.adet++; if (o.bitti === null) x.acik = true; }
  }
  return {
    gun,
    ozet: [...ozet.values()].sort((a, b) => b.adet - a.adet || b.son.getTime() - a.son.getTime()),
    son: olaylar.slice(0, 10),
  };
}

/** Yeni anahtar üretir; eskisi o anda çalışmayı bırakır. Anahtar bir kez döner. */
export async function anahtarYenile(tenantId: string): Promise<string> {
  const { anahtar, ozet } = anahtarUret();
  await prisma.tenant.update({ where: { id: tenantId }, data: { tarayiciAnahtarHash: ozet } });
  return anahtar;
}

export async function otomatikAyarla(tenantId: string, deger: boolean): Promise<void> {
  await prisma.tenant.update({ where: { id: tenantId }, data: { tarayiciOtomatikYaz: deger } });
}
