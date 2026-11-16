import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { writeAudit, istekIp } from '@/lib/audit';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { ajanAyarDurumu, ajaniSagla, hatAyarla, taslakSayaci } from '@/lib/telefon-ajani-veri';

/**
 * GET  — bayinin telefon ajanı: hat, aktarma, kurulum durumu, sayaç.
 * POST — { hatNumarasi?, aktarmaTelefonu?, kur?: true }
 *
 * HATTI YALNIZ PLATFORM EKİBİ ATAR. Retell hesabı ortak: bayi yöneticisi
 * numara girebilseydi hesaptaki başka bir hattı (başka bayinin ya da başka
 * ürünün) kendi ajanına bağlayabilirdi. Yetki middleware'de (süper admin oturumu).
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [durum, sayac] = await Promise.all([ajanAyarDurumu(id), taslakSayaci(id)]);
  return NextResponse.json({ ...durum, sayac });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await hatAyarla(id, { hatNumarasi: g.hatNumarasi, aktarmaTelefonu: g.aktarmaTelefonu });
  if (!r.ok) {
    return ucHatasi(r.kod, r.kod === 'BAYI_BULUNAMADI' ? 404 : r.kod === 'HAT_BASKA_BAYIDE' ? 409 : 400);
  }
  const sa = await getSuperAdminSession();
  const kim = { actorType: 'SUPER_ADMIN' as const, actorName: sa?.email ?? 'super-admin' };
  if (g.hatNumarasi !== undefined || g.aktarmaTelefonu !== undefined) {
    await writeAudit({
      tenantId: id,
      action: 'TELEFON_AJANI_HAT',
      entityType: 'TelefonAjani',
      entityId: id,
      newValue: {
        hat: g.hatNumarasi !== undefined ? Boolean(g.hatNumarasi) : undefined,
        aktarma: g.aktarmaTelefonu !== undefined ? Boolean(g.aktarmaTelefonu) : undefined,
      },
      ipAddress: istekIp(req),
      ...kim,
    });
  }
  const kurulum = g.kur === true ? await ajaniSagla(id, kim, { hatBagla: true, yeniOlustur: true }) : null;
  const [durum, sayac] = await Promise.all([ajanAyarDurumu(id), taslakSayaci(id)]);
  return NextResponse.json({ ok: true, uyarilar: r.uyarilar, kurulum, ...durum, sayac });
}
