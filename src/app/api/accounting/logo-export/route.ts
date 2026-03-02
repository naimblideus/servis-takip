import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Logo Hesap Kodları eşlemesi
const LOGO_HESAP_KODLARI: Record<string, { hesapKodu: string; hesapAdi: string }> = {
    SERVICE_FEE: { hesapKodu: '600.01', hesapAdi: 'Yurtiçi Satışlar - Servis Geliri' },
    COUNTER_FEE: { hesapKodu: '600.02', hesapAdi: 'Yurtiçi Satışlar - Sayaç Geliri' },
    RENTAL_FEE: { hesapKodu: '600.03', hesapAdi: 'Yurtiçi Satışlar - Kira Geliri' },
    PART_SALE: { hesapKodu: '600.04', hesapAdi: 'Yurtiçi Satışlar - Parça Satışı' },
    MACHINE_SALE: { hesapKodu: '600.05', hesapAdi: 'Yurtiçi Satışlar - Makina Satışı' },
    OTHER_INCOME: { hesapKodu: '649.01', hesapAdi: 'Diğer Olağan Gelir ve Kârlar' },
    PART_PURCHASE: { hesapKodu: '153.01', hesapAdi: 'Ticari Mallar - Parça Alımı' },
    MACHINE_PURCHASE: { hesapKodu: '153.02', hesapAdi: 'Ticari Mallar - Makina Alımı' },
    GENERAL_EXPENSE: { hesapKodu: '770.01', hesapAdi: 'Genel Yönetim Giderleri' },
    SALARY: { hesapKodu: '770.02', hesapAdi: 'Personel Giderleri - Maaş' },
    RENT: { hesapKodu: '770.03', hesapAdi: 'Kira Giderleri' },
    UTILITY: { hesapKodu: '770.04', hesapAdi: 'Enerji Giderleri (Elektrik/Su/Doğalgaz)' },
    TAX: { hesapKodu: '770.05', hesapAdi: 'Vergi, Resim ve Harçlar' },
    FOOD: { hesapKodu: '770.06', hesapAdi: 'Yemek Giderleri' },
    INSURANCE: { hesapKodu: '770.07', hesapAdi: 'Sigorta Giderleri' },
    FUEL: { hesapKodu: '770.08', hesapAdi: 'Ulaşım / Yakıt Giderleri' },
    MAINTENANCE: { hesapKodu: '770.09', hesapAdi: 'Bakım / Onarım Giderleri' },
    OTHER_EXPENSE: { hesapKodu: '689.01', hesapAdi: 'Diğer Olağan Gider ve Zararlar' },
};

const ODEME_YONTEMI: Record<string, string> = {
    CASH: 'Nakit', CARD: 'Kredi Kartı', TRANSFER: 'Banka Havalesi', OTHER: 'Diğer',
};

// GET /api/accounting/logo-export — Logo uyumlu XML veya CSV export
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'xml'; // xml | csv
    const month = searchParams.get('month'); // 2026-02

    const where: any = { tenantId: user.tenantId };
    if (month) {
        const [y, m] = month.split('-').map(Number);
        where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }

    const transactions = await prisma.financialTransaction.findMany({
        where,
        orderBy: { date: 'asc' },
        include: {
            customer: { select: { name: true, phone: true, taxNo: true } },
        },
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });

    if (format === 'csv') {
        // CSV Export — Logo'ya Import edilebilir
        const header = 'Tarih;Fiş No;Hesap Kodu;Hesap Adı;Borç;Alacak;Açıklama;Müşteri;Ödeme Yöntemi\n';
        const rows = transactions.map((t, i) => {
            const h = LOGO_HESAP_KODLARI[t.category] || { hesapKodu: '999.99', hesapAdi: 'Tanımsız' };
            const amount = Number(t.amount).toFixed(2);
            const borc = t.type === 'EXPENSE' ? amount : '0.00';
            const alacak = t.type === 'INCOME' ? amount : '0.00';
            const tarih = new Date(t.date).toLocaleDateString('tr-TR');
            const fisNo = `MHS-${String(i + 1).padStart(4, '0')}`;
            return `${tarih};${fisNo};${h.hesapKodu};${h.hesapAdi};${borc};${alacak};${t.description};${t.customer?.name || ''};${ODEME_YONTEMI[t.method] || t.method}`;
        }).join('\n');

        return new NextResponse(header + rows, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="muhasebe_${month || 'tumu'}_logo.csv"`,
            },
        });
    }

    // XML Export — Logo XML formatı
    const xmlItems = transactions.map((t, i) => {
        const h = LOGO_HESAP_KODLARI[t.category] || { hesapKodu: '999.99', hesapAdi: 'Tanımsız' };
        const amount = Number(t.amount).toFixed(2);
        const tarih = new Date(t.date).toISOString().split('T')[0];
        return `
    <TRANSACTION>
        <INTERNAL_REFERENCE>${i + 1}</INTERNAL_REFERENCE>
        <DATE>${tarih}</DATE>
        <NUMBER>MHS-${String(i + 1).padStart(4, '0')}</NUMBER>
        <GL_CODE>${h.hesapKodu}</GL_CODE>
        <GL_DESCRIPTION>${escapeXml(h.hesapAdi)}</GL_DESCRIPTION>
        <TYPE>${t.type === 'INCOME' ? '1' : '2'}</TYPE>
        <DEBIT>${t.type === 'EXPENSE' ? amount : '0.00'}</DEBIT>
        <CREDIT>${t.type === 'INCOME' ? amount : '0.00'}</CREDIT>
        <DESCRIPTION>${escapeXml(t.description)}</DESCRIPTION>
        <PAYMENT_METHOD>${ODEME_YONTEMI[t.method] || t.method}</PAYMENT_METHOD>
        <CUSTOMER_NAME>${escapeXml(t.customer?.name || '')}</CUSTOMER_NAME>
        <CUSTOMER_TAX_NO>${escapeXml(t.customer?.taxNo || '')}</CUSTOMER_TAX_NO>
        <CATEGORY>${t.category}</CATEGORY>
    </TRANSACTION>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ACCOUNTING_EXPORT>
    <COMPANY>${escapeXml(tenant?.name || 'Servis Takip')}</COMPANY>
    <EXPORT_DATE>${new Date().toISOString().split('T')[0]}</EXPORT_DATE>
    <PERIOD>${month || 'ALL'}</PERIOD>
    <TOTAL_TRANSACTIONS>${transactions.length}</TOTAL_TRANSACTIONS>
    <TRANSACTIONS>${xmlItems}
    </TRANSACTIONS>
</ACCOUNTING_EXPORT>`;

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Content-Disposition': `attachment; filename="muhasebe_${month || 'tumu'}_logo.xml"`,
        },
    });
}

function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
