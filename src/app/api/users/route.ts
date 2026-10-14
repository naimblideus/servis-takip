import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { oturumKullanicisi } from '@/lib/api-auth';

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
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

    const me = await oturumKullanicisi(session);
    if (!me || me.role !== 'ADMIN') {
        return ucHatasi('SADECE_YONETICILER_KULLANICI_EKLEYEBILIR', 403);
    }

    try {
        const body = await req.json();
        const { name, password, role = 'TECHNICIAN' } = body;
        // E-POSTA KÜÇÜK HARFLE saklanır. Giriş artık lower(email) ile arıyor;
        // "Ali@Firma.com" ile "ali@firma.com" aynı kişi. Olduğu gibi saklanınca
        // aynı bayide iki ayrı kullanıcı açılabiliyordu (benzersizlik birebir
        // karşılaştırıyordu) ve giriş hangisinin şifresini deneyeceğini
        // bilemiyordu.
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

        if (!name || !email || !password) {
            return ucHatasi('AD_E_POSTA_VE_SIFRE', 400);
        }
        if (password.length < 6) {
            return ucHatasi('SIFRE_EN_AZ_6_KARAKTER_2', 400);
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
            return ucHatasi('PLAN_LIMITINIZ_KULLANICI_DOLDU_DAHA', 403, { deger: { p1: tenant.maxUsers } });
        }

        // E-posta benzersizliği bu tenant içinde (aynı e-posta başka bayide olabilir).
        // Büyük/küçük harf DUYARSIZ — eski kayıtlar karışık harfle saklanmış
        // olabilir. ILIKE (Prisma mode:'insensitive') DEĞİL lower()=: ILIKE'ta
        // "_" joker, "a_b@x.com" "axb@x.com"u da bulurdu.
        const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "tenantId" = ${me.tenantId} AND lower("email") = ${email} LIMIT 1`;
        if (existing.length) return ucHatasi('BU_E_POSTA_BU_ISLETMEDE', 400);

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
