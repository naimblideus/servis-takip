import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { bakimPlani, bakimYapildi } from '@/lib/bakim-veri';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** GET /api/bakim — periyodik bakım planı (gecikenler önde). */
export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();
    return NextResponse.json(await bakimPlani(tenantId));
  } catch (e: any) {
    return authErrorResponse(e);
  }
}

/**
 * POST /api/bakim
 *   { islem: 'yapildi', deviceId, tarih?, sayac? }  → bakım damgası
 *   { islem: 'politika', deviceId, sayfa?, ay? }    → cihaza özel eşik
 *   { islem: 'varsayilan', sayfa?, ay? }            → filo geneli eşik
 *
 * Eşik BOŞ bırakılabilir ve bu bilinçli: uydurulmuş bir eşik, bakımı yanlış
 * güne koymaktan daha kötüdür — ekran o cihazı "bilinmiyor" diye listede
 * tutar, yeşil göstermez.
 */
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireTenantUser();
    const b = await req.json().catch(() => ({}));
    const islem = String(b?.islem || '');

    /** Eşik: boş/null = "konuşulmamış". 0 ve eksi kabul edilmez. */
    const esik = (v: unknown): number | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return undefined; // geçersiz → hata
      return Math.round(n);
    };

    if (islem === 'yapildi') {
      const deviceId = String(b?.deviceId || '');
      if (!deviceId) return ucHatasi('CIHAZ_SECILMEDI', 400);
      const tarih = b?.tarih ? new Date(b.tarih) : new Date();
      if (!Number.isFinite(tarih.getTime())) return ucHatasi('TARIH_GECERSIZ', 400);
      // Gelecek tarihli bakım damgası, sonraki bütün hesabı kaydırır.
      if (tarih.getTime() > Date.now() + 86_400_000) return ucHatasi('TARIH_GECERSIZ', 400);
      const sonuc = await bakimYapildi(tenantId, deviceId, tarih, b?.sayac);
      if (!sonuc) return ucHatasi('CIHAZ_BULUNAMADI', 404);
      return NextResponse.json({ ok: true, ...sonuc });
    }

    if (islem === 'politika') {
      const deviceId = String(b?.deviceId || '');
      if (!deviceId) return ucHatasi('CIHAZ_SECILMEDI', 400);
      const sayfa = esik(b?.sayfa);
      const ay = esik(b?.ay);
      if (sayfa === undefined && b?.sayfa !== undefined) return ucHatasi('GECERSIZ_MIKTAR', 400);
      if (ay === undefined && b?.ay !== undefined) return ucHatasi('GECERSIZ_MIKTAR', 400);
      const cihaz = await prisma.device.findFirst({ where: { id: deviceId, tenantId }, select: { id: true } });
      if (!cihaz) return ucHatasi('CIHAZ_BULUNAMADI', 404);
      await prisma.device.update({
        where: { id: deviceId },
        data: {
          ...(sayfa !== undefined && { pmIntervalPages: sayfa }),
          ...(ay !== undefined && { pmIntervalMonths: ay }),
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (islem === 'varsayilan') {
      const sayfa = esik(b?.sayfa);
      const ay = esik(b?.ay);
      if (sayfa === undefined && b?.sayfa !== undefined) return ucHatasi('GECERSIZ_MIKTAR', 400);
      if (ay === undefined && b?.ay !== undefined) return ucHatasi('GECERSIZ_MIKTAR', 400);
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(sayfa !== undefined && { pmDefaultPages: sayfa }),
          ...(ay !== undefined && { pmDefaultMonths: ay }),
        },
      });
      return NextResponse.json({ ok: true });
    }

    return ucHatasi('BILINMEYEN_ISLEM', 400);
  } catch (e: any) {
    return authErrorResponse(e);
  }
}
