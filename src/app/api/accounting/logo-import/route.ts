import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TransactionType, TransactionCategory, PaymentMethod } from '@prisma/client';

// Logo Tiger/Go → Hesap Kodu → Servis Takip Kategori eşlemesi
// string tipi kullanarak TypeScript literal inference sorununu aşıyoruz
const HESAP_KODU_MAP: Record<string, { category: string; type: string }> = {
    '600': { category: 'SERVICE_FEE', type: 'INCOME' },
    '600.01': { category: 'SERVICE_FEE', type: 'INCOME' },
    '600.02': { category: 'COUNTER_FEE', type: 'INCOME' },
    '600.03': { category: 'RENTAL_FEE', type: 'INCOME' },
    '600.04': { category: 'PART_SALE', type: 'INCOME' },
    '600.05': { category: 'MACHINE_SALE', type: 'INCOME' },
    '649': { category: 'OTHER_INCOME', type: 'INCOME' },
    '649.01': { category: 'OTHER_INCOME', type: 'INCOME' },
    '153': { category: 'PART_PURCHASE', type: 'EXPENSE' },
    '153.01': { category: 'PART_PURCHASE', type: 'EXPENSE' },
    '153.02': { category: 'MACHINE_PURCHASE', type: 'EXPENSE' },
    '770': { category: 'GENERAL_EXPENSE', type: 'EXPENSE' },
    '770.01': { category: 'GENERAL_EXPENSE', type: 'EXPENSE' },
    '770.02': { category: 'SALARY', type: 'EXPENSE' },
    '770.03': { category: 'RENT', type: 'EXPENSE' },
    '770.04': { category: 'UTILITY', type: 'EXPENSE' },
    '770.05': { category: 'TAX', type: 'EXPENSE' },
    '770.06': { category: 'FOOD', type: 'EXPENSE' },
    '770.07': { category: 'INSURANCE', type: 'EXPENSE' },
    '770.08': { category: 'FUEL', type: 'EXPENSE' },
    '770.09': { category: 'MAINTENANCE', type: 'EXPENSE' },
    '689': { category: 'OTHER_EXPENSE', type: 'EXPENSE' },
    '689.01': { category: 'OTHER_EXPENSE', type: 'EXPENSE' },
};

// Logo'nun DD.MM.YYYY tarih formatını parse et
function parseLogoDate(dateStr: string): Date | null {
    const clean = dateStr.trim().replace(/\//g, '.');
    const parts = clean.split('.');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(Number);
    if (!d || !m || !y) return null;
    return new Date(y, m - 1, d);
}

// Logo Tiger/Go standart CSV çıktısını parse et
// Format: Tarih;Fiş No;Hesap Kodu;Hesap Adı;Borç;Alacak;Açıklama
function parseLogoCSV(content: string): Array<{
    date: Date; fisNo: string; hesapKodu: string;
    borc: number; alacak: number; aciklama: string;
}> {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const rows = [];
    // İlk satır header → atla
    const startIdx = lines[0].toLowerCase().includes('tarih') || lines[0].toLowerCase().includes('date') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
        const cols = lines[i].split(';');
        if (cols.length < 5) continue;

        const dateStr = cols[0]?.trim();
        const fisNo = cols[1]?.trim() || `IMP-${i}`;
        const hesapKodu = cols[2]?.trim() || '';

        // Sayısal değerleri parse et (virgül → nokta, TL işareti vs. temizle)
        const parseNum = (s: string) => parseFloat((s || '0').trim().replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
        const borc = parseNum(cols[4]);
        const alacak = parseNum(cols[5] || '0');
        const aciklama = cols[6]?.trim() || cols[3]?.trim() || '';

        const date = parseLogoDate(dateStr);
        if (!date || isNaN(date.getTime())) continue;
        if (borc === 0 && alacak === 0) continue;

        rows.push({ date, fisNo, hesapKodu, borc, alacak, aciklama });
    }
    return rows;
}

// POST /api/accounting/logo-import — Logo'dan Servis Takip'e CSV aktarımı
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    try {
        const body = await req.json();
        const { csvContent } = body;

        if (!csvContent) {
            return NextResponse.json({ error: 'csvContent zorunlu' }, { status: 400 });
        }

        const rows = parseLogoCSV(csvContent);
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const row of rows) {
            try {
                // Hesap kodu ile kategori belirle (ana hesap koduna da bak: 770.05 → 770)
                const mapped = HESAP_KODU_MAP[row.hesapKodu] || HESAP_KODU_MAP[row.hesapKodu.split('.')[0]];

                // Alacak varsa gelir, borç varsa gider
                const amount = row.alacak > 0 ? row.alacak : row.borc;
                const type = (row.alacak > 0 ? 'INCOME' : 'EXPENSE') as TransactionType;
                const category = (mapped?.category || (type === 'INCOME' ? 'OTHER_INCOME' : 'OTHER_EXPENSE')) as TransactionCategory;

                // Çift kayıt koruması
                const dayStart = new Date(row.date.getFullYear(), row.date.getMonth(), row.date.getDate());
                const dayEnd = new Date(row.date.getFullYear(), row.date.getMonth(), row.date.getDate() + 1);

                const existing = await prisma.financialTransaction.findFirst({
                    where: {
                        tenantId: user.tenantId,
                        description: { contains: row.fisNo },
                        date: { gte: dayStart, lt: dayEnd },
                        amount,
                    },
                });

                if (existing) {
                    skipped++;
                    continue;
                }

                await prisma.financialTransaction.create({
                    data: {
                        tenantId: user.tenantId,
                        type,
                        category,
                        amount,
                        method: 'OTHER' as PaymentMethod,
                        description: `[Logo: ${row.fisNo}] ${row.aciklama}`,
                        date: row.date,
                    },
                });
                imported++;
            } catch (e: any) {
                errors.push(`${row.fisNo}: ${e.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            total: rows.length,
            imported,
            skipped,
            errors: errors.slice(0, 10),
            message: `${imported} kayıt içe aktarıldı, ${skipped} atlandı (zaten var).`,
        });
    } catch (e: any) {
        console.error('LOGO IMPORT ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
