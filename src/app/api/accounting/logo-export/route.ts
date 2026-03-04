import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ═══ Logo Tiger/Go Türkiye Hesap Planı (Tek Düzen Muhasebe) ═══
const LOGO_HESAP: Record<string, { kod: string; ad: string; karsit: string }> = {
    SERVICE_FEE: { kod: '600.01', ad: 'Yurt İçi Satışlar - Servis Hizmetleri', karsit: '120.01' },
    COUNTER_FEE: { kod: '600.02', ad: 'Yurt İçi Satışlar - Sayaç/Baskı Geliri', karsit: '120.01' },
    RENTAL_FEE: { kod: '600.03', ad: 'Yurt İçi Satışlar - Kira Bedeli', karsit: '120.01' },
    PART_SALE: { kod: '600.04', ad: 'Yurt İçi Satışlar - Parça/Malzeme Satışı', karsit: '120.01' },
    MACHINE_SALE: { kod: '600.05', ad: 'Yurt İçi Satışlar - Makina Satışı', karsit: '120.01' },
    OTHER_INCOME: { kod: '649.01', ad: 'Diğer Olağan Gelir ve Kârlar', karsit: '100.01' },
    PART_PURCHASE: { kod: '153.01', ad: 'Ticari Mallar - Parça/Malzeme Alışı', karsit: '320.01' },
    MACHINE_PURCHASE: { kod: '153.02', ad: 'Ticari Mallar - Makina/Ekipman Alışı', karsit: '320.01' },
    GENERAL_EXPENSE: { kod: '770.01', ad: 'Genel Yönetim Giderleri', karsit: '100.01' },
    SALARY: { kod: '770.02', ad: 'Personel/Ücret Giderleri', karsit: '335.01' },
    RENT: { kod: '770.03', ad: 'Kira Giderleri', karsit: '100.01' },
    UTILITY: { kod: '770.04', ad: 'Elektrik, Su, Doğalgaz (Enerji Giderleri)', karsit: '100.01' },
    TAX: { kod: '770.05', ad: 'Vergi, Resim ve Harçlar', karsit: '100.01' },
    FOOD: { kod: '770.06', ad: 'Yemek ve İaşe Giderleri', karsit: '100.01' },
    INSURANCE: { kod: '770.07', ad: 'Sigorta Giderleri', karsit: '100.01' },
    FUEL: { kod: '770.08', ad: 'Ulaşım / Yakıt Giderleri', karsit: '100.01' },
    MAINTENANCE: { kod: '770.09', ad: 'Bakım-Onarım Giderleri', karsit: '100.01' },
    OTHER_EXPENSE: { kod: '689.01', ad: 'Diğer Olağan Dışı Gider ve Zararlar', karsit: '100.01' },
};

// Ödeme yöntemi → Logo kasa/banka hesap kodu
const ODEME_HESAP: Record<string, { kod: string; ad: string }> = {
    CASH: { kod: '100.01', ad: 'Merkez Kasa' },
    CARD: { kod: '102.01', ad: 'Banka - POS Tahsilatı' },
    TRANSFER: { kod: '102.01', ad: 'Banka - EFT/Havale' },
    OTHER: { kod: '100.01', ad: 'Diğer Tahsilat' },
};

