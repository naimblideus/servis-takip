import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateInvoiceNumber } from '@/lib/tenant-manager';

// GET — fatura listesi
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || '';
    const tenantId = searchParams.get('tenantId') || '';
    const period = searchParams.get('period') || '';
    const page = parseInt(searchParams.get('page') || '1');

    const where: any = {};
    if (status) where.status = status;
    if (tenantId) where.tenantId = tenantId;
    if (period) where.period = period;

    const [invoices, total, summary] = await Promise.all([
        (prisma as any).tenantInvoice.findMany({
            where,
            skip: (page - 1) * 20,
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: { tenant: { select: { name: true, ownerName: true, phone: true } } },
        }),
        (prisma as any).tenantInvoice.count({ where }),
        (prisma as any).tenantInvoice.aggregate({
            _sum: { totalAmount: true, paidAmount: true },
        }),
    ]);

    const overdue = await (prisma as any).tenantInvoice.aggregate({
        where: { status: 'overdue' },
        _sum: { totalAmount: true },
    });

    return NextResponse.json({
        invoices,
        total,
        pages: Math.ceil(total / 20),
        summary: {
            totalBilled: summary._sum?.totalAmount || 0,
            totalCollected: summary._sum?.paidAmount || 0,
            overdueAmount: overdue._sum?.totalAmount || 0,
        },
    });
}

// POST — yeni fatura oluştur
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { tenantId, amount, vatRate = 20, period, dueDate, notes } = body;

    const vatAmount = (amount * vatRate) / 100;
    const totalAmount = amount + vatAmount;
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await (prisma as any).tenantInvoice.create({
        data: {
            tenantId,
            invoiceNumber,
            period: period || new Date().toISOString().slice(0, 7),
            amount,
            vatAmount,
            totalAmount,
            status: 'pending',
            dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 86400000),
            notes,
        },
    });

    return NextResponse.json(invoice, { status: 201 });
}
