import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';
import { yeniPortalJetonu } from '@/lib/portal';
import { writeAudit, istekIp } from '@/lib/audit';

/**
 * Müşteri portalını yönet: aç / kapat / bağlantıyı yenile.
 *
 * GET  → mevcut durum ve bağlantı
 * POST → { islem: 'ac' | 'kapat' | 'yenile' }
 *
 * "Yenile" eski bağlantıyı ANINDA geçersiz kılar — bağlantı yanlış kişiye
 * gittiyse tek çare budur, o yüzden tek tıkla erişilebilir olmalı.
 */

async function musteriBul(id: string, tenantId: string) {
  return prisma.customer.findFirst({
    where: { id, tenantId },
    select: { id: true, name: true, phone: true, portalToken: true, portalEnabled: true, portalTokenAt: true, portalLastSeen: true },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTenantUser();
    const { id } = await params;
    const m = await musteriBul(id, tenantId);
    if (!m) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });
    return NextResponse.json({
      acik: m.portalEnabled,
      yol: m.portalEnabled && m.portalToken ? `/m/${m.portalToken}` : null,
      uretim: m.portalTokenAt,
      sonGoruntuleme: m.portalLastSeen,
      telefon: m.phone,
      musteriAdi: m.name,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, user } = await requireTenantUser();
    const { id } = await params;
    const m = await musteriBul(id, tenantId);
    if (!m) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });

    const { islem } = (await req.json().catch(() => ({}))) as { islem?: string };

    let data: Record<string, unknown>;
    let eylem: string;
    if (islem === 'kapat') {
      // Jetonu da siliyoruz: kapatıp açınca ESKİ bağlantı çalışmasın.
      data = { portalEnabled: false, portalToken: null, portalTokenAt: null };
      eylem = 'MUSTERI_PORTALI_KAPATILDI';
    } else if (islem === 'ac' || islem === 'yenile') {
      data = { portalEnabled: true, portalToken: yeniPortalJetonu(), portalTokenAt: new Date() };
      eylem = islem === 'ac' ? 'MUSTERI_PORTALI_ACILDI' : 'MUSTERI_PORTALI_YENILENDI';
    } else {
      return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 });
    }

    const g = await prisma.customer.update({ where: { id }, data, select: { portalToken: true, portalEnabled: true } });

    // DENETİM: portalı açmak, müşterinin verisini bir bağlantının arkasında
    // yayınlamaktır. "Kim ne zaman açtı/yeniledi" sorulur.
    await writeAudit({
      tenantId, userId: user.id,
      action: eylem,
      entityType: 'Customer',
      entityId: id,
      newValue: { musteri: m.name, acik: g.portalEnabled },
      ipAddress: istekIp(req),
      actorType: 'USER',
      actorName: user.name ?? user.email,
    });

    return NextResponse.json({
      acik: g.portalEnabled,
      yol: g.portalEnabled && g.portalToken ? `/m/${g.portalToken}` : null,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
