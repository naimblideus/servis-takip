import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const me = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!me || me.role !== 'ADMIN') return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });

    try {
        const body = await req.json();
        const updateData: any = {};
        if (body.name) updateData.name = body.name;
        if (body.email) updateData.email = body.email;
        if (body.role) updateData.role = body.role;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.password) {
            if (body.password.length < 6) return NextResponse.json({ error: 'Şifre en az 6 karakter' }, { status: 400 });
            updateData.passwordHash = await bcrypt.hash(body.password, 12);
        }

        const user = await prisma.user.update({ where: { id }, data: updateData });
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

    const me = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!me || me.role !== 'ADMIN') return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    if (me.id === id) return NextResponse.json({ error: 'Kendinizi silemezsiniz' }, { status: 400 });

    try {
        // Önce kullanıcıyı pasife çek (ilişkili fişler bozulmasın)
        await prisma.user.update({ where: { id }, data: { isActive: false } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
