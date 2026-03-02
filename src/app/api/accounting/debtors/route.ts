import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/accounting/debtors — Tüm borçlu müşteriler (arama, sıralama, filtre destekli)
export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'debt'; // debt | days | name
    const minDays = parseInt(searchParams.get('minDays') || '0'); // 0=tümü, 30, 60, 90

    // Ödenmeyen veya kısmi ödenen fişleri bul
    const unpaidTickets = await prisma.serviceTicket.findMany({
        where: {
            tenantId: user.tenantId,
            paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
            totalCost: { gt: 0 },
        },
        include: {
            device: { select: { brand: true, model: true, serialNo: true } },
            payments: { select: { id: true, amount: true, method: true, paymentDate: true, notes: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    // Müşteri bilgilerini ayrı çek
    const customerIds = [...new Set(unpaidTickets.map(t => t.customerId))];
    const customers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true, phone: true, address: true },
    });
    const customerMap = new Map(customers.map(c => [c.id, c]));

    // Müşteriye göre grupla
    const debtorMap = new Map<string, {
        customer: { id: string; name: string; phone: string; address: string | null };
        totalDebt: number;
        totalCost: number;
        paidAmount: number;
        oldestOverdue: number;
        tickets: {
            id: string;
            ticketNumber: string;
            totalCost: number;
            paid: number;
            remaining: number;
            createdAt: string;
            daysOverdue: number;
            device: string;
            status: string;
            payments: { id: string; amount: number; method: string; paymentDate: string; notes: string | null }[];
        }[];
    }>();

    for (const ticket of unpaidTickets) {
        const cust = customerMap.get(ticket.customerId);
        if (!cust) continue;

        const totalCost = Number(ticket.totalCost);
        const paid = ticket.payments.reduce((s, p) => s + Number(p.amount), 0);
        const remaining = totalCost - paid;
        if (remaining <= 0) continue;

        const daysOverdue = Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60 * 24));

        // Min gün filtresi
        if (minDays > 0 && daysOverdue < minDays) continue;

        if (!debtorMap.has(cust.id)) {
            debtorMap.set(cust.id, {
                customer: cust,
                totalDebt: 0,
                totalCost: 0,
                paidAmount: 0,
                oldestOverdue: 0,
                tickets: [],
            });
        }

        const debtor = debtorMap.get(cust.id)!;
        debtor.totalDebt += remaining;
        debtor.totalCost += totalCost;
        debtor.paidAmount += paid;
        debtor.oldestOverdue = Math.max(debtor.oldestOverdue, daysOverdue);
        debtor.tickets.push({
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            totalCost,
            paid,
            remaining,
            createdAt: ticket.createdAt.toISOString(),
            daysOverdue,
            device: `${ticket.device.brand} ${ticket.device.model}`,
            status: ticket.paymentStatus,
            payments: ticket.payments.map(p => ({
                id: p.id,
                amount: Number(p.amount),
                method: p.method,
                paymentDate: p.paymentDate.toISOString(),
                notes: p.notes,
            })),
        });
    }

    let debtors = Array.from(debtorMap.values());

    // Arama filtresi
    if (search.trim()) {
        const q = search.toLowerCase();
        debtors = debtors.filter(d =>
            d.customer.name.toLowerCase().includes(q) ||
            d.customer.phone.includes(q) ||
            d.tickets.some(t => t.ticketNumber.toLowerCase().includes(q))
        );
    }

    // Sıralama
    switch (sort) {
        case 'days':
            debtors.sort((a, b) => b.oldestOverdue - a.oldestOverdue);
            break;
        case 'name':
            debtors.sort((a, b) => a.customer.name.localeCompare(b.customer.name, 'tr'));
            break;
        case 'debt':
        default:
            debtors.sort((a, b) => b.totalDebt - a.totalDebt);
            break;
    }

    // 30+ gün gecikmiş borç toplamı
    const overdueDebt30 = Array.from(debtorMap.values()).reduce((sum, d) => {
        return sum + d.tickets.filter(t => t.daysOverdue >= 30).reduce((s, t) => s + t.remaining, 0);
    }, 0);

    return NextResponse.json({
        debtors,
        summary: {
            totalDebtors: debtors.length,
            totalDebt: debtors.reduce((s, d) => s + d.totalDebt, 0),
            totalTickets: debtors.reduce((s, d) => s + d.tickets.length, 0),
            overdueDebt30,
            overdueDebtors30: debtors.filter(d => d.oldestOverdue >= 30).length,
        },
    });
}
