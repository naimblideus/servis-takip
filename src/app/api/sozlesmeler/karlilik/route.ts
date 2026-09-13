import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse, requireAdminUser } from '@/lib/api-auth';
import { sozlesmeKarliliklari, VARSAYILAN_HEDEF_MARJ } from '@/lib/sozlesme-karlilik';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/sozlesmeler/karlilik?ay=12&hedef=0.25
 *
 * YALNIZ YÖNETİCİ. Alış fiyatı, marj ve zam önerisi bayinin kendi ticari
 * bilgisi; teknisyen ekranında görünmesi gereken bir şey değil.
 */
export async function GET(req: NextRequest) {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const q = req.nextUrl.searchParams;
    const ay = Number(q.get('ay')) || 12;
    const hedefHam = q.get('hedef');
    const hedef = hedefHam === null ? undefined : Number(hedefHam);

    const sonuc = await sozlesmeKarliliklari(tenantId, {
      ay,
      hedefMarj: hedef !== undefined && hedef >= 0 && hedef < 1 ? hedef : undefined,
    });
    return NextResponse.json(sonuc);
  } catch (e) {
    return authErrorResponse(e);
  }
}

/**
 * POST — ziyaret başı maliyet ve hedef marj ayarı.
 *
 * İkisi de BOŞ BIRAKILABİLİR. Ziyaret maliyeti boşsa işçilik hesaba
 * katılmıyor ve ekran bunu yazıyor; bir saat ücreti uydurmaktansa eksik
 * ama dürüst bir rakam göstermek daha iyi.
 */
export async function POST(req: NextRequest) {
  try { await requireAdminUser(); } catch (e) { return authErrorResponse(e); }
  try {
    const { tenantId } = await requireTenantUser();
    const govde = await req.json().catch(() => ({}));

    const data: Record<string, unknown> = {};
    if ('ziyaretMaliyeti' in govde) {
      const v = govde.ziyaretMaliyeti;
      if (v === '' || v === null) data.ziyaretMaliyeti = null;
      else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: 'Ziyaret maliyeti negatif olamaz' }, { status: 400 });
        }
        data.ziyaretMaliyeti = n;
      }
    }
    if ('hedefMarj' in govde) {
      const v = govde.hedefMarj;
      if (v === '' || v === null) data.hedefMarj = null;
      else {
        // Ekran YÜZDE gönderiyor (25), veritabanı ORAN tutuyor (0,25).
        const n = Number(v) / 100;
        if (!Number.isFinite(n) || n < 0 || n >= 1) {
          return NextResponse.json({ error: 'Hedef marj %0 ile %99 arasında olmalı' }, { status: 400 });
        }
        data.hedefMarj = n;
      }
    }
    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'Değişiklik yok' }, { status: 400 });
    }

    await prisma.tenant.update({ where: { id: tenantId }, data });
    return NextResponse.json({ ok: true, varsayilanHedef: VARSAYILAN_HEDEF_MARJ });
  } catch (e) {
    return authErrorResponse(e);
  }
}
