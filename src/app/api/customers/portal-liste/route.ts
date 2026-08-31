import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantUser, authErrorResponse } from '@/lib/api-auth';

/**
 * PORTAL DURUM LİSTESİ — kimde erişim var, kimde yok.
 *
 * Jeton DÖNÜYOR, çünkü ekranın işi bağlantıyı göndermek. Ama yalnız bu
 * kiracının kendi müşterileri için ve yalnız oturum açmış bayiye.
 *
 * Cihazı olmayan müşteri işaretleniyor: portalı açıp da gösterecek hiçbir
 * şeyi olmayan bir müşteriye bağlantı göndermek, "bu ne işe yarıyor"
 * sorusunu doğurur ve ilk izlenimi harcar.
 */
export async function GET() {
  try {
    const { tenantId } = await requireTenantUser();

    const musteriler = await prisma.customer.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        portalEnabled: true,
        portalToken: true,
        portalLastSeen: true,
        _count: { select: { devices: true } },
      },
      orderBy: [{ portalEnabled: 'asc' }, { name: 'asc' }],
      take: 1000,
    });

    return NextResponse.json({
      musteriler: musteriler.map((m) => ({
        id: m.id,
        ad: m.name,
        telefon: m.phone ?? '',
        acik: m.portalEnabled,
        jeton: m.portalEnabled ? m.portalToken : null,
        cihaz: m._count.devices,
        sonGirdi: m.portalLastSeen,
      })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
