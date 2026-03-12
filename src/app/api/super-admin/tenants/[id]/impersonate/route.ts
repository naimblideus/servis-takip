import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SignJWT } from 'jose';

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret');

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: { users: { where: { role: 'ADMIN', isActive: true }, take: 1 } },
    });
    if (!tenant) return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 });

    const adminUser = tenant.users[0];
    if (!adminUser) return NextResponse.json({ error: 'Admin kullanıcı bulunamadı' }, { status: 404 });

    const impersonateToken = await new SignJWT({
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        tenantId: adminUser.tenantId,
        tenantName: tenant.name,
        impersonatedBy: 'super-admin',
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('4h')
        .sign(SECRET);

    return NextResponse.json({
        success: true,
        token: impersonateToken,
        user: { email: adminUser.email, name: adminUser.name },
        tenant: { id: tenant.id, name: tenant.name },
    });
}
