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
import { prisma } from '@/lib/prisma';
import { createReading, ReadingError } from '@/lib/readings';
import { degisimKaydet } from '@/lib/verim-ogrenme';
import {
  cihazSonucu, tekrarlariAyikla, taramaOzeti, ilerlemeDurumu, tonerDegistiMi,
  dikkatSirasi, TONER_KRITIK, DURUM_TAZE_MS, SESSIZ_MS, TARAYICI_SURUMU,
  type CihazSonucu, type TaramaGovdesi, type TaramaOzeti, type UyariKodu,
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
  const onceki = new Map(
    (await prisma.device.findMany({
      where: { tenantId, id: { in: tekil.map((s) => s.deviceId as string) } },
      select: { id: true, olcumAt: true, olcumSiyah: true, cihazUyarilari: true, uyariAt: true, counterBlack: true },
    })).map((d) => [d.id, d]),
  );
  const simdi = new Date();
  const degisen = new Set<CihazSonucu>();
  for (const s of tekil) {
    const d = onceki.get(s.deviceId as string);
    if (!d) continue;
    const uyarilar = s.uyarilar ?? [];
    const olcum = s.olcum ?? { siyah: null, renkli: null };
    await prisma.device.update({
      where: { id: d.id },
      data: {
        olcumAt: simdi,
        olcumSiyah: olcum.siyah,
        olcumRenkli: olcum.renkli,
        cihazUyarilari: uyarilar,
        // Uyarı sürüyorsa ilk görüldüğü an korunur ("3 gündür sıkışık").
        uyariAt: uyarilar.length ? (d.cihazUyarilari.length && d.uyariAt ? d.uyariAt : simdi) : null,
      },
    });
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
    degisen.add(s);
  }
  return degisen.size ? sonuclar.map((s) => (degisen.has(s) ? { ...s, tonerDegisti: true } : s)) : sonuclar;
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
        ],
      },
      select: {
        id: true, brand: true, model: true, serialNo: true, publicCode: true, location: true,
        olcumAt: true, olcumSiyah: true, olcumRenkli: true, cihazUyarilari: true, uyariAt: true,
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
    select: { tarayiciAnahtarHash: true, tarayiciOtomatikYaz: true },
  });
  return { anahtarVar: Boolean(t?.tarayiciAnahtarHash), otomatik: Boolean(t?.tarayiciOtomatikYaz) };
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
