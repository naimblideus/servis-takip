import { NextRequest, NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { prisma } from '@/lib/prisma';
import { kurulumListesi } from '@/lib/kurulum-veri';

/**
 * Bayi panelinden gelenlerin platform özeti: Mağaza, Kurulum ve Başarı,
 * Sorun bildir, üretici paylaşımı ve CRM aktarımı. Her parça kendi başına
 * düşebilir (mağaza şeması yoksa null) — panonun geri kalanını bekletmez.
 */
async function baglantiOzeti(otuzGunOnce: Date) {
    const kapsam = { deletedAt: null, demo: false };
    const acik = { in: ['YENI', 'INCELENIYOR'] };
    const [magaza, magazaTalebi, paylasim, adli, acikSorun, durduran, crmHata, kurulum] = await Promise.all([
        prisma.$queryRaw<{ kurulu: number; yayinda: number }[]>`
            SELECT count(*)::int kurulu, count(*) FILTER (WHERE aktif)::int yayinda
            FROM shop."ShopSettings" WHERE "servisTenantId" IS NOT NULL
        `.then((r) => r[0] ?? null).catch(() => null),
        prisma.lead.count({ where: { kaynak: 'magaza', createdAt: { gte: otuzGunOnce } } }),
        prisma.tenant.count({ where: { ...kapsam, oemDataSharing: true } }),
        prisma.tenant.count({ where: { ...kapsam, markaAdIzni: true } }),
        prisma.sorunBildirimi.count({ where: { demo: false, durum: acik } }),
        prisma.sorunBildirimi.count({ where: { demo: false, tur: 'DURDURUYOR', durum: acik } }),
        prisma.lead.count({ where: { crmDurum: 'hata' } }),
        kurulumListesi().catch(() => null),
    ]);
    return {
        magaza,
        magazaTalebi,
        paylasim,
        adli,
        acikSorun,
        durduran,
        crm: { bagli: !!(process.env.NEXUS_CRM_URL || process.env.NEXUS_CRM_OLAY), hata: crmHata },
        kurulum: kurulum
            ? { toplam: kurulum.length, hazir: kurulum.filter((k) => k.kurulum.hazir).length, bugun: kurulum.filter((k) => k.bugunAranacak).length }
            : null,
    };
}

export async function GET(req: NextRequest) {
    try {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

        const [
            totalTenants,
            activeTenants,
            trialTenants,
            suspendedTenants,
            newThisMonth,
            expiringSoon,
            overdueInvoices,
            monthlyRevenue,
            planCounts,
            baglanti,
        ] = await Promise.all([
            prisma.tenant.count({ where: { deletedAt: null } }),
            prisma.tenant.count({ where: { deletedAt: null, isActive: true, isSuspended: false } }),
            prisma.tenant.count({ where: { deletedAt: null, plan: 'trial' } }),
            prisma.tenant.count({ where: { deletedAt: null, isSuspended: true } }),
            prisma.tenant.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
            prisma.tenant.count({
                where: {
                    deletedAt: null,
                    isActive: true,
                    OR: [
                        { trialEndsAt: { gte: now, lte: sevenDaysLater } },
                        { planEndDate: { gte: now, lte: sevenDaysLater } },
                    ],
                },
            }),
            (prisma as any).tenantInvoice.count({ where: { status: 'overdue' } }),
            (prisma as any).tenantInvoice.aggregate({
                where: { status: 'paid', createdAt: { gte: firstOfMonth } },
                _sum: { totalAmount: true },
            }),
            prisma.tenant.groupBy({
                by: ['plan'],
                where: { deletedAt: null, isActive: true },
                _count: { plan: true },
            }),
            baglantiOzeti(thirtyDaysAgo),
        ]);

        const recentTenants = await prisma.tenant.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: { id: true, name: true, plan: true, isActive: true, isSuspended: true, createdAt: true, ownerName: true, city: true },
        });

        return NextResponse.json({
            totalTenants,
            activeTenants,
            trialTenants,
            suspendedTenants,
            newThisMonth,
            expiringSoon,
            overdueInvoices,
            monthlyRevenue: monthlyRevenue._sum?.totalAmount || 0,
            planCounts: Object.fromEntries(planCounts.map(p => [p.plan, p._count.plan])),
            recentTenants,
            baglanti,
        });
    } catch (error: any) {
        console.error('SA dashboard error:', error);
        return ucHatasi('SUNUCU_HATASI', 500);
    }
}
