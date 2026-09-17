import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { writeAudit, istekIp } from '@/lib/audit';
import { ayarPlani, AYAR_ALANLARI, type AyarAlani, type AyarCihazi } from '@/lib/toplu-ayar';

export const dynamic = 'force-dynamic';

/**
 * POST /api/devices/bulk-settings
 *   { degerler: {includedBlack?, includedColor?, pmIntervalPages?, pmIntervalMonths?},
 *     musteriId?, model?, yalnizBos?, yalnizKiralik?, dryRun? }
 *
 * Toplu DEĞER YAZMA (Toplu Zam'dan farklı: orada yüzdeyle artırılır,
 * burada değer olduğu gibi yazılır).
 *
 * dryRun=true → yalnız ÖNİZLEME; hiçbir şey yazılmaz. Ekran önce kaç
 * cihazın değişeceğini, kaçının dolu olduğu için atlandığını ve —
 * ezme açıksa — kaç cihazın ÜZERİNE yazılacağını gösterir.
 *
 * YÖNETİCİ şart: tek istekle yüzlerce cihazın sözleşme değeri değişir.
 */
export async function POST(req: NextRequest) {
  try {
    const { tenantId, user } = await requireAdminUser();
    const b = await req.json().catch(() => ({}));

    const degerler: Partial<Record<AyarAlani, number>> = {};
    for (const alan of AYAR_ALANLARI) {
      const ham = b?.degerler?.[alan];
      if (ham === undefined || ham === null || ham === '') continue;
      const n = Number(ham);
      // Eksi değer yok; sıfır GEÇERLİ ve "paket/eşik yok" demek.
      if (!Number.isFinite(n) || n < 0) return ucHatasi('GECERSIZ_MIKTAR', 400);
      degerler[alan] = Math.round(n);
    }
    if (!Object.keys(degerler).length) return ucHatasi('EN_AZ_BIR_ALAN', 400);

    const musteriId = typeof b?.musteriId === 'string' && b.musteriId ? b.musteriId : null;
    const model = typeof b?.model === 'string' && b.model.trim() ? b.model.trim() : null;
    const yalnizBos = b?.yalnizBos !== false;      // varsayılan: dolu alanı EZME
    const yalnizKiralik = b?.yalnizKiralik !== false;

    const cihazlar = await prisma.device.findMany({
      where: {
        tenantId,
        ...(musteriId ? { customerId: musteriId } : {}),
        ...(model ? { model } : {}),
      },
      select: {
        id: true, brand: true, model: true, serialNo: true, isRental: true,
        includedBlack: true, includedColor: true,
        pmIntervalPages: true, pmIntervalMonths: true,
        customer: { select: { name: true } },
      },
      take: 5000,
    });

    const girdi: AyarCihazi[] = cihazlar.map((c) => ({
      id: c.id,
      etiket: `${c.brand} ${c.model} · ${c.serialNo}`,
      musteri: c.customer?.name ?? '—',
      kiralik: c.isRental,
      includedBlack: c.includedBlack,
      includedColor: c.includedColor,
      pmIntervalPages: c.pmIntervalPages,
      pmIntervalMonths: c.pmIntervalMonths,
    }));

    const plan = ayarPlani(girdi, { degerler, yalnizBos, yalnizKiralik });
    if (b?.dryRun) return NextResponse.json({ ...plan, uygulandi: false });
    if (!plan.satirlar.length) return ucHatasi('GUNCELLENECEK_CIHAZ_YOK', 400);

    // Tek transaction: yarım kalmış bir ayar listesi, hiç yapılmamışdan kötüdür.
    await prisma.$transaction(
      plan.satirlar.map((s) =>
        prisma.device.updateMany({
          where: { id: s.id, tenantId },
          data: Object.fromEntries(
            Object.entries(s.degisim).map(([alan, d]) => [alan, d!.yeni]),
          ) as never,
        }),
      ),
    );

    // DENETİM: sözleşme değerlerini tek istekle değiştiren işlem.
    // Satır satır liste bilerek yok (denetim kaydı kırpılıp anlamsızlaşmasın).
    await writeAudit({
      tenantId,
      userId: user.id,
      action: 'CIHAZ_AYARI_TOPLU_GUNCELLENDI',
      entityType: 'Device',
      entityId: `toplu:${plan.satirlar.length}`,
      newValue: {
        cihazSayisi: plan.satirlar.length,
        degerler, yalnizBos, yalnizKiralik,
        musteriId, model,
        ezilen: plan.ezilecek,
      },
      ipAddress: istekIp(req),
      actorType: 'USER',
      actorName: user.name ?? user.email,
    });

    return NextResponse.json({ ...plan, uygulandi: true, guncellenen: plan.satirlar.length });
  } catch (e) {
    return authErrorResponse(e);
  }
}

/** GET /api/devices/bulk-settings?musteri=<id> — süzgeç için model listesi. */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireAdminUser();
    const musteriId = new URL(req.url).searchParams.get('musteri');
    const modeller = await prisma.device.findMany({
      where: { tenantId, ...(musteriId ? { customerId: musteriId } : {}) },
      select: { brand: true, model: true },
      distinct: ['model'],
      orderBy: { model: 'asc' },
      take: 500,
    });
    return NextResponse.json({ modeller: modeller.map((m) => ({ marka: m.brand, model: m.model })) });
  } catch (e) {
    return authErrorResponse(e);
  }
}
