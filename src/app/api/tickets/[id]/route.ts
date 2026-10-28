import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { kaydetAsama } from '@/lib/ticket-asama';
import { syncTicketToCari } from '@/lib/ticket-cari';
import { parseFaultCategory } from '@/lib/fault-categories';
import { oturumKullanicisi } from '@/lib/api-auth';
import { ucHatasi } from '@/lib/uc-hata';
import { teslimSayacEngeli } from '@/lib/sayac-zorunlu';

const FIS_DURUMLARI = ['NEW', 'IN_SERVICE', 'WAITING_FOR_PART', 'READY', 'DELIVERED', 'CANCELLED'];

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await oturumKullanicisi(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // IDOR koruması: yalnızca bu tenant'ın fişi
    const ticket = await prisma.serviceTicket.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
            device: { include: { customer: true } },
            assignedUser: true,
            createdBy: true,
            // Aşama geçmişi — "kim ne zaman hangi aşamaya aldı".
            // Müşteri "siz bunu bir hafta beklettiniz" derse cevabı burada.
            statusHistory: {
                orderBy: { changedAt: 'asc' },
                select: {
                    status: true, oncekiStatus: true, changedAt: true, kaynak: true, notu: true,
                    changedByUserId: true,
                },
            },
        },
    });

    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(ticket);
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await oturumKullanicisi(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // IDOR koruması: fiş bu tenant'a mı ait?
        const existing = await prisma.serviceTicket.findFirst({ where: { id, tenantId: user.tenantId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await req.json();

        // Bilinmeyen durum veritabanına kadar gidip ham hata dönmesin.
        if (body.status !== undefined && !FIS_DURUMLARI.includes(body.status)) {
            return ucHatasi('GECERSIZ_DURUM', 400);
        }
        // SAYAÇSIZ KAPANMAZ (lib/sayac-zorunlu.ts): bayi açtıysa kiralık cihazın
        // fişi bu fişe bağlı sayaç okuması olmadan "teslim edildi"ye geçmez.
        // Ekran 409'u görünce sayaç kutusunu açar; istek BÜTÜNÜYLE reddedilir.
        if (body.status === 'DELIVERED' && existing.status !== 'DELIVERED'
            && await teslimSayacEngeli(user.tenantId, id, existing.status)) {
            return ucHatasi('SAYAC_ZORUNLU', 409);
        }

        const updateData: any = {};
        if (body.status !== undefined) {
            updateData.status = body.status;
            updateData.statusUpdatedAt = new Date();
        }
        if (body.assignedUserId !== undefined) updateData.assignedUserId = body.assignedUserId || null;
        if (body.issueText !== undefined) updateData.issueText = body.issueText;
        if (body.actionText !== undefined) updateData.actionText = body.actionText;
        if (body.notes !== undefined) updateData.notes = body.notes;
        // Saha ekleri: boş metin = temizle; biçimsiz değer sessizce yok sayılır.
        if (body.hataKodu !== undefined) updateData.hataKodu = String(body.hataKodu).trim().slice(0, 40) || null;
        if (body.planlananTarih !== undefined) {
            const g = String(body.planlananTarih);
            // Öğlen: saat dilimi kayması günü değiştirmesin.
            if (!g) updateData.planlananTarih = null;
            else if (/^\d{4}-\d{2}-\d{2}$/.test(g)) updateData.planlananTarih = new Date(`${g}T12:00:00`);
        }
        if (body.bosKartusAdet !== undefined) {
            const n = String(body.bosKartusAdet).trim();
            if (!n) updateData.bosKartusAdet = null;
            else if (/^\d{1,3}$/.test(n)) updateData.bosKartusAdet = Number(n);
        }
        if (body.totalCost !== undefined) updateData.totalCost = parseFloat(body.totalCost);
        if (body.laborCost !== undefined) updateData.laborCost = parseFloat(body.laborCost);
        if (body.createdAt !== undefined && body.createdAt) {
            const d = new Date(body.createdAt);
            if (!isNaN(d.getTime())) updateData.createdAt = d; // Fiş tarih/saati düzenlenebilir
        }
        if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus;
        if (body.priority !== undefined) updateData.priority = body.priority;
        // Arıza kategorisi — fiş açılışında atlanmışsa kapanışta (ya da sonradan) eklenebilsin.
        // Çapraz-bayi güvenilirlik analizinin TEK girdisi bu alan; boş kalırsa o fiş veriye katkı vermez.
        if (body.faultCategory !== undefined) {
            const fc = parseFaultCategory(body.faultCategory);
            if (fc) updateData.faultCategory = fc;                              // geçerli kod → yaz
            else if (body.faultCategory === null) updateData.faultCategory = null; // bilerek temizleme
            // geçersiz metin → sessizce yok say; mevcut doğru veriyi bozma
        }
        // Çöp kutusundan geri alma
        if (body.restore === true) updateData.deletedAt = null;

        const ticket = await prisma.serviceTicket.update({
            where: { id },
            data: updateData,
        });

        // AŞAMA GEÇMİŞİ: durum GERÇEKTEN değiştiyse yaz. Aynı duruma tekrar
        // basılması (ör. iki kez "Hazır") çizelgeyi kirletmesin diye eşitlik
        // kontrolü var. kaydetAsama hata fırlatmaz; geçmiş yazılamadı diye fiş
        // güncellenememesi kabul edilemez.
        if (body.status !== undefined && body.status !== existing.status) {
            await kaydetAsama({
                tenantId: user.tenantId,
                ticketId: id,
                status: ticket.status,
                oncekiStatus: existing.status,
                changedByUserId: user.id,
                kaynak: 'PANEL',
            });
        }

        // Servis fişini Muhasebe/Cari'ye otomatik yansıt (teslim edilince SATIŞ + ödendiyse TAHSİLAT)
        let cari = { synced: false, amount: 0 };
        try { cari = await syncTicketToCari(id, user.tenantId); } catch (e: any) { console.error('TICKET CARI SYNC ERROR:', e?.message); }

        return NextResponse.json({ ...ticket, cari });
    } catch (e: any) {
        console.error('TICKET UPDATE ERROR:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// Soft-delete (çöp kutusuna taşı) veya ?permanent=true ile kalıcı sil
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await oturumKullanicisi(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const url = new URL(req.url);
        const permanent = url.searchParams.get('permanent') === 'true';

        // IDOR koruması: yalnızca bu tenant'ın fişi
        if (permanent) {
            // Fişe bağlı cari kayıtlarını da temizle (artık fiş yok)
            await prisma.accountEntry.deleteMany({ where: { tenantId: user.tenantId, ticketId: id } });
            const res = await prisma.serviceTicket.deleteMany({ where: { id, tenantId: user.tenantId } });
            if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        } else {
            const res = await prisma.serviceTicket.updateMany({
                where: { id, tenantId: user.tenantId },
                data: { deletedAt: new Date() },
            });
            if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            // Çöpe atılan fişin cari kayıtlarını kaldır (sync: shouldHave=false → siler)
            try { await syncTicketToCari(id, user.tenantId); } catch (e: any) { console.error('TICKET CARI SYNC (delete) ERROR:', e?.message); }
        }
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
