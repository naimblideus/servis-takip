import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSuperAdminSession } from '@/lib/super-admin-auth';
import { verifyAuditChain } from '@/lib/audit';

/**
 * GET /api/super-admin/audit — denetim kaydı görüntüleme + zincir doğrulama.
 *
 * Kurumsal denetimde iki soru sorulur:
 *  1. "Kim ne zaman ne değiştirdi?"  → liste
 *  2. "Bu kayıtlar sonradan değiştirilmiş olabilir mi?" → zincir doğrulaması
 * İkincisi olmadan birincisinin ispat değeri yoktur.
 */
export async function GET(req: NextRequest) {
  const sa = await getSuperAdminSession();
  if (!sa) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const tenantId = sp.get('tenantId') || undefined;
  const dogrula = sp.get('dogrula') === '1';

  const kayitlar = await prisma.auditLog.findMany({
    where: tenantId ? { tenantId } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      tenant: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  });

  // Zincir doğrulama kiracı bazlıdır (zincir de öyle kuruluyor).
  const zincir = dogrula && tenantId ? await verifyAuditChain(tenantId) : null;

  return NextResponse.json({
    zincir,
    items: kayitlar.map((k) => ({
      id: k.id,
      tarih: k.createdAt.toISOString(),
      bayi: k.tenant?.name ?? '—',
      islem: k.action,
      varlik: `${k.entityType}:${k.entityId}`,
      kim: k.actorName || k.user?.name || k.user?.email || '—',
      kimTipi: k.actorType || 'USER',
      ip: k.ipAddress,
      oncesi: k.oldValue,
      sonrasi: k.newValue,
    })),
  });
}
