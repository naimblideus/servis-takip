import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMatbaaUser } from '@/lib/matbaa-kapi';
import { baskiHatasi, matbaaYaniti } from '@/lib/matbaa-uc';
import { gunAraligi } from '@/lib/baski-is';
import { kapanisGecerli, kasaToplamlari } from '@/lib/baski-rapor';

export const dynamic = 'force-dynamic';

/**
 * POST /api/matbaa/kasa/kapanis { gun, sayilan, not? } — gün sonu.
 * Sistemdeki tutarlar SUNUCUDA, o günün ödemelerinden hesaplanır; istekten
 * yalnız sayılan nakit okunur. Gün bir kez kapatılır; yeniden saymak sahibin
 * işidir (tezgah kendi açığını sonradan düzeltemesin).
 */
export async function POST(req: Request) {
  try {
    const { user, tenantId } = await requireMatbaaUser(['ADMIN', 'FRONT_DESK']);
    const g = ((await req.json().catch(() => null)) ?? {}) as { gun?: unknown; sayilan?: unknown; not?: unknown };
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { workTimezone: true } });
    const tz = tenant?.workTimezone || 'Europe/Istanbul';
    const bugun = gunAraligi(tz, new Date()).gun;
    const istenen = typeof g.gun === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.gun) ? g.gun : bugun;
    const { bas, bit } = gunAraligi(tz, new Date(), istenen);
    const t = kasaToplamlari(await prisma.baskiOdeme.findMany({ where: { tenantId, tarih: { gte: bas, lte: bit } }, select: { yol: true, tutar: true } }));
    const v = kapanisGecerli({ gun: istenen, sayilan: g.sayilan }, bugun, t.nakit);
    if (!v.ok) return baskiHatasi(v.kod);

    const yonetici = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    const mevcut = await prisma.baskiKasaKapanis.findUnique({ where: { tenantId_gun: { tenantId, gun: v.gun } }, select: { id: true } });
    if (mevcut && !yonetici) return baskiHatasi('KAPANIS_VAR');
    const veri = {
      nakit: t.nakit, kart: t.kart, havale: t.havale, sayilan: v.sayilan, fark: v.fark,
      not: typeof g.not === 'string' && g.not.trim() ? g.not.trim().slice(0, 300) : null,
      kapatanId: user.id, kapatanAd: user.name ?? null,
    };
    await prisma.baskiKasaKapanis.upsert({ where: { tenantId_gun: { tenantId, gun: v.gun } }, create: { tenantId, gun: v.gun, ...veri }, update: { ...veri, createdAt: new Date() } });
    return NextResponse.json({ ok: true, fark: v.fark });
  } catch (e) {
    return matbaaYaniti(e);
  }
}