function trDate(d: Date): string {
    // Logo Tiger DD.MM.YYYY formatı
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function escXml(s: string): string {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findFirst({ where: { email: session.user?.email! } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'xml';
    const month = searchParams.get('month');
    const allTime = searchParams.get('all') === '1';

    const where: any = { tenantId: user.tenantId };
    if (month && !allTime) {
        const [y, m] = month.split('-').map(Number);
        where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }

    const transactions = await prisma.financialTransaction.findMany({
        where,
        orderBy: { date: 'asc' },
        include: { customer: { select: { name: true, taxNo: true, phone: true } } },
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
    const period = allTime ? 'TUMU' : (month || new Date().toISOString().slice(0, 7));

    // ─── CSV Export (Logo Tiger uyumlu) ───────────────────────────────────────
    if (format === 'csv') {
        const BOM = '\uFEFF'; // UTF-8 BOM — Excel Türkçe karakter desteği için
        const header = 'Tarih;Fiş No;Hesap Kodu;Hesap Adı;Borç;Alacak;Açıklama;Müşteri;Ödeme Yöntemi\r\n';
        const rows: string[] = [];

        transactions.forEach((t, i) => {
            const h = LOGO_HESAP[t.category] || { kod: '999.99', ad: 'Tanımsız', karsit: '100.01' };
            const kasaH = ODEME_HESAP[t.method] || ODEME_HESAP.CASH;
            const amt = Number(t.amount).toFixed(2).replace('.', ',');
            const zero = '0,00';
            const tarih = trDate(new Date(t.date));
            const fisNo = `SF-${String(i + 1).padStart(4, '0')}`;
            const aciklama = escXml(t.description);
            const musteri = t.customer?.name || '';

            if (t.type === 'INCOME') {
                // Gelir: Kasa/Banka BORÇLU, Gelir Hesabı ALACAKLI
                rows.push(`${tarih};${fisNo};${kasaH.kod};${kasaH.ad};${amt};${zero};${aciklama};${musteri};${t.method}`);
                rows.push(`${tarih};${fisNo};${h.kod};${h.ad};${zero};${amt};${aciklama};${musteri};${t.method}`);
            } else {
                // Gider: Gider Hesabı BORÇLU, Kasa/Banka ALACAKLI
                rows.push(`${tarih};${fisNo};${h.kod};${h.ad};${amt};${zero};${aciklama};${musteri};${t.method}`);
                rows.push(`${tarih};${fisNo};${kasaH.kod};${kasaH.ad};${zero};${amt};${aciklama};${musteri};${t.method}`);
            }
        });

        return new NextResponse(BOM + header + rows.join('\r\n'), {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${tenant?.name || 'servis'}_logo_${period}.csv"`,
            },
        });
    }

    // ─── XML Export (Logo Tiger Yevmiye Fişi formatı) ───────────────────────
    // Logo Tiger'ın "Toplu Fiş Girişi → XML'den Aktar" formatı
    const fisleri = transactions.map((t, i) => {
        const h = LOGO_HESAP[t.category] || { kod: '999.99', ad: 'Tanımsız', karsit: '100.01' };
        const kasaH = ODEME_HESAP[t.method] || ODEME_HESAP.CASH;
        const amt = Number(t.amount).toFixed(2);
        const tarih = trDate(new Date(t.date));
        const fisNo = `SF-${String(i + 1).padStart(4, '0')}`;
        const aciklama = escXml(t.description);
        const musteriAdi = escXml(t.customer?.name || '');
        const vkn = escXml(t.customer?.taxNo || '');

        // GELIR: Kasa B+ / Gelir A+   |   GİDER: Gider B+ / Kasa A+
        const [borc1, alacak1, borc2, alacak2] = t.type === 'INCOME'
            ? [amt, '0.00', '0.00', amt]
            : [amt, '0.00', '0.00', amt];
        const [hesap1, hesap2] = t.type === 'INCOME'
            ? [kasaH.kod, h.kod]
            : [h.kod, kasaH.kod];
        const [ad1, ad2] = t.type === 'INCOME'
            ? [kasaH.ad, h.ad]
            : [h.ad, kasaH.ad];

        return `  <MUHASEBE_FISI>
    <FIS_TIPI>1</FIS_TIPI>
    <FIS_TARIHI>${tarih}</FIS_TARIHI>
    <FIS_NO>${fisNo}</FIS_NO>
    <ACIKLAMA>${aciklama}</ACIKLAMA>
    <MUSTERI_ADI>${musteriAdi}</MUSTERI_ADI>
    <VKN_TCKN>${vkn}</VKN_TCKN>
    <SATIRLAR>
      <SATIR>
        <HESAP_KODU>${hesap1}</HESAP_KODU>
        <HESAP_ADI>${escXml(ad1)}</HESAP_ADI>
        <BORC>${borc1}</BORC>
        <ALACAK>${alacak1}</ALACAK>
        <ACIKLAMA>${aciklama}</ACIKLAMA>
      </SATIR>
      <SATIR>
        <HESAP_KODU>${hesap2}</HESAP_KODU>
        <HESAP_ADI>${escXml(ad2)}</HESAP_ADI>
        <BORC>${borc2}</BORC>
        <ALACAK>${alacak2}</ALACAK>
        <ACIKLAMA>${aciklama}</ACIKLAMA>
      </SATIR>
    </SATIRLAR>
  </MUHASEBE_FISI>`;
    }).join('\n');

    const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Logo Tiger/Go Yevmiye Fişi - Türkiye Tek Düzen Hesap Planı -->
<!-- Aktarım: Logo Ana Menü → Muhasebe → Genel Muhasebe → Yevmiye → XML'den Aktar -->
<LOGO_MUHASEBE>
  <FIRMA_BILGILERI>
    <FIRMA_ADI>${escXml(tenant?.name || 'Servis Takip')}</FIRMA_ADI>
    <IHRAC_TARIHI>${trDate(new Date())}</IHRAC_TARIHI>
    <DONEM>${period}</DONEM>
    <TOPLAM_FIS>${transactions.length}</TOPLAM_FIS>
    <TOPLAM_GELIR>${totalIncome.toFixed(2)}</TOPLAM_GELIR>
    <TOPLAM_GIDER>${totalExpense.toFixed(2)}</TOPLAM_GIDER>
    <NET_KAR_ZARAR>${(totalIncome - totalExpense).toFixed(2)}</NET_KAR_ZARAR>
  </FIRMA_BILGILERI>
  <FISLER>
${fisleri}
  </FISLER>
</LOGO_MUHASEBE>`;

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Content-Disposition': `attachment; filename="${tenant?.name || 'servis'}_logo_${period}.xml"`,
        },
    });
}
