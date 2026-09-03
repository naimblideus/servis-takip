import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { oturumKullanicisi } from '@/lib/api-auth';
import { bakiye, ekstre } from '@/lib/musteri-bakiye';

// GET /api/muhasebe/customer/[id] — Belirli müşterinin hesap detayları
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    try {
        const { id } = await params;

        // Müşteri bilgisi
        const customer = await prisma.customer.findFirst({
            where: { id, tenantId: user.tenantId },
            select: { id: true, name: true, phone: true, address: true, email: true },
        });

        if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

        // Tüm kayıtları al
        const entries = await prisma.accountEntry.findMany({
            where: { tenantId: user.tenantId, customerId: id },
            orderBy: { date: 'desc' },
        });

        // Satışlar ve ödemeler
        const sales = entries.filter(e => e.type === 'SALE');
        const payments = entries.filter(e => e.type === 'PAYMENT');

        const totalSales = sales.reduce((s, e) => s + Number(e.amount), 0);
        const totalPayments = payments.reduce((s, e) => s + Number(e.amount), 0);

        // ── BİRLEŞİK BAKİYE VE EKSTRE ────────────────────────────────────
        // `entries` (yalnız servis kalemleri) geriye dönük uyum için duruyor.
        // Ekranın gösterdiği gerçek artık `ekstre`: servis + kira/sayaç
        // faturası tek listede, tarih sıralı. `balance` da birleşik toplam.
        const [b, satirlar] = await Promise.all([
            bakiye(user.tenantId, id),
            ekstre(user.tenantId, id),
        ]);

        return NextResponse.json({
            customer,
            entries,
            sales,
            payments,
            ekstre: satirlar,
            summary: {
                totalSales,
                totalPayments,
                balance: b.toplamBorc,   // BİRLEŞİK
                servisBorc: b.servisBorc,
                faturaBorc: b.faturaBorc,
                entryCount: entries.length,
            },
        });
    } catch (e: any) {
        console.error('MUHASEBE CUSTOMER DETAIL ERROR:', e.message);
        if (e.message?.includes('does not exist')) {
            return NextResponse.json({ error: 'AccountEntry tablosu henüz oluşturulmamış.' }, { status: 503 });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
