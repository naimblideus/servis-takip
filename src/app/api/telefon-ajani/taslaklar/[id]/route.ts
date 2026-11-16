import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { fisNumarasiCakismasi } from '@/lib/ticket-number';
import { AjanHatasi, taslakAyrintisi, taslakOnayla, taslakReddet } from '@/lib/telefon-ajani-veri';

/**
 * GET  /api/telefon-ajani/taslaklar/[id] — "Fişe çevir" paneli: aday cihazlar,
 *      teknisyenler, teknisyen ÖNERİSİ (burada, istenince ve bir kez hesaplanır).
 * POST /api/telefon-ajani/taslaklar/[id] — { islem: 'onayla' | 'reddet' }
 *
 * Fişi açma kararı BAYİNİNDİR: ajanın taslağından fiş yalnız buradan, bir
 * kişinin tıkıyla açılır. Teknisyen onaylayamaz (ön büro ve yönetici).
 * İki kişi aynı anda onaylarsa tek fiş açılır (lib/telefon-ajani-veri).
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTenantUser();
    const { id } = await params;
    const a = await taslakAyrintisi(tenantId, id);
    if (!a) return ucHatasi('BULUNAMADI', 404);
    return NextResponse.json(a);
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, tenantId } = await requireTenantUser();
    if (user.role === 'TECHNICIAN') return ucHatasi('BASKI_YETKI_YOK', 403);
    const { id } = await params;
    const g = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      if (g.islem === 'onayla') {
        const r = await taslakOnayla(tenantId, id, user, {
          deviceId: g.deviceId,
          assignedUserId: g.assignedUserId,
          issueText: g.issueText,
          faultCategory: g.faultCategory,
          priority: g.priority,
        });
        return NextResponse.json({ ok: true, ...r });
      }
      if (g.islem === 'reddet') {
        await taslakReddet(tenantId, id, user, g.sebep);
        return NextResponse.json({ ok: true });
      }
      return ucHatasi('GECERSIZ_ISTEK', 400);
    } catch (e) {
      if (e instanceof AjanHatasi) return ucHatasi(e.kod, e.durum);
      if (fisNumarasiCakismasi(e)) return ucHatasi('ISLEM_CAKISMASI_TEKRAR_DENEYIN', 409);
      throw e;
    }
  } catch (e) {
    return authErrorResponse(e);
  }
}
