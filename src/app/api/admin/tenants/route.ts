import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Süper Admin kontrolü
async function getSuperAdmin() {
    const session = await auth();
    if (!session) return null;
    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user || (user.role as string) !== 'SUPER_ADMIN') return null;
    return user;
}

// GET /api/admin/tenants — Tüm tenant'ları listele
export async function GET() {
    const admin = await getSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 });

    const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: {
                    users: true,
                    customers: true,
                    devices: true,
                    serviceTickets: true,
                },
            },
        },
    });

    // Her tenant'ın son 30 gün fiş sayısı ve toplam ciro
    const tenantsWithStats = await Promise.all(
        tenants.map(async (t) => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const [recentTickets, revenue] = await Promise.all([
                prisma.serviceTicket.count({
                    where: { tenantId: t.id, createdAt: { gte: thirtyDaysAgo } },
                }),
                prisma.financialTransaction.aggregate({
                    where: { tenantId: t.id, type: 'INCOME' },
                    _sum: { amount: true },
                }),
            ]);

            return {
                ...t,
                recentTickets,
                totalRevenue: Number(revenue._sum.amount || 0),
            };
        })
    );

    return NextResponse.json(tenantsWithStats);
}

// POST /api/admin/tenants — Yeni tenant + admin kullanıcı oluştur
export async function POST(req: NextRequest) {
    const admin = await getSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 });

    try {
        const body = await req.json();
        const { tenantName, phone, address, adminName, adminEmail, adminPassword, plan } = body;

        if (!tenantName || !adminName || !adminEmail || !adminPassword) {
            return NextResponse.json({ error: 'Firma adı, admin adı, e-posta ve şifre zorunlu' }, { status: 400 });
        }

        // E-posta benzersizlik kontrolü (tüm tenant'larda)
        const existingUser = await prisma.user.findFirst({ where: { email: adminEmail } });
        if (existingUser) {
            return NextResponse.json({ error: 'Bu e-posta adresi zaten kayıtlı' }, { status: 409 });
        }

        const passwordHash = await bcrypt.hash(adminPassword, 10);

        // Transaction: Tenant + Admin kullanıcı birlikte oluştur
        const result = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                    name: tenantName,
                    phone: phone || null,
                    address: address || null,
                    plan: plan || 'starter',
                },
            });

            const user = await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    email: adminEmail,
                    passwordHash,
                    name: adminName,
                    role: 'ADMIN',
                },
            });

            return { tenant, user };
        });

        return NextResponse.json({
            success: true,
            tenant: result.tenant,
            admin: { id: result.user.id, email: result.user.email, name: result.user.name },
        });
    } catch (e: any) {
        console.error('TENANT CREATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PATCH /api/admin/tenants — Tenant güncelle (aktif/pasif, plan değiştirme)
export async function PATCH(req: NextRequest) {
    const admin = await getSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 });

    try {
        const body = await req.json();
        const { tenantId, name, phone, address, plan, isActive } = body;

        if (!tenantId) return NextResponse.json({ error: 'tenantId zorunlu' }, { status: 400 });

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (address !== undefined) updateData.address = address;
        if (plan !== undefined) updateData.plan = plan;
        if (isActive !== undefined) updateData.isActive = isActive;

        const tenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: updateData,
        });

        return NextResponse.json({ success: true, tenant });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE /api/admin/tenants — Tenant sil (dikkatli!)
export async function DELETE(req: NextRequest) {
    const admin = await getSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 });

    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId');
        if (!tenantId) return NextResponse.json({ error: 'tenantId zorunlu' }, { status: 400 });

        // Süper admin'in kendi tenant'ını silemezsin
        if (tenantId === admin.tenantId) {
            return NextResponse.json({ error: 'Kendi tenant\'ınızı silemezsiniz' }, { status: 400 });
        }

        await prisma.tenant.delete({ where: { id: tenantId } });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
