import { NextResponse } from 'next/server';
import { ucHatasi } from '@/lib/uc-hata';
import { demoBayiMi } from '@/lib/demo-koruma';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { writeAudit, istekIp } from '@/lib/audit';
import { oturumKullanicisi } from '@/lib/api-auth';

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const me = await oturumKullanicisi(session);
    if (!me || me.role !== 'ADMIN') return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });

    // IDOR koruması: hedef kullanıcı aynı tenant'ta olmalı
    const target = await prisma.user.findFirst({ where: { id, tenantId: me.tenantId } });
    if (!target) return ucHatasi('BULUNAMADI', 404);

    try {
        const body = await req.json();
        const email = body.email ? String(body.email).trim().toLowerCase() : '';
        // Kullanıcılar ekranı e-postayı HER kayıtta gönderiyor; yalnız gerçekten
        // değişiyorsa "giriş bilgisi değişikliği" sayılır (ad düzeltmek demoda
        // da serbest kalsın).
        const emailDegisiyor = !!email && email !== String(target.email).trim().toLowerCase();
        // Demoda giriş bilgisi ve kullanıcı kapatma değişmez (lib/demo-koruma.ts).
        if ((body.password || emailDegisiyor || body.isActive === false) && await demoBayiMi(me.tenantId)) {
            return ucHatasi('DEMO_HESABINDA_KAPALI', 403);
        }
        const updateData: any = {};
        if (body.name) updateData.name = body.name;
        if (email) {
            // Küçük harfle sakla + bayi içinde büyük/küçük harf duyarsız
            // benzersizlik (bkz. api/users POST). Kendisi hariç; ILIKE değil
            // lower()= — "_" ILIKE'ta joker.
            const cakisan = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "tenantId" = ${me.tenantId} AND lower("email") = ${email} AND "id" <> ${id} LIMIT 1`;
            if (cakisan.length) return ucHatasi('BU_E_POSTA_BU_ISLETMEDE', 400);
            updateData.email = email;
        }
        // Yetki yükseltme kapısı: bu uçtan yalnız bayi-içi roller verilebilir.
        // Eskiden gövdedeki rol olduğu gibi yazılıyordu; bayi yöneticisi kendi
        // ekibinden birini SUPER_ADMIN yapıp bütün bayileri yönetebilirdi.
        // POST (kullanıcı ekleme) zaten aynı listeyle sınırlıydı.
        if (body.role && body.role !== target.role) {
            if (!['ADMIN', 'TECHNICIAN', 'FRONT_DESK'].includes(body.role)) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
            updateData.role = body.role;
        }
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.password) {
            if (body.password.length < 6) return ucHatasi('SIFRE_EN_AZ_6_KARAKTER', 400);
            updateData.passwordHash = await bcrypt.hash(body.password, 12);
        }

        const user = await prisma.user.update({ where: { id }, data: updateData });

        // DENETİM: yetki değişikliği. "Bu kişiye yönetici yetkisini kim verdi" sorusu
        // kurumsal denetimin ilk sorularından. Şifre ASLA kayda girmez — yalnız değişti bilgisi.
        await writeAudit({
            tenantId: me.tenantId,
            userId: me.id,
            action: 'KULLANICI_GUNCELLENDI',
            entityType: 'User',
            entityId: id,
            oldValue: { name: target.name, email: target.email, role: target.role, isActive: target.isActive },
            newValue: {
                name: user.name, email: user.email, role: user.role, isActive: user.isActive,
                sifreDegisti: Boolean(body.password),
            },
            ipAddress: istekIp(req),
            actorType: 'USER',
            actorName: me.name ?? me.email,
        });

        return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const me = await oturumKullanicisi(session);
    if (!me || me.role !== 'ADMIN') return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    if (me.id === id) return NextResponse.json({ error: 'Kendinizi silemezsiniz' }, { status: 400 });

    // IDOR koruması: hedef kullanıcı aynı tenant'ta olmalı
    const target = await prisma.user.findFirst({ where: { id, tenantId: me.tenantId } });
    if (!target) return ucHatasi('BULUNAMADI', 404);

    if (await demoBayiMi(me.tenantId)) return ucHatasi('DEMO_HESABINDA_KAPALI', 403);

    try {
        // Önce kullanıcıyı pasife çek (ilişkili fişler bozulmasın)
        await prisma.user.update({ where: { id }, data: { isActive: false } });

        // DENETİM: erişim iptali — "bu teknisyenin erişimi ne zaman kapatıldı"
        await writeAudit({
            tenantId: me.tenantId,
            userId: me.id,
            action: 'KULLANICI_ERISIMI_KAPATILDI',
            entityType: 'User',
            entityId: id,
            oldValue: { name: target.name, email: target.email, role: target.role, isActive: target.isActive },
            newValue: { isActive: false },
            ipAddress: istekIp(req),
            actorType: 'USER',
            actorName: me.name ?? me.email,
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
