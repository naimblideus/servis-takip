import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TransactionType, TransactionCategory, PaymentMethod } from '@prisma/client';

// POST /api/accounting/seed — Muhasebe test verileri ekle
export async function POST() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const tenantId = user.tenantId;
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Müşteri al (varsa)
    const customers = await prisma.customer.findMany({
        where: { tenantId },
        take: 5,
        select: { id: true, name: true },
    });

    const customerId1 = customers[0]?.id || null;
    const customerId2 = customers[1]?.id || null;
    const customerId3 = customers[2]?.id || null;

    const seedData = [
        // === GELİRLER ===
        { type: 'INCOME', category: 'SERVICE_FEE', amount: 1500, method: 'CASH', description: 'HP LaserJet M404 servis bakımı', customerId: customerId1, date: daysAgo(2) },
        { type: 'INCOME', category: 'SERVICE_FEE', amount: 2500, method: 'CARD', description: 'Canon iR2530 genel bakım', customerId: customerId2, date: daysAgo(5) },
        { type: 'INCOME', category: 'SERVICE_FEE', amount: 850, method: 'TRANSFER', description: 'Kyocera M2040 toner değişimi', customerId: customerId3, date: daysAgo(8) },
        { type: 'INCOME', category: 'COUNTER_FEE', amount: 3200, method: 'TRANSFER', description: 'Aylık sayaç okuma ücreti (15 cihaz)', customerId: customerId1, date: daysAgo(1) },
        { type: 'INCOME', category: 'RENTAL_FEE', amount: 4500, method: 'TRANSFER', description: 'Mart ayı kiralık cihaz bedeli', customerId: customerId2, date: daysAgo(3) },
        { type: 'INCOME', category: 'PART_SALE', amount: 750, method: 'CASH', description: 'HP CF226A toner satışı', customerId: customerId3, date: daysAgo(4) },
        { type: 'INCOME', category: 'PART_SALE', amount: 1200, method: 'CARD', description: 'Canon NPG-59 drum ünitesi satışı', customerId: customerId1, date: daysAgo(7) },

        // === MAKİNA TİCARETİ ===
        { type: 'INCOME', category: 'MACHINE_SALE', amount: 18500, method: 'TRANSFER', description: 'Kyocera MA4500ix satışı (2. el)', customerId: customerId2, date: daysAgo(6) },
        { type: 'INCOME', category: 'MACHINE_SALE', amount: 12000, method: 'CASH', description: 'Canon iR2525 satışı', customerId: customerId3, date: daysAgo(12) },
        { type: 'EXPENSE', category: 'MACHINE_PURCHASE', amount: 8500, method: 'TRANSFER', description: 'HP M630 ikinci el alımı (İstanbul)', customerId: null, date: daysAgo(10) },
        { type: 'EXPENSE', category: 'MACHINE_PURCHASE', amount: 15000, method: 'TRANSFER', description: 'Kyocera TASKalfa 3253ci alımı', customerId: null, date: daysAgo(15) },
        { type: 'EXPENSE', category: 'MACHINE_PURCHASE', amount: 6200, method: 'CASH', description: 'Canon iR-ADV C3530 alımı (Ankara)', customerId: null, date: daysAgo(20) },

        // === İŞYERİ GİDERLERİ ===
        { type: 'EXPENSE', category: 'SALARY', amount: 45000, method: 'TRANSFER', description: 'Mart ayı personel maaşları (3 kişi)', customerId: null, date: daysAgo(1) },
        { type: 'EXPENSE', category: 'RENT', amount: 12000, method: 'TRANSFER', description: 'Mart ayı işyeri kirası', customerId: null, date: daysAgo(1) },
        { type: 'EXPENSE', category: 'UTILITY', amount: 2800, method: 'TRANSFER', description: 'Şubat elektrik faturası', customerId: null, date: daysAgo(5) },
        { type: 'EXPENSE', category: 'UTILITY', amount: 450, method: 'TRANSFER', description: 'Şubat su faturası', customerId: null, date: daysAgo(5) },
        { type: 'EXPENSE', category: 'UTILITY', amount: 1800, method: 'TRANSFER', description: 'Şubat doğalgaz faturası', customerId: null, date: daysAgo(4) },
        { type: 'EXPENSE', category: 'TAX', amount: 8500, method: 'TRANSFER', description: 'KDV ödemesi (Şubat)', customerId: null, date: daysAgo(10) },
        { type: 'EXPENSE', category: 'TAX', amount: 3200, method: 'TRANSFER', description: 'Gelir vergisi (1. taksit)', customerId: null, date: daysAgo(12) },
        { type: 'EXPENSE', category: 'FOOD', amount: 2400, method: 'CASH', description: 'Mart ayı yemek giderleri', customerId: null, date: daysAgo(2) },
        { type: 'EXPENSE', category: 'INSURANCE', amount: 4500, method: 'TRANSFER', description: 'İşyeri sigorta primi (yıllık)', customerId: null, date: daysAgo(15) },
        { type: 'EXPENSE', category: 'FUEL', amount: 3500, method: 'CARD', description: 'Mart ayı yakıt giderleri', customerId: null, date: daysAgo(3) },
        { type: 'EXPENSE', category: 'MAINTENANCE', amount: 1500, method: 'CASH', description: 'Dükkan tadilat (raf montajı)', customerId: null, date: daysAgo(8) },

        // === PARÇA ALIMLARI ===
        { type: 'EXPENSE', category: 'PART_PURCHASE', amount: 5600, method: 'TRANSFER', description: 'Toner stoğu alımı (Karma)', customerId: null, date: daysAgo(7) },
        { type: 'EXPENSE', category: 'PART_PURCHASE', amount: 3200, method: 'TRANSFER', description: 'Drum ve fuser roller alımı', customerId: null, date: daysAgo(14) },

        // === GENEL GİDERLER ===
        { type: 'EXPENSE', category: 'GENERAL_EXPENSE', amount: 950, method: 'CARD', description: 'Kırtasiye ve ofis malzemeleri', customerId: null, date: daysAgo(6) },
        { type: 'EXPENSE', category: 'GENERAL_EXPENSE', amount: 400, method: 'CASH', description: 'Kargo giderleri', customerId: null, date: daysAgo(9) },

        // === DİĞER GELİR ===
        { type: 'INCOME', category: 'OTHER_INCOME', amount: 500, method: 'CASH', description: 'Eski parça hurda satışı', customerId: null, date: daysAgo(11) },
    ];

    let created = 0;
    for (const item of seedData) {
        try {
            await prisma.financialTransaction.create({
                data: {
                    tenantId,
                    type: item.type as TransactionType,
                    category: item.category as TransactionCategory,
                    amount: item.amount,
                    method: item.method as PaymentMethod,
                    description: item.description,
                    customerId: item.customerId,
                    date: item.date,
                },
            });
            created++;
        } catch (e) {
            console.error('Seed error:', (e as Error).message);
        }
    }

    return NextResponse.json({
        message: `${created} muhasebe işlemi oluşturuldu`,
        categories: {
            gelir: seedData.filter(s => s.type === 'INCOME').length,
            gider: seedData.filter(s => s.type === 'EXPENSE').length,
            makinaAlim: seedData.filter(s => s.category === 'MACHINE_PURCHASE').length,
            makinaSatis: seedData.filter(s => s.category === 'MACHINE_SALE').length,
        },
    });
}

function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(10, 0, 0, 0);
    return d;
}
