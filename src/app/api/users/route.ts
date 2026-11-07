import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { oturumKullanicisi } from '@/lib/api-auth';
import { davetOlustur, kullanilamazSifre } from '@/lib/kullanici-davet';
import { writeAudit } from '@/lib/audit';

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
        // DAVET: yönetici şifre yazmaz; kişiye WhatsApp'tan tek kullanımlık
        // bağlantı gider, şifresini kendisi koyar (lib/kullanici-davet.ts).
        const davet = body.davet === true;
        // E-POSTA KÜÇÜK HARFLE saklanır. Giriş artık lower(email) ile arıyor;
        // "Ali@Firma.com" ile "ali@firma.com" aynı kişi. Olduğu gibi saklanınca
        // aynı bayide iki ayrı kullanıcı açılabiliyordu (benzersizlik birebir
        // karşılaştırıyordu) ve giriş hangisinin şifresini deneyeceğini
        // bilemiyordu.
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

        if (!name || !email || (!davet && !password)) {
            return ucHatasi('AD_E_POSTA_VE_SIFRE', 400);
        }
        if (!davet && password.length < 6) {
            return ucHatasi('SIFRE_EN_AZ_6_KARAKTER_2', 400);
        }

        // Yetki yükseltmeyi önle: bu uçtan yalnızca tenant-içi roller verilebilir (SUPER_ADMIN değil)
        const ALLOWED_ROLES = ['ADMIN', 'TECHNICIAN', 'FRONT_DESK'];
        const safeRole = (ALLOWED_ROLES.includes(role) ? role : 'TECHNICIAN') as UserRole;

        // Plan limiti (maxUsers) — katmanlı fiyatlandırma için zorunlu
        const [tenant, activeCount] = await Promise.all([
            prisma.tenant.findUnique({ where: { id: me.tenantId }, select: { maxUsers: true, name: true, demo: true } }),
            prisma.user.count({ where: { tenantId: me.tenantId, isActive: true } }),
        ]);
        // Demo bayisini herkes aynı anda geziyor: oradan kimseye davet gitmez.
        if (davet && tenant?.demo) return ucHatasi('DEMO_HESABINDA_KAPALI', 403);
        if (tenant && activeCount >= tenant.maxUsers) {
            return ucHatasi('PLAN_LIMITINIZ_KULLANICI_DOLDU_DAHA', 403, { deger: { p1: tenant.maxUsers } });
        }

        // E-posta benzersizliği bu tenant içinde (aynı e-posta başka bayide olabilir).
        // Büyük/küçük harf DUYARSIZ — eski kayıtlar karışık harfle saklanmış
        // olabilir. ILIKE (Prisma mode:'insensitive') DEĞİL lower()=: ILIKE'ta
        // "_" joker, "a_b@x.com" "axb@x.com"u da bulurdu.
        const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "tenantId" = ${me.tenantId} AND lower("email") = ${email} LIMIT 1`;
        if (existing.length) return ucHatasi('BU_E_POSTA_BU_ISLETMEDE', 400);

        // Davetli kişinin şifresi kimsenin bilmediği rastgele bir özet: bağlantıyı
        // açıp kendi şifresini koymadan bu hesaba kimse giremez.
        const hashedPassword = davet ? await kullanilamazSifre() : await bcrypt.hash(password, 12);

        const newUser = await prisma.user.create({
            data: {
                tenantId: me.tenantId,
                name,
                email,
                passwordHash: hashedPassword,
                role: safeRole,
                isActive: true,
                davetBekliyor: davet,
            },
        });

        if (!davet) return NextResponse.json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });

        const d = await davetOlustur({ tenantId: me.tenantId, userId: newUser.id, olusturanAd: me.name });
        await writeAudit({
            tenantId: me.tenantId,
            userId: me.id,
            action: 'DAVET_GONDERILDI',
            entityType: 'User',
            entityId: newUser.id,
            newValue: { ad: newUser.name, giris: newUser.email, rol: newUser.role, bitis: d.bitis.toISOString() },
        });
        return NextResponse.json({
            id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role,
            davet: { baglanti: d.baglanti, bitis: d.bitis.toISOString(), firma: tenant?.name ?? '' },
        });
    } catch (e: any) {
        console.error('USER CREATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
