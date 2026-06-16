import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const users = await prisma.user.findMany({
        where: { tenantId: user.tenantId, isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const me = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!me || me.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Sadece yöneticiler kullanıcı ekleyebilir' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { name, email, password, role = 'TECHNICIAN' } = body;

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Ad, e-posta ve şifre zorunlu' }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: 'Şifre en az 6 karakter olmalı' }, { status: 400 });
        }

        // Yetki yükseltmeyi önle: bu uçtan yalnızca tenant-içi roller verilebilir (SUPER_ADMIN değil)
        const ALLOWED_ROLES = ['ADMIN', 'TECHNICIAN', 'FRONT_DESK'];
        const safeRole = (ALLOWED_ROLES.includes(role) ? role : 'TECHNICIAN') as UserRole;

        // Plan limiti (maxUsers) — katmanlı fiyatlandırma için zorunlu
        const [tenant, activeCount] = await Promise.all([
            prisma.tenant.findUnique({ where: { id: me.tenantId }, select: { maxUsers: true } }),
            prisma.user.count({ where: { tenantId: me.tenantId, isActive: true } }),
        ]);
        if (tenant && activeCount >= tenant.maxUsers) {
            return NextResponse.json({ error: `Plan limitiniz ${tenant.maxUsers} kullanıcı doldu. Daha fazla kullanıcı için planınızı yükseltin.` }, { status: 403 });
        }

        // E-posta benzersizliği bu tenant içinde (aynı e-posta başka bayide olabilir)
        const existing = await prisma.user.findFirst({ where: { email, tenantId: me.tenantId } });
        if (existing) return NextResponse.json({ error: 'Bu e-posta bu işletmede zaten kayıtlı' }, { status: 400 });

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = await prisma.user.create({
            data: {
                tenantId: me.tenantId,
                name,
                email,
                passwordHash: hashedPassword,
                role: safeRole,
                isActive: true,
            },
        });

        return NextResponse.json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });
    } catch (e: any) {
        console.error('USER CREATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
