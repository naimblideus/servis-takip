import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AccountEntryType } from '@prisma/client';
import { validateAmount } from '@/lib/money';
import { oturumKullanicisi, yoneticiDegilse } from '@/lib/api-auth';
import { tumBakiyeler } from '@/lib/musteri-bakiye';

// GET /api/muhasebe — Tüm hesap kayıtlarını listele (filtrelerle)
export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // Menüde gizlemek yetkilendirme değildir: teknisyen adresi elle yazıp
    // bütün müşterilerin mali verisini okuyabiliyor/değiştirebiliyordu. Saha
    // tahsilatı ayrı uçtan geçer (/api/tickets/[id]/payments), o kapanmıyor.
    const yetki = yoneticiDegilse(user);
    if (yetki) return yetki;

    try {
        const { searchParams } = new URL(req.url);
        const customerId = searchParams.get('customerId');
        const type = searchParams.get('type'); // SALE | PAYMENT
        const filter = searchParams.get('filter'); // paid | unpaid | all
        const search = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit') || '100');

        const where: any = { tenantId: user.tenantId };
        if (customerId) where.customerId = customerId;
        if (type) where.type = type;

        const entries = await prisma.accountEntry.findMany({
            where,
            orderBy: { date: 'desc' },
            take: limit,
            include: {
                customer: { select: { id: true, name: true, phone: true } },
            },
        });

        // ── BİRLEŞİK BAKİYE ──────────────────────────────────────────────
        // Borç iki yerde birikiyor: servis (AccountEntry) ve kira/sayaç
        // faturası (CustomerInvoice). Bu ekran eskiden yalnız SERVİSİ
        // topluyordu; bayi "bu müşteri bana ne kadar borçlu" sorusuna tek
        // cevap alamıyordu. Tek kaynak: lib/musteri-bakiye.
        const bakiyeler = await tumBakiyeler(user.tenantId);

        // Müşterileri al
        const customers = await prisma.customer.findMany({
            where: { tenantId: user.tenantId },
            select: { id: true, name: true, phone: true },
            orderBy: { name: 'asc' },
        });

        // Filtreli müşteri listesi
        let customerList = customers.map(c => {
            const b = bakiyeler.get(c.id);
            return {
                ...c,
                // Eski alan adları korunuyor (ekran bunları okuyor); anlamları
                // artık birleşik toplam.
                totalSales: b?.servisBorc ?? 0,
                totalPayments: 0,
                servisBorc: b?.servisBorc ?? 0,
                faturaBorc: b?.faturaBorc ?? 0,
                balance: b?.toplamBorc ?? 0, // pozitif = borçlu
            };
        });

        // Arama filtresi
        if (search?.trim()) {
            const q = search.toLowerCase();
            customerList = customerList.filter(c =>
                c.name.toLowerCase().includes(q) || c.phone.includes(q)
            );
        }

        // Ödeyen/ödemeyen filtresi
        if (filter === 'unpaid') {
            customerList = customerList.filter(c => c.balance > 0);
        } else if (filter === 'paid') {
            customerList = customerList.filter(c => c.balance <= 0);
        }

        // ── ÖZET ─────────────────────────────────────────────────────────
        // Tek gerçek: TOPLAM ALACAK. Kırılımı (servis / kira-fatura) yanında
        // durur ki bayi "bu para nereden geliyor" diye sorduğunda cevabı olsun.
        const yuvarla = (n: number) => Math.round(n * 100) / 100;
        const hepsi = [...bakiyeler.values()];
        const servisAlacak = yuvarla(hepsi.reduce((s, b) => s + Math.max(0, b.servisBorc), 0));
        const faturaAlacak = yuvarla(hepsi.reduce((s, b) => s + Math.max(0, b.faturaBorc), 0));
        const totalDebt = yuvarla(hepsi.reduce((s, b) => s + Math.max(0, b.toplamBorc), 0));
        const debtorCount = hepsi.filter((b) => b.toplamBorc > 0).length;

        return NextResponse.json({
            entries,
            customers: customerList,
            summary: {
                totalDebt,          // birleşik toplam alacak
                servisAlacak,       // servis işlerinden
                faturaAlacak,       // kira/sayaç faturalarından
                debtorCount,
                customerCount: customers.length,
            },
        });
    } catch (e: any) {
        console.error('MUHASEBE GET ERROR:', e.message);
        // Tablo yoksa anlamlı hata mesajı dön
        if (e.message?.includes('does not exist')) {
            return NextResponse.json({
                error: 'Muhasebe tablosu henüz oluşturulmamış. Lütfen veritabanı migration işlemini çalıştırın.',
                detail: e.message,
            }, { status: 503 });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST /api/muhasebe — Yeni satış veya ödeme ekle
export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // Menüde gizlemek yetkilendirme değildir: teknisyen adresi elle yazıp
    // bütün müşterilerin mali verisini okuyabiliyor/değiştirebiliyordu. Saha
    // tahsilatı ayrı uçtan geçer (/api/tickets/[id]/payments), o kapanmıyor.
    const yetki = yoneticiDegilse(user);
    if (yetki) return yetki;

    try {
        const body = await req.json();
        const { customerId, type, product, amount, method, notes, date } = body;

        if (!customerId || !type || !amount) {
            return NextResponse.json({ error: 'customerId, type, amount zorunlu' }, { status: 400 });
        }

        if (type === 'SALE' && !product) {
            return NextResponse.json({ error: 'Satış kaydı için ürün/hizmet adı zorunlu' }, { status: 400 });
        }

        const amt = validateAmount(amount);
        if (!amt) return NextResponse.json({ error: 'Geçerli (pozitif) bir tutar girin' }, { status: 400 });

        // Müşteri bu bayiye mi ait? (cross-tenant IDOR + PII sızıntısı engeli)
        const owned = await prisma.customer.findFirst({ where: { id: customerId, tenantId: user.tenantId }, select: { id: true } });
        if (!owned) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 });

        const entry = await prisma.accountEntry.create({
            data: {
                tenantId: user.tenantId,
                customerId,
                type: type as AccountEntryType,
                product: product || null,
                amount: amt,
                method: (method || 'CASH') as string,
                notes: notes || null,
                createdByUserId: user.id,
                createdByName: user.name,
                date: date ? new Date(date) : new Date(),
            },
            include: {
                customer: { select: { id: true, name: true, phone: true } },
            },
        });

        return NextResponse.json(entry);
    } catch (e: any) {
        console.error('ACCOUNT ENTRY CREATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PATCH /api/muhasebe — Kayıt düzenle
export async function PATCH(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // Menüde gizlemek yetkilendirme değildir: teknisyen adresi elle yazıp
    // bütün müşterilerin mali verisini okuyabiliyor/değiştirebiliyordu. Saha
    // tahsilatı ayrı uçtan geçer (/api/tickets/[id]/payments), o kapanmıyor.
    const yetki = yoneticiDegilse(user);
    if (yetki) return yetki;

    try {
        const body = await req.json();
        const { id, type, product, amount, method, notes, date } = body;

        if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 });

        // Kaydın bu tenant'a ait olduğunu kontrol et
        const existing = await prisma.accountEntry.findFirst({ where: { id, tenantId: user.tenantId } });
        if (!existing) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

        const data: any = {};
        if (type) data.type = type as AccountEntryType;
        if (product !== undefined) data.product = product || null;
        if (amount !== undefined && amount !== null && amount !== '') data.amount = parseFloat(amount);
        if (method) data.method = method as string;
        if (notes !== undefined) data.notes = notes || null;
        if (date) data.date = new Date(date);

        const updated = await prisma.accountEntry.update({
            where: { id },
            data,
            include: { customer: { select: { id: true, name: true, phone: true } } },
        });

        return NextResponse.json(updated);
    } catch (e: any) {
        console.error('ACCOUNT ENTRY UPDATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE /api/muhasebe — Kayıt sil
export async function DELETE(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // Menüde gizlemek yetkilendirme değildir: teknisyen adresi elle yazıp
    // bütün müşterilerin mali verisini okuyabiliyor/değiştirebiliyordu. Saha
    // tahsilatı ayrı uçtan geçer (/api/tickets/[id]/payments), o kapanmıyor.
    const yetki = yoneticiDegilse(user);
    if (yetki) return yetki;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 });

    await prisma.accountEntry.deleteMany({
        where: { id, tenantId: user.tenantId },
    });

    return NextResponse.json({ success: true });
}
