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
import {
  cihazSonucu, tekrarlariAyikla, taramaOzeti, ilerlemeDurumu,
  type CihazSonucu, type TaramaGovdesi, type TaramaOzeti,
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

  const ozet = taramaOzeti(sonuclar);
  const kayit = await prisma.sayacTaramasi.create({
    data: {
      tenantId,
      bilgisayar: govde.bilgisayar,
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
