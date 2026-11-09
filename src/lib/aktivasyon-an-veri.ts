/**
 * "O AN" verisi: her hesabın İLK 7 GÜNDE ne yaptığı (lib/aktivasyon-an.ts).
 *
 * "Hiç yaptı mı" değil "açılıştan sonraki 7 günde yaptı mı": deneme 14 gün
 * sürüyor ve satın alma kararı ilk haftada şekilleniyor. Her tablo için tek
 * sorgu, hesap başına sayı döner; ham kayıt sunucudan çıkmaz, ekran yalnız
 * yüzde gösterir. Salt okunur.
 *
 * Sayılmayanlar: demo ve silinmiş hesaplar; Excel aktarımının başlangıç
 * sayacı (kaynak GOC, bayi okutmadı); süper admin ve sistemin denetim kaydı
 * (giriş = bayinin kendi kullanıcısının hareketi).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PENCERE_GUN, type AnHesabi, type SayiKodu } from '@/lib/aktivasyon-an';
import { GOC_KAYNAGI } from '@/lib/kurulum';

const PENCERE = Prisma.raw(`interval '${PENCERE_GUN} days'`);

/** Hesap başına, açılıştan sonraki 7 gün içindeki kayıt sayısı. Tablo/kolon adları sabit listeden gelir. */
async function ilk7Say(tablo: string, kolon: string, ek: Prisma.Sql = Prisma.empty): Promise<Map<string, number>> {
  const satirlar = await prisma.$queryRaw<{ tenantId: string; n: bigint | number }[]>`
    SELECT x."tenantId" AS "tenantId", COUNT(*) AS n
    FROM ${Prisma.raw(`"${tablo}"`)} x
    JOIN "Tenant" t ON t."id" = x."tenantId"
    WHERE t."demo" = false AND t."deletedAt" IS NULL
      AND x.${Prisma.raw(`"${kolon}"`)} IS NOT NULL
      AND x.${Prisma.raw(`"${kolon}"`)} < t."createdAt" + ${PENCERE}
      ${ek}
    GROUP BY x."tenantId"`;
  return new Map(satirlar.map((s) => [s.tenantId, Number(s.n)]));
}

export async function anHesaplari(): Promise<AnHesabi[]> {
  const tenants = await prisma.tenant.findMany({
    where: { demo: false, deletedAt: null },
    select: { id: true, createdAt: true, trialEndsAt: true, plan: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });
  if (!tenants.length) return [];

  const [ilkGiris, hareket, musteri, cihaz, okuma, fis, kullanici, stok, fatura, tahsilat, odeme] = await Promise.all([
    // Giriş: ilk-giriş sihirbazını gördü ya da kendi kullanıcısı bir kayıt bıraktı.
    ilk7Say('User', 'onboardedAt'),
    ilk7Say('AuditLog', 'createdAt', Prisma.sql`AND (x."actorType" IS NULL OR x."actorType" NOT IN ('SUPER_ADMIN', 'SYSTEM'))`),
    ilk7Say('Customer', 'createdAt'),
    ilk7Say('Device', 'createdAt'),
    // Gerçek okuma: aktarımın başlangıç sayacı (GOC) ve cihaz eklenirken yazılan
    // zincir başı (ELLE, fark 0, kapalı, fişsiz; api/devices) sayılmaz.
    // lib/aktivasyon.ts'teki huni aynı kuralla sayar.
    ilk7Say(
      'CounterReading',
      'createdAt',
      Prisma.sql`AND x."source" <> ${GOC_KAYNAGI}
        AND NOT (x."source" = 'ELLE' AND x."billed" AND x."deltaBlack" = 0 AND x."deltaColor" = 0 AND x."ticketId" IS NULL)`,
    ),
    ilk7Say('ServiceTicket', 'createdAt'),
    ilk7Say('User', 'createdAt'),
    ilk7Say('Part', 'createdAt'),
    ilk7Say('CustomerInvoice', 'createdAt', Prisma.sql`AND x."status"::text <> 'DRAFT'`),
    ilk7Say('Payment', 'createdAt'),
    prisma.tenantInvoice.groupBy({ by: ['tenantId'], where: { status: 'paid' }, _count: { _all: true } }),
  ]);
  const odedi = new Set(odeme.map((o) => o.tenantId));

  return tenants.map((t) => {
    const ilk7: Partial<Record<SayiKodu, number>> = {
      giris: (ilkGiris.get(t.id) ?? 0) + (hareket.get(t.id) ?? 0),
      musteri: musteri.get(t.id) ?? 0,
      cihaz: cihaz.get(t.id) ?? 0,
      okuma: okuma.get(t.id) ?? 0,
      fis: fis.get(t.id) ?? 0,
      kullanici: kullanici.get(t.id) ?? 0,
      stok: stok.get(t.id) ?? 0,
      fatura: fatura.get(t.id) ?? 0,
      tahsilat: tahsilat.get(t.id) ?? 0,
    };
    return { acilis: t.createdAt, denemeBitis: t.trialEndsAt, plan: t.plan, odedi: odedi.has(t.id), ilk7 };
  });
}
