import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { tumBakiyeler } from '@/lib/musteri-bakiye';

// GET /api/muhasebe/overdue — Borçlu müşteriler (dashboard + ana ekran için).
//
// Artık BİRLEŞİK borç: servis (AccountEntry) + kira/sayaç faturası
// (CustomerInvoice). Eskiden yalnız servis borcunu okuyordu; kira faturasını
// ödemeyen ama servis borcu olmayan müşteri dashboard'da HİÇ görünmüyordu —
// gerçek bir kör noktaydı. Tek kaynak: lib/musteri-bakiye.
export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    try {
        const bakiyeler = await tumBakiyeler(user.tenantId);
        const borclular = [...bakiyeler.values()].filter((b) => b.toplamBorc > 0);

        if (borclular.length === 0) {
            return NextResponse.json({ debtors: [], summary: { totalDebtors: 0, totalDebt: 0 } });
        }

        const customers = await prisma.customer.findMany({
            where: { id: { in: borclular.map((b) => b.customerId) }, tenantId: user.tenantId },
            select: { id: true, name: true, phone: true },
        });
        const bilgi = new Map(customers.map((c) => [c.id, c]));

        const debtors = borclular
            .map((b) => {
                const c = bilgi.get(b.customerId);
                if (!c) return null;
                // Ekranların beklediği eski alan adı (debt) korunuyor; anlamı artık
                // "birleşik toplam". Kırılım ayrıca veriliyor ki ekran isterse
                // "servisten şu kadar, kiradan şu kadar" diye açabilsin.
                return {
                    customer: c,
                    debt: b.toplamBorc,
                    servisBorc: b.servisBorc,
                    faturaBorc: b.faturaBorc,
                };
            })
            .filter((x): x is NonNullable<typeof x> => !!x)
            .sort((a, b) => b.debt - a.debt);

        const totalDebt = Math.round(debtors.reduce((s, d) => s + d.debt, 0) * 100) / 100;

        return NextResponse.json({
            debtors,
            summary: { totalDebtors: debtors.length, totalDebt },
        });
    } catch (e: any) {
        console.error('MUHASEBE OVERDUE ERROR:', e.message);
        if (e.message?.includes('does not exist')) {
            return NextResponse.json({ debtors: [], summary: { totalDebtors: 0, totalDebt: 0 } });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
