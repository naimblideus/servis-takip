import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json({ tickets: [], customers: [], devices: [] });

    const tenantId = user.tenantId;

    const [tickets, customers, devices] = await Promise.all([
        prisma.serviceTicket.findMany({
            where: {
                tenantId,
                OR: [
                    { ticketNumber: { contains: q, mode: 'insensitive' } },
                    { issueText: { contains: q, mode: 'insensitive' } },
                    { device: { customer: { name: { contains: q, mode: 'insensitive' } } } },
                ],
            },
            include: { device: { include: { customer: true } } },
            take: 5,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.customer.findMany({
            where: {
                tenantId,
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { phone: { contains: q, mode: 'insensitive' } },
                ],
            },
            take: 5,
        }),
        prisma.device.findMany({
            where: {
                tenantId,
                OR: [
                    { brand: { contains: q, mode: 'insensitive' } },
                    { model: { contains: q, mode: 'insensitive' } },
                    { serialNo: { contains: q, mode: 'insensitive' } },
                    { publicCode: { contains: q, mode: 'insensitive' } },
                ],
            },
            include: { customer: true },
            take: 5,
        }),
    ]);

    return NextResponse.json({ tickets, customers, devices });
}
